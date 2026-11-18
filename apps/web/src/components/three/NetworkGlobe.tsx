'use client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { arcPoints, DEG, HUBS, landDotPositions, latLngToXYZ, LINKS, networkNodes } from './globeData';

/**
 * The hero globe: a dotted Earth (Natural Earth land mask) with the alumni network on top.
 * Alumni cities glow teal, campus cities violet, and light travels along the arcs between them.
 *
 * Layers, back to front: atmosphere halo → opaque body (hides the far side) → land dots →
 * connection arcs → city nodes → pulse rings. Everything is one small scene in a single canvas.
 * Drag to spin (horizontal only on touch, so the page still scrolls); auto-rotates otherwise.
 * With "reduce motion" the globe renders once, arcs fully drawn, and never animates.
 */
const R = 2;
const FOV = 38;
const BASE_TILT = 0.32; // radians; leans the north towards the viewer
const START_LNG = 74; // India faces the viewer on load
const AUTO_SPIN = 0.055; // radians per second (~2 minutes per turn)

const C = {
  land: new THREE.Color('#52b39d'),
  alumni: new THREE.Color('#41bfa2'),
  campus: new THREE.Color('#9d8fff'),
  bodyCore: new THREE.Color('#071923'),
  bodyRim: new THREE.Color('#115a50'),
  halo: new THREE.Color('#2fb597'),
};

const v3 = (p: [number, number, number]) => new THREE.Vector3(p[0], p[1], p[2]);

/* ---------------------------------------------------------------- shaders */

const landVert = /* glsl */ `
  uniform float uScale; uniform float uSize;
  varying float vFacing; varying float vLight;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * position);
    vFacing = n.z;
    vLight = clamp(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0);
    gl_PointSize = uSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const landFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vFacing; varying float vLight;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.3, d);
    float shade = 0.42 + 0.58 * vLight;
    float limb = smoothstep(0.0, 0.45, vFacing);
    gl_FragColor = vec4(uColor * shade, edge * (0.2 + 0.5 * limb));
  }`;

