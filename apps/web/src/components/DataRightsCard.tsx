'use client';
import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Card, Field, Modal, Spinner, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Data rights (India's DPDP Act 2023): download everything the platform holds about you, or erase
 * your account. Shown to students and alumni; staff accounts are managed by an administrator.
 */
export function DataRightsCard() {
  const toast = useToast();
  const { me } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  if (!me || (me.user.role !== 'student' && me.user.role !== 'alumnus')) return null;
  const isMentor = me.user.role === 'alumnus';
  const needsPassword = me.security?.hasPassword;

  async function download() {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/me/export', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Could not prepare your data. Please try again.');
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: `my-data-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
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
      <p className="text-[13px] text-ink-600">Download a copy of everything this platform holds about you, or delete your account.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={download} disabled={busy}>
          {busy ? <Spinner /> : <Download size={15} />} Download my data
        </button>
        <button className="btn-ghost text-red-700" onClick={() => setOpen(true)}>
          <Trash2 size={15} /> Delete my account
        </button>
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
            <button className="btn-danger" onClick={erase} disabled={deleting || confirm !== 'DELETE' || (needsPassword && !password)}>
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
