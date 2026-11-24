'use client';
import { detectNetwork, digits, formatCard, luhn, NETWORK_LABEL } from '@/lib/payments';

/*
 * Card inputs shared by checkout and "Add a card". Each formats as the person types; the full number
 * and the CVV stay in the browser (only the network, last four digits and expiry are ever sent).
 */

export function CardNumberField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const d = digits(value);
  return (
    <label className="block">
      <span className="label">Card number</span>
      <div className="relative">
        <input className="input pr-24 font-mono tracking-wider" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={value} onChange={(e) => onChange(formatCard(e.target.value))} />
        {d.length >= 2 && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{NETWORK_LABEL[detectNetwork(value)]}</span>}
      </div>
      {d.length >= 12 && !luhn(value) && <span className="mt-1 block text-[12px] text-red-700">Enter a valid card number</span>}
    </label>
  );
}

export function ExpiryField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">Expiry</span>
      <input
        className="input font-mono"
        inputMode="numeric"
        autoComplete="cc-exp"
        placeholder="MM/YY"
        value={value}
        onChange={(e) => {
          const d = digits(e.target.value).slice(0, 4);
          onChange(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
        }}
      />
    </label>
  );
}

export function CvvField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="label">CVV</span>
      <input className="input font-mono" inputMode="numeric" autoComplete="cc-csc" type="password" placeholder="•••" value={value} onChange={(e) => onChange(digits(e.target.value).slice(0, 4))} />
    </label>
  );
}
