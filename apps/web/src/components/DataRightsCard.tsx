'use client';
import { Download, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Card, Field, Modal, Spinner, useToast } from '@/components/ui';
import GlassFolder, { type FolderFile } from '@/components/ui/glass-folder-cards';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

type Export = Record<string, unknown>;

/** The parts of the export, one file each in the folder. Keys are the export's top-level fields. */
const SECTIONS = (isMentor: boolean) => [
  { name: 'Notifications', meta: 'JSON', keys: ['notifications'] },
  isMentor ? { name: 'Earnings', meta: 'JSON', keys: ['earnings'] } : { name: 'Payments & cards', meta: 'JSON', keys: ['payments', 'savedCards'] },
  { name: 'Requests & mentorships', meta: 'JSON', keys: ['requests', 'mentorships'] },
  { name: 'Profile & account', meta: 'JSON', keys: ['account', 'profile', 'capacity', 'availability', 'verification'] },
];

/**
 * Data rights (India's DPDP Act 2023): download everything the platform holds about you, or erase
 * your account. Shown to students and alumni; staff accounts are managed by an administrator.
 * The glass folder holds the export split into parts: open it and pick one to download just that.
 */
export function DataRightsCard() {
  const toast = useToast();
  const { me } = useAuth();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const cache = useRef<Export | null>(null);
  if (!me || (me.user.role !== 'student' && me.user.role !== 'alumnus')) return null;
  const isMentor = me.user.role === 'alumnus';
  const needsPassword = me.security?.hasPassword;
  const sections = SECTIONS(isMentor);
  const files: FolderFile[] = sections.map(({ name, meta }) => ({ name, meta }));
  const today = () => new Date().toISOString().slice(0, 10);

  async function load(): Promise<Export> {
    if (cache.current) return cache.current;
    const res = await fetch('/api/auth/me/export', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error('Could not prepare your data. Please try again.');
    cache.current = (await res.json()) as Export;
    return cache.current;
  }

  function save(data: unknown, filename: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function download(section?: (typeof sections)[number]) {
    setBusy(true);
    try {
      const all = await load();
      if (!section) save(all, `my-data-${today()}.json`);
      else {
        const part: Export = { exportedAt: all.exportedAt };
        for (const k of section.keys) if (k in all) part[k] = all[k];
        save(part, `my-data-${section.name.toLowerCase().replace(/[^a-z]+/g, '-')}-${today()}.json`);
      }
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setDeleting(true);
    try {
      await post('/auth/me/delete', { confirm, password: password || undefined });
      window.location.href = '/login?deleted=1';
    } catch (e: any) {
      toast(e.message, 'err');
      setDeleting(false);
    }
  }

  return (
    <Card title="Your data">
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-sm">
          <p className="text-[14px] leading-relaxed text-ink-600">Everything this platform holds about you, in four parts. Open the folder and pick one to download just that part, or download it all at once.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => download()} disabled={busy}>
              {busy ? <Spinner /> : <Download size={15} />} Download everything
            </button>
            <button className="btn-danger" onClick={() => setOpen(true)}>
              <Trash2 size={15} /> Delete my account
            </button>
          </div>
        </div>
        <GlassFolder
          key={theme}
          label="Your data"
          tone={theme === 'dark' ? 'dark' : 'light'}
          art={theme === 'dark' ? 'dusk' : 'glacier'}
          seed={7}
          files={files}
          action="none"
          width={260}
          onFileSelect={(file) => download(sections.find((s) => s.name === file.name))}
        />
      </div>

      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Delete your account?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={deleting}>
              Keep my account
            </button>
            <button className="btn bg-red-600 text-white hover:bg-red-500" onClick={erase} disabled={deleting || confirm !== 'DELETE' || (needsPassword && !password)}>
              {deleting && <Spinner />} Delete permanently
            </button>
          </>
        }
      >
        <div className="space-y-3 text-[13.5px] text-ink-700">
          <p>This can't be undone. You may want to download your data first.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your profile, {isMentor ? 'verification documents, availability' : 'career goals'}, saved cards and notifications are erased, and you're signed out everywhere.</li>
            <li>Your active mentorships end. Upcoming sessions are cancelled, and paid ones are refunded in full.</li>
            <li>{isMentor ? 'Requests waiting for you are declined.' : 'Your pending requests are withdrawn.'}</li>
            <li>Messages and feedback stay visible to the other person, shown as from “Deleted user”. Payment records are kept, without your name, because the law requires it.</li>
          </ul>
          {needsPassword && (
            <Field label="Your password">
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          <Field label="Type DELETE to confirm">
            <input className="input font-mono" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}
