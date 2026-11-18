'use client';
import { KeyRound, LockKeyhole, MailCheck, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CodeInput, RecoveryCodes, TwoFactorSetup } from './TwoFactorSetup';
import { Badge, Card, ErrorBox, Field, Modal, Spinner, useToast } from './ui';

function Row({ icon: Icon, title, status, children }: { icon: typeof KeyRound; title: string; status?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex items-center gap-2.5">
        <Icon size={16} className="text-ink-400" />
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {status && <span className="ml-auto">{status}</span>}
      </div>
      {children}
    </section>
  );
}

/** Email confirmation, password, and two-factor sign-in. */
export function SecurityCard() {
  const { me, refresh } = useAuth();
  const toast = useToast();
  const sec = me?.security;

  /* password */
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);

  /* two-factor */
  const [setupOpen, setSetupOpen] = useState(false);
  const [codeAction, setCodeAction] = useState<'disable' | 'codes' | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  if (!me || !sec) return null;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    if (pw.next !== pw.confirm) return setPwErr('The new passwords don’t match');
    setPwBusy(true);
    try {
      await post('/auth/change-password', { currentPassword: sec!.hasPassword ? pw.current : undefined, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      await refresh();
      toast(sec!.hasPassword ? 'Password changed. Other devices were signed out.' : 'Password added');
    } catch (err: any) {
      setPwErr(err.details?.fieldErrors?.newPassword?.[0] ?? err.message);
    } finally {
      setPwBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeBusy(true);
    setCodeErr(null);
    try {
      if (codeAction === 'disable') {
        await post('/auth/2fa/disable', { code: code.replace(/\s/g, '') });
        toast('Two-factor sign-in is off');
        closeCode();
      } else {
        const r = await post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { code: code.replace(/\s/g, '') });
        setNewCodes(r.recoveryCodes);
      }
      await refresh();
    } catch (err: any) {
      setCodeErr(err.message);
    } finally {
      setCodeBusy(false);
    }
  }
  function closeCode() {
    setCodeAction(null);
    setCode('');
    setUseRecovery(false);
    setCodeErr(null);
    setNewCodes(null);
  }

  async function resend() {
    try {
      await post('/auth/resend-verification');
      toast(`Link sent to ${me!.user.email}`);
    } catch (err: any) {
      toast(err.message, 'err');
    }
  }

  return (
    <Card title={<span className="flex items-center gap-2"><LockKeyhole size={16} className="text-brand-600" /> Security</span>}>
      <div className="divide-y divide-[color:var(--line)]">
        <Row icon={MailCheck} title="Email address" status={sec.emailVerified ? <Badge tone="green">Confirmed</Badge> : <Badge tone="amber">Not confirmed</Badge>}>
          {sec.emailVerified ? (
            <p className="text-[13px] text-ink-500">{me.user.email}</p>
          ) : (
            <p className="text-[13px] text-ink-600">
              Check {me.user.email} for a confirmation link.{' '}
              <button className="font-medium text-brand-700 hover:underline" onClick={resend}>
                Send it again
              </button>
            </p>
          )}
        </Row>

        <Row icon={KeyRound} title={sec.hasPassword ? 'Password' : 'Add a password'}>
          {!sec.hasPassword && <p className="mb-3 text-[13px] text-ink-500">You sign in with Google. Add a password to also sign in with your email.</p>}
          <form onSubmit={changePassword} className="space-y-3">
            <ErrorBox message={pwErr} />
            {sec.hasPassword && (
              <Field label="Current password">
                <input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New password" hint="8+ characters, with a letter and a number">
                <input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} />
              </Field>
              <Field label="Repeat new password">
                <input className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={8} />
              </Field>
            </div>
            <button className="btn-secondary text-[13px]" disabled={pwBusy || !pw.next}>
              {pwBusy && <Spinner />} {sec.hasPassword ? 'Change password' : 'Add password'}
            </button>
          </form>
        </Row>

        <Row icon={ShieldCheck} title="Two-factor sign-in" status={sec.mfaEnabled ? <Badge tone="green">On</Badge> : sec.mfaRequired ? <Badge tone="amber">Required</Badge> : <Badge>Off</Badge>}>
          {sec.mfaEnabled ? (
            <div className="space-y-3 text-[13px] text-ink-600">
              <p>
                Signing in needs your password and a code from your authenticator app.{' '}
                {sec.recoveryCodesLeft !== null && (
                  <span className={sec.recoveryCodesLeft <= 3 ? 'font-medium text-amber-700' : ''}>
                    {sec.recoveryCodesLeft} recovery code{sec.recoveryCodesLeft === 1 ? '' : 's'} left.
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary text-[13px]" onClick={() => setCodeAction('codes')}>
                  New recovery codes
                </button>
                {!sec.mfaRequired && (
                  <button className="btn-ghost text-[13px] text-red-700" onClick={() => setCodeAction('disable')}>
                    Turn off
                  </button>
                )}
              </div>
              {sec.mfaRequired && <p className="text-[12px] text-ink-400">Required for staff accounts on this programme.</p>}
            </div>
          ) : setupOpen ? (
            <TwoFactorSetup
              onComplete={async () => {
                setSetupOpen(false);
                await refresh();
                toast('Two-factor sign-in is on');
              }}
              onCancel={() => setSetupOpen(false)}
            />
          ) : (
            <div className="text-[13px] text-ink-600">
              <p>Add a second step at sign-in using an authenticator app, so a stolen password isn’t enough to get in.</p>
              <button className="btn-secondary mt-3 text-[13px]" onClick={() => setSetupOpen(true)}>
                Turn on
              </button>
            </div>
          )}
        </Row>
      </div>

      <Modal open={codeAction !== null} onClose={closeCode} title={newCodes ? 'Your new recovery codes' : codeAction === 'disable' ? 'Turn off two-factor sign-in' : 'Replace recovery codes'}>
        {newCodes ? (
          <RecoveryCodes codes={newCodes} onDone={closeCode} doneLabel="Done" />
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <ErrorBox message={codeErr} />
            <p className="text-[13.5px] text-ink-600">{codeAction === 'disable' ? 'Enter a code from your authenticator app to confirm. Other devices will be signed out.' : 'Your old recovery codes will stop working. Enter a code from your authenticator app to continue.'}</p>
            <CodeInput value={code} onChange={setCode} autoFocus recovery={useRecovery} />
            <button type="button" className="text-[12.5px] font-medium text-brand-700 hover:underline" onClick={() => (setUseRecovery((r) => !r), setCode(''))}>
              {useRecovery ? 'Use an authenticator code' : 'Use a recovery code instead'}
            </button>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-ghost" onClick={closeCode}>
                Cancel
              </button>
              <button className={codeAction === 'disable' ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'} disabled={codeBusy || code.trim().length < 6}>
                {codeBusy && <Spinner />} {codeAction === 'disable' ? 'Turn off' : 'Replace codes'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}
