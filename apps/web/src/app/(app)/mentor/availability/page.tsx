'use client';
import { Gauge } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CapacityMeter, ErrorBox, Field, PageHeader, PageLoader, Spinner, useToast } from '@/components/ui';
import { post, put } from '@/lib/api';
import { DAYS, fmtDate, minutesToTime, timeToMinutes } from '@/lib/format';
import { useApi } from '@/lib/hooks';

type W = { dayOfWeek: number; start: string; end: string };

export default function AvailabilityPage() {
  const toast = useToast();
  const cap = useApi<{ capacity: any }>('/mentors/me/capacity');
  const av = useApi<{ availability: { dayOfWeek: number; startMinute: number; endMinute: number; timezone: string }[] }>('/mentors/me/availability');
  const [max, setMax] = useState(2);
  const [maxPending, setMaxPending] = useState(5);
  const [windows, setWindows] = useState<W[] | null>(null);
  const [pauseUntil, setPauseUntil] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata';

  useEffect(() => {
    if (cap.data?.capacity) {
      setMax(cap.data.capacity.maxMentees);
      setMaxPending(cap.data.capacity.maxPendingRequests);
    }
  }, [cap.data]);
  useEffect(() => {
    if (av.data && !windows) setWindows(av.data.availability.map((w) => ({ dayOfWeek: w.dayOfWeek, start: minutesToTime(w.startMinute), end: minutesToTime(w.endMinute) })));
  }, [av.data, windows]);

  if (cap.loading || !windows) return <PageLoader />;
  const c = cap.data?.capacity;
  if (!c) return <ErrorBox message="Capacity settings become available once your alumni status is verified." />;

  async function saveCap() {
    setBusy('cap');
    setErr(null);
    try {
      const r = await put<{ note?: string }>('/mentors/me/capacity', { maxMentees: max, maxPendingRequests: maxPending });
      toast(r.note ?? 'Capacity updated');
      cap.reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function saveWindows() {
    setBusy('av');
    setErr(null);
    try {
      await put('/mentors/me/availability', { windows: windows!.map((w) => ({ dayOfWeek: w.dayOfWeek, startMinute: timeToMinutes(w.start), endMinute: timeToMinutes(w.end), timezone: tz })) });
      toast('Availability saved');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  }
  async function pause() {
    setBusy('pause');
    await post(c.paused ? '/mentors/me/resume' : '/mentors/me/pause', c.paused ? {} : { until: pauseUntil || undefined, reason: 'Taking a break' });
    toast(c.paused ? 'Resumed' : 'Paused');
    cap.reload();
    setBusy(null);
  }

  return (
    <>
      <PageHeader icon={Gauge} eyebrow="Your time" title="Capacity & availability" subtitle="Hard limits you set. The platform enforces them — students can never push you past them." />
      <ErrorBox message={err} />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title="Mentee limit">
          <CapacityMeter capacity={c} />
          <div className="mt-5 space-y-5">
            <Field label={`Maximum concurrent mentees: ${max}`} hint="Most mentors find 1–3 sustainable alongside a full-time job.">
              <input type="range" min={0} max={10} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-full accent-brand-600" />
            </Field>
            <Field label={`Maximum open requests at a time: ${maxPending}`} hint="Once reached, you stop appearing in search until you respond or requests expire.">
              <input type="range" min={1} max={20} value={maxPending} onChange={(e) => setMaxPending(Number(e.target.value))} className="w-full accent-brand-600" />
            </Field>
            <button className="btn-primary" onClick={saveCap} disabled={busy === 'cap'}>
              {busy === 'cap' && <Spinner />} Save limits
            </button>
          </div>
        </Card>

        <Card title="Pause">
          {c.paused ? (
            <p className="text-sm text-ink-700">You&apos;re paused{c.pausedUntil ? ` until ${fmtDate(c.pausedUntil)}` : ''}. Existing mentorships continue; no new requests arrive.</p>
          ) : (
            <>
              <p className="text-sm text-ink-600">Busy quarter? Pause new requests. Existing mentees are unaffected. Optionally pick a date to resume automatically.</p>
              <Field label="Resume automatically on (optional)">
                <input type="date" className="input mt-1" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} />
              </Field>
            </>
          )}
          <button className="btn-secondary mt-4" onClick={pause} disabled={busy === 'pause'}>
            {c.paused ? 'Resume now' : 'Pause new requests'}
          </button>
        </Card>

        <Card title="Weekly availability" className="lg:col-span-2" actions={<span className="text-xs text-ink-500">Times in {tz}</span>}>
          <p className="mb-4 text-sm text-ink-600">Shown to students as a guide. Sessions are always proposed and confirmed explicitly.</p>
          <div className="space-y-2">
            {windows.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select className="input w-28" value={w.dayOfWeek} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, dayOfWeek: Number(e.target.value) } : x)))}>
                  {DAYS.map((d, k) => (
                    <option key={d} value={k}>
                      {d}
                    </option>
                  ))}
                </select>
                <input type="time" className="input w-32" value={w.start} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                <span className="text-ink-400">to</span>
                <input type="time" className="input w-32" value={w.end} onChange={(e) => setWindows(windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                <button className="btn-ghost text-red-700" onClick={() => setWindows(windows.filter((_, j) => j !== i))} aria-label="Remove window">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-secondary" onClick={() => setWindows([...windows, { dayOfWeek: 6, start: '10:00', end: '11:00' }])} disabled={windows.length >= 21}>
              Add window
            </button>
            <button className="btn-primary" onClick={saveWindows} disabled={busy === 'av'}>
              {busy === 'av' && <Spinner />} Save availability
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