const bodyVert = /* glsl */ `
  varying float vFacing;
  void main() {
    vFacing = normalize(normalMatrix * normal).z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const bodyFrag = /* glsl */ `
  uniform vec3 uCore; uniform vec3 uRim;
  varying float vFacing;
  void main() {
    float rim = pow(1.0 - clamp(vFacing, 0.0, 1.0), 2.4);
    gl_FragColor = vec4(mix(uCore, uRim, rim), 1.0);
  }`;

const haloVert = /* glsl */ `
  varying float vFacing;
  void main() {
    vFacing = normalize(normalMatrix * normal).z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const haloFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vFacing;
  void main() {
    // s = distance from the globe's centre as a fraction of the halo radius (0.855 = body edge).
    // Brightest where the halo meets the globe, fading to nothing at its outer edge.
    float s = sqrt(1.0 - vFacing * vFacing);
    float i = pow(1.0 - smoothstep(0.85, 1.0, s), 2.2);
    gl_FragColor = vec4(uColor, 1.0) * i * 0.55;
  }`;

const arcVert = /* glsl */ `
  varying float vT; varying float vFacing;
  void main() {
    vT = uv.x;
    vFacing = normalize(normalMatrix * position).z; // > 0 on the visible hemisphere
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const arcFrag = /* glsl */ `
  uniform float uTime; uniform float uSpeed; uniform float uOffset; uniform float uStatic;
  uniform vec3 uA; uniform vec3 uB;
  varying float vT; varying float vFacing;
  void main() {
    vec3 col = mix(uA, uB, vT);
    // fade the stretch of an arc that has gone over the horizon, so it doesn't streak past the limb
    float ends = smoothstep(0.0, 0.03, vT) * smoothstep(1.0, 0.97, vT) * smoothstep(-0.2, 0.25, vFacing);
    if (uStatic > 0.5) { gl_FragColor = vec4(col, 0.55 * ends); return; }
    float head = fract(uTime * uSpeed + uOffset) * 1.7 - 0.35;
    float d = head - vT;
    float tail = step(0.0, d) * (1.0 - smoothstep(0.0, 0.3, d));
    float glow = pow(tail, 1.8);
    gl_FragColor = vec4(col + vec3(0.45) * glow * glow, (0.2 + 0.8 * glow) * ends);
  }`;

const hubVert = /* glsl */ `
  attribute vec3 aColor; attribute float aSize;
  uniform float uScale;
  varying vec3 vColor; varying float vFacing;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFacing = normalize(normalMatrix * position).z;
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const hubFrag = /* glsl */ `
  varying vec3 vColor; varying float vFacing;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.36, 0.26, d);
    float halo = pow(1.0 - d, 2.0) * 0.55;
    float a = max(core, halo) * smoothstep(-0.05, 0.3, vFacing);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.45), a);
  }`;

/* ---------------------------------------------------------------- scene */

type Drag = { active: boolean; x: number; y: number; vel: number; pendingY: number; tilt: number };

function buildScene() {
  const land = new THREE.BufferGeometry();
  land.setAttribute('position', new THREE.BufferAttribute(landDotPositions(R), 3));
  const landMat = new THREE.ShaderMaterial({
    vertexShader: landVert,
    fragmentShader: landFrag,
    uniforms: { uColor: { value: C.land }, uScale: { value: 500 }, uSize: { value: 0.026 } },
    transparent: true,
    depthWrite: false,
  });

  const body = new THREE.SphereGeometry(R * 0.992, 64, 64);
  const bodyMat = new THREE.ShaderMaterial({ vertexShader: bodyVert, fragmentShader: bodyFrag, uniforms: { uCore: { value: C.bodyCore }, uRim: { value: C.bodyRim } } });

  const halo = new THREE.SphereGeometry(R * 1.16, 64, 64);
  const haloMat = new THREE.ShaderMaterial({ vertexShader: haloVert, fragmentShader: haloFrag, uniforms: { uColor: { value: C.halo } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  const hubDir = new Map(HUBS.map((h) => [h.name, latLngToXYZ(h.lat, h.lng)]));
  const hubColor = (name: string) => (HUBS.find((h) => h.name === name)!.side === 'campus' ? C.campus : C.alumni);

  // Major hubs plus a denser tier of small network nodes, all in one Points draw call.
  const tier2 = networkNodes();
  const nodePos = [...HUBS.flatMap((h) => latLngToXYZ(h.lat, h.lng, R * 1.006)), ...tier2.flatMap(({ p }) => p.map((c) => c * R * 1.005))];
  const nodeCol = [...HUBS.flatMap((h) => hubColor(h.name).toArray()), ...tier2.flatMap(({ side }) => (side === 'campus' ? C.campus : C.alumni).toArray())];
  const nodeSize = [...HUBS.map((h) => (h.side === 'campus' ? 0.19 : 0.15)), ...tier2.map((_, i) => 0.07 + ((i * 7) % 5) * 0.008)];
  const hubs = new THREE.BufferGeometry();
  hubs.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodePos), 3));
  hubs.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(nodeCol), 3));
  hubs.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(nodeSize), 1));
  const hubMat = new THREE.ShaderMaterial({ vertexShader: hubVert, fragmentShader: hubFrag, uniforms: { uScale: { value: 500 } }, transparent: true, depthWrite: false });

  const arcs = LINKS.map(([from, to], i) => {
    const curve = new THREE.CatmullRomCurve3(arcPoints(hubDir.get(from)!, hubDir.get(to)!, R).map(v3));
    const geo = new THREE.TubeGeometry(curve, 96, 0.0085, 6, false);
    const mat = new THREE.ShaderMaterial({
      vertexShader: arcVert,
      fragmentShader: arcFrag,
      uniforms: { uTime: { value: 0 }, uSpeed: { value: 0.16 + ((i * 37) % 11) / 100 }, uOffset: { value: (i * 0.618) % 1 }, uStatic: { value: 0 }, uA: { value: hubColor(from) }, uB: { value: hubColor(to) } },
      transparent: true,
      depthWrite: false,
    });
    return { geo, mat };
  });

  // Pulse rings lie flat on the surface at each city.
  const ringGeo = new THREE.RingGeometry(0.82, 1, 48);
  const rings = HUBS.map((h, i) => {
    const n = v3(latLngToXYZ(h.lat, h.lng));
    const mat = new THREE.MeshBasicMaterial({ color: hubColor(h.name), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    return { pos: n.clone().multiplyScalar(R * 1.004), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), mat, offset: (i * 0.37) % 1, big: h.side === 'campus' };
  });

  const dispose = () => {
    [land, body, halo, hubs, ringGeo, ...arcs.map((a) => a.geo)].forEach((g) => g.dispose());
    [landMat, bodyMat, haloMat, hubMat, ...arcs.map((a) => a.mat), ...rings.map((r) => r.mat)].forEach((m) => m.dispose());
  };
  return { land, landMat, body, bodyMat, halo, haloMat, hubs, hubMat, arcs, ringGeo, rings, dispose };
}

function Earth({ animate, interactive, drag }: { animate: boolean; interactive: boolean; drag: React.RefObject<Drag> }) {
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const s = useMemo(buildScene, []);
  useEffect(() => s.dispose, [s]);

  useFrame((state, delta) => {
    // Keep dots the same physical size relative to the globe at any canvas size / DPR.
    const scale = (state.size.height * state.viewport.dpr) / (2 * Math.tan((FOV / 2) * DEG));
    s.landMat.uniforms.uScale.value = scale;
    s.hubMat.uniforms.uScale.value = scale;

    const t = state.clock.elapsedTime;
    s.arcs.forEach((a) => {
      a.mat.uniforms.uTime.value = t;
      a.mat.uniforms.uStatic.value = animate ? 0 : 1;
    });

    const g = spin.current;
    const tg = tilt.current;
    if (!g || !tg) return;
    const d = drag.current;
    if (animate) {
      const dt = Math.min(delta, 0.05);
      g.rotation.y += dt * AUTO_SPIN + d.pendingY;
      if (!d.active) {
        g.rotation.y += d.vel;
        d.vel *= 0.94;
        d.tilt *= 0.97;
      }
      d.pendingY = 0;
      const parallax = interactive ? state.pointer.y * 0.06 : 0;
      tg.rotation.x += (BASE_TILT + d.tilt + parallax - tg.rotation.x) * 0.06;
    }

    ringRefs.current.forEach((m, i) => {
      if (!m) return;
      const r = s.rings[i];
      const p = animate ? (t * 0.42 + r.offset) % 1 : 0.55;
      m.scale.setScalar((r.big ? 0.05 : 0.035) + p * (r.big ? 0.2 : 0.14));
      r.mat.opacity = animate ? (1 - p) * (r.big ? 0.7 : 0.45) : 0.35;
    });
  });

  return (
    <group ref={tilt} rotation={[BASE_TILT, 0, 0]}>
      <group ref={spin} rotation={[0, -START_LNG * DEG, 0]}>
        <mesh geometry={s.halo} material={s.haloMat} renderOrder={0} />
        <mesh geometry={s.body} material={s.bodyMat} renderOrder={1} />
        <points geometry={s.land} material={s.landMat} renderOrder={2} />
        {s.arcs.map((a, i) => (
          <mesh key={i} geometry={a.geo} material={a.mat} renderOrder={3} />
        ))}
        {s.rings.map((r, i) => (
          <mesh key={i} ref={(m) => void (ringRefs.current[i] = m)} geometry={s.ringGeo} material={r.mat} position={r.pos} quaternion={r.quat} renderOrder={4} />
        ))}
        <points geometry={s.hubs} material={s.hubMat} renderOrder={5} />
      </group>
    </group>
  );
}

export default function NetworkGlobe({ className = '', interactive = true }: { className?: string; interactive?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>({ active: false, x: 0, y: 0, vel: 0, pendingY: 0, tilt: 0 });
  // Client-only component (loaded with ssr:false), so the preference is known on first render.
  const [reduce, setReduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Stop rendering while the globe is scrolled out of view.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const canDrag = interactive && !reduce;
  const handlers = canDrag
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          drag.current = { ...drag.current, active: true, x: e.clientX, y: e.clientY, vel: 0 };
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* some pointers can't be captured; dragging still works while over the globe */
          }
        },
        onPointerMove: (e: React.PointerEvent) => {
          const d = drag.current;
          if (!d.active) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          d.x = e.clientX;
          d.y = e.clientY;
          d.pendingY += dx * 0.006;
          d.vel = dx * 0.006;
          if (e.pointerType === 'mouse') d.tilt = Math.max(-0.45, Math.min(0.45, d.tilt + dy * 0.004));
        },
        onPointerUp: () => void (drag.current.active = false),
        onPointerCancel: () => void (drag.current.active = false),
      }
    : {};

  return (
    <div ref={wrap} className={`${className} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ touchAction: 'pan-y' }} aria-hidden {...handlers}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6.4], fov: FOV }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        frameloop={reduce ? 'demand' : visible ? 'always' : 'never'}
      >
        <Earth animate={!reduce} interactive={canDrag} drag={drag} />
      </Canvas>
    </div>
  );
}
