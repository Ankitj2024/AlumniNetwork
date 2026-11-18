import { LAND_GRID, LAND_MASK, LAND_ROWS } from './landDots';

/**
 * Pure geometry for the hero globe (no Three.js here, so it can be checked from Node).
 *
 * Axes: +y is north, longitude 0 faces +z (towards the camera) and east is +x, so the globe is
 * never mirrored. Rotating the globe by -lng about y brings that longitude to the front.
 */
export type V3 = [number, number, number];
export const DEG = Math.PI / 180;

export function latLngToXYZ(lat: number, lng: number, r = 1): V3 {
  const la = lat * DEG;
  const lo = lng * DEG;
  return [r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)];
}

let maskBytes: Uint8Array | null = null;
function bytes() {
  if (!maskBytes) {
    const bin = atob(LAND_MASK);
    maskBytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) maskBytes[i] = bin.charCodeAt(i);
  }
  return maskBytes;
}
const bit = (i: number) => (bytes()[i >> 3] & (1 << (i & 7))) !== 0;

/** Positions of every land dot (x, y, z triples) on a sphere of radius r. */
export function landDotPositions(r = 1): Float32Array {
  const out: number[] = [];
  let i = 0;
  LAND_ROWS.forEach((n, row) => {
    const lat = LAND_GRID.latMax - row * LAND_GRID.step;
    for (let k = 0; k < n; k++, i++) {
      if (!bit(i)) continue;
      out.push(...latLngToXYZ(lat, -180 + ((k + 0.5) * 360) / n, r));
    }
  });
  return new Float32Array(out);
}

/** True when land is within one grid cell of (lat, lng). Used to sanity-check the hub list. */
export function nearLand(lat: number, lng: number): boolean {
  const row = Math.round((LAND_GRID.latMax - lat) / LAND_GRID.step);
  for (let dr = -1; dr <= 1; dr++) {
    const r = row + dr;
    if (r < 0 || r >= LAND_ROWS.length) continue;
    const start = LAND_ROWS.slice(0, r).reduce((a, b) => a + b, 0);
    const n = LAND_ROWS[r];
    const k = Math.floor(((lng + 180) / 360) * n);
    for (let dk = -1; dk <= 1; dk++) if (bit(start + ((k + dk + n) % n))) return true;
  }
  return false;
}

/**
 * Illustrative mentoring hubs: the campus side (students, violet) in India and alumni cities
 * around the world (mentors, teal). Static marketing visual — no user data is involved.
 */
export type Hub = { name: string; lat: number; lng: number; side: 'campus' | 'alumni' };
export const HUBS: Hub[] = [
  { name: 'Bengaluru', lat: 12.97, lng: 77.59, side: 'campus' },
  { name: 'Mumbai', lat: 19.08, lng: 72.88, side: 'campus' },
  { name: 'Delhi', lat: 28.61, lng: 77.21, side: 'campus' },
  { name: 'Hyderabad', lat: 17.39, lng: 78.49, side: 'campus' },
  { name: 'Kolkata', lat: 22.57, lng: 88.36, side: 'campus' },
  { name: 'San Francisco', lat: 37.77, lng: -122.42, side: 'alumni' },
  { name: 'Seattle', lat: 47.61, lng: -122.33, side: 'alumni' },
  { name: 'New York', lat: 40.71, lng: -74.01, side: 'alumni' },
  { name: 'Toronto', lat: 43.65, lng: -79.38, side: 'alumni' },
  { name: 'São Paulo', lat: -23.55, lng: -46.63, side: 'alumni' },
  { name: 'London', lat: 51.51, lng: -0.13, side: 'alumni' },
  { name: 'Berlin', lat: 52.52, lng: 13.4, side: 'alumni' },
  { name: 'Nairobi', lat: -1.29, lng: 36.82, side: 'alumni' },
  { name: 'Dubai', lat: 25.2, lng: 55.27, side: 'alumni' },
  { name: 'Singapore', lat: 1.35, lng: 103.82, side: 'alumni' },
  { name: 'Tokyo', lat: 35.68, lng: 139.69, side: 'alumni' },
  { name: 'Sydney', lat: -33.87, lng: 151.21, side: 'alumni' },
];

/** Connections drawn as arcs, alumni → campus (plus a few between alumni cities). */
export const LINKS: [string, string][] = [
  ['San Francisco', 'Bengaluru'],
  ['Seattle', 'Hyderabad'],
  ['New York', 'Delhi'],
  ['Toronto', 'Bengaluru'],
  ['São Paulo', 'Mumbai'],
  ['London', 'Mumbai'],
  ['Berlin', 'Hyderabad'],
  ['Nairobi', 'Mumbai'],
  ['Dubai', 'Delhi'],
  ['Singapore', 'Bengaluru'],
  ['Tokyo', 'Kolkata'],
  ['Sydney', 'Hyderabad'],
  ['London', 'New York'],
  ['Singapore', 'Sydney'],
  ['Delhi', 'Bengaluru'],
  ['San Francisco', 'Tokyo'],
  ['Sydney', 'San Francisco'],
  ['São Paulo', 'New York'],
  ['Toronto', 'London'],
];

/**
 * A second, denser tier of small nodes: mentors and students spread across the continents.
 * Picked deterministically from the land dots (seeded), kept apart by a minimum spacing.
 * Returns unit-sphere positions; ~40% are campus/students (violet), the rest alumni (teal).
 */
export function networkNodes(count = 90, minGap = 0.11): { p: V3; side: Hub['side'] }[] {
  const land = landDotPositions(1);
  const n = land.length / 3;
  let seed = 20260611;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const taken: V3[] = HUBS.map((h) => latLngToXYZ(h.lat, h.lng));
  const out: { p: V3; side: Hub['side'] }[] = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const i = Math.floor(rnd() * n);
    const p: V3 = [land[i * 3], land[i * 3 + 1], land[i * 3 + 2]];
    if (taken.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < minGap)) continue;
    taken.push(p);
    out.push({ p, side: rnd() < 0.4 ? 'campus' : 'alumni' });
  }
  return out;
}

/** Points along the great circle a→b, lifted into an arc whose height grows with distance. */
export function arcPoints(a: V3, b: V3, r: number, segments = 64): V3[] {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  const s = Math.sin(omega) || 1;
  const lift = 0.05 + 0.24 * (omega / Math.PI);
  const pts: V3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wa = Math.sin((1 - t) * omega) / s;
    const wb = Math.sin(t * omega) / s;
    const h = r * (1.004 + lift * Math.sin(Math.PI * t));
    pts.push([(wa * a[0] + wb * b[0]) * h, (wa * a[1] + wb * b[1]) * h, (wa * a[2] + wb * b[2]) * h]);
  }
  return pts;
}
