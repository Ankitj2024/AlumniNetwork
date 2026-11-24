'use client';
import { ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal, Spinner, cx, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { detectNetwork, digits, luhn, parseExpiry, type PaymentConfig, type SavedMethod } from '@/lib/payments';
import { CardNumberField, CvvField, ExpiryField } from './CardFields';

const FINISHES: { id: SavedMethod['finish']; label: string; swatch: string }[] = [
  { id: 'metal', label: 'Metal', swatch: 'conic-gradient(from 20deg at 60% 45%, #d6d8dc, #f6f7f8, #c4c7cc, #eef0f2, #cdd0d4, #f8f8f9, #d6d8dc)' },
  { id: 'black', label: 'Black', swatch: 'linear-gradient(140deg, #2a3040, #121621)' },
  { id: 'glass', label: 'Glass', swatch: 'linear-gradient(145deg, rgba(126,206,178,.9), rgba(28,92,76,.9))' },
  { id: 'color', label: 'Colour', swatch: 'linear-gradient(155deg, #3f8f74, #1f5a47)' },
];

/**
 * Save a card. With the test gateway the card is "tokenised" here (only network, last four and expiry
 * are sent). With Razorpay, cards are saved inside Razorpay Checkout when the student pays.
 */
export function AddCardModal({ open, onClose, onAdded, config, holderName }: { open: boolean; onClose: () => void; onAdded: () => void; config: PaymentConfig | null; holderName: string }) {
  const toast = useToast();
  const [f, setF] = useState({ number: '', exp: '', cvv: '', name: holderName, nickname: '', cardType: 'credit' as SavedMethod['cardType'], finish: '' as SavedMethod['finish'] | '', makeDefault: false });
  const [busy, setBusy] = useState(false);
  const network = detectNetwork(f.number);
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!luhn(f.number)) e.number = 'Enter a valid card number';
    if (!parseExpiry(f.exp)) e.exp = 'MM/YY in the future';
    if (!/^\d{3,4}$/.test(f.cvv)) e.cvv = '3 or 4 digits';
    return e;
  }, [f]);
  const razorpay = config?.gateway === 'razorpay';

  async function save() {
    setBusy(true);
    try {
      const exp = parseExpiry(f.exp)!;
      await post('/payments/methods', {
        network,
        cardType: f.cardType,
        last4: digits(f.number).slice(-4),
        expMonth: exp.month,
        expYear: exp.year,
        holder: f.name.trim() || undefined,
        nickname: f.nickname.trim() || undefined,
        finish: f.finish || undefined,
        makeDefault: f.makeDefault,
      });
      toast('Card saved');
      setF({ number: '', exp: '', cvv: '', name: holderName, nickname: '', cardType: 'credit', finish: '', makeDefault: false });
      onAdded();
      onClose();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a card"
      footer={
        razorpay ? (
          <button className="btn-primary" onClick={onClose}>
            Got it
          </button>
        ) : (
          <>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={busy || Object.keys(errors).length > 0}>
              {busy && <Spinner />} Save card
            </button>
          </>
        )
      }
    >
      {razorpay ? (
        <div className="py-2 text-[13.5px] text-ink-600">
          <ShieldCheck size={26} className="text-brand-600" />
          <p className="mt-2">Cards are saved securely by Razorpay when you pay for a session: tick “Save this card” in the Razorpay window. Your card number never reaches this site.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <CardNumberField value={f.number} onChange={(number) => setF({ ...f, number })} />
          <div className="grid grid-cols-3 gap-3">
            <ExpiryField value={f.exp} onChange={(exp) => setF({ ...f, exp })} />
            <CvvField value={f.cvv} onChange={(cvv) => setF({ ...f, cvv })} />
            <label className="block">
              <span className="label">Type</span>
              <select className="input" value={f.cardType} onChange={(e) => setF({ ...f, cardType: e.target.value as SavedMethod['cardType'] })}>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
                <option value="prepaid">Prepaid</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Name on card</span>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Nickname (optional)</span>
              <input className="input" placeholder="e.g. HDFC Millennia" value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} />
            </label>
          </div>
          <div>
            <span className="label">Card finish in your wallet</span>
            <div className="flex flex-wrap gap-2">
              {FINISHES.map((x) => (
                <button key={x.id} type="button" onClick={() => setF({ ...f, finish: x.id })} className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition', f.finish === x.id ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-[color:var(--line-strong)] text-ink-700 hover:bg-ink-50')}>
                  <span className="h-4 w-6 rounded-[4px] ring-1 ring-black/10" style={{ background: x.swatch }} />
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-700">
            <input type="checkbox" checked={f.makeDefault} onChange={(e) => setF({ ...f, makeDefault: e.target.checked })} className="h-4 w-4 accent-brand-600" />
            Use as my default card
          </label>
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-500 ring-1 ring-inset ring-[color:var(--line)]">
            Test gateway: the card number and CVV stay in your browser — only the network, last four digits and expiry are saved. Try <span className="font-mono text-ink-700">4242 4242 4242 4242</span> or <span className="font-mono text-ink-700">6521 8000 0000 0000</span> (RuPay).
          </p>
        </div>
      )}
    </Modal>
  );
}
