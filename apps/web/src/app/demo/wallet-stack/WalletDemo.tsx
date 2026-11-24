'use client';
import { Briefcase, Coffee, Croissant, Gift, Hand, Keyboard, MousePointer2, MoveVertical, Plane, RefreshCw, Ship, ShoppingBasket, TrainFront, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { WalletStack, type WalletStackCard } from '@/components/wallet/WalletStack';

const ICON = 15;
const person = (from: string, to: string) => <span className="h-full w-full" style={{ background: `conic-gradient(from 210deg, ${from}, ${to}, ${from})` }} />;

/* Sample data for the demo (fictional issuers, holder and network). */
const CARDS: WalletStackCard[] = [
  {
    id: 'debit',
    issuer: 'Northwind',
    product: 'Current account',
    lastFour: '2048',
    holder: 'Maya Okafor',
    expires: '10/29',
    variant: 'metal',
    balance: 3912.45,
    balanceLabel: 'Available balance',
    transactions: [
      { id: 'd1', merchant: 'Daily Grind', detail: 'Coffee · Today', amount: -5.75, icon: <Coffee size={ICON} /> },
      { id: 'd2', merchant: 'Lumen Labs', detail: 'Salary · Sep 25', amount: 4200, icon: <Briefcase size={ICON} /> },
      { id: 'd3', merchant: 'Green Basket', detail: 'Groceries · Sep 24', amount: -86.3, icon: <ShoppingBasket size={ICON} /> },
    ],
  },
  {
    id: 'credit',
    issuer: 'Obsidian',
    product: 'Platinum credit',
    lastFour: '7391',
    holder: 'Maya Okafor',
    expires: '04/28',
    variant: 'black',
    balance: 1468.2,
    balanceLabel: 'Spent this month',
    transactions: [
      { id: 'c1', merchant: 'Saffron House', detail: 'Dining · Sep 21', amount: -118.4, icon: <UtensilsCrossed size={ICON} /> },
      { id: 'c2', merchant: 'Skyline Airways', detail: 'Travel · Sep 18', amount: -412, icon: <Plane size={ICON} /> },
      { id: 'c3', merchant: 'Arjun Mehta', detail: 'Split dinner · Sep 15', amount: 48, icon: person('#f472b6', '#38bdf8') },
    ],
  },
  {
    id: 'transit',
    issuer: 'Harbour',
    product: 'Metro pass',
    lastFour: '5520',
    holder: 'Maya Okafor',
    expires: '12/27',
    variant: 'glass',
    balance: 42.6,
    balanceLabel: 'Pass balance',
    transactions: [
      { id: 't1', merchant: 'Metro Line 2', detail: 'Ride · Today', amount: -2.75, icon: <TrainFront size={ICON} /> },
      { id: 't2', merchant: 'Bay Ferry', detail: 'Ride · Sep 22', amount: -6.5, icon: <Ship size={ICON} /> },
      { id: 't3', merchant: 'Auto top-up', detail: 'From Northwind · Sep 20', amount: 40, icon: <RefreshCw size={ICON} /> },
    ],
  },
  {
    id: 'club',
    issuer: 'Bean & Leaf',
    product: 'Loyalty card',
    lastFour: '8814',
    holder: 'Maya Okafor',
    expires: '07/28',
    variant: 'color',
    tint: 'oklch(46% 0.1 158)',
    balance: 18,
    balanceLabel: 'Card balance',
    transactions: [
      { id: 'b1', merchant: 'Flat white', detail: 'Bean & Leaf · Today', amount: -4.5, icon: <Coffee size={ICON} /> },
      { id: 'b2', merchant: 'Almond croissant', detail: 'Bean & Leaf · Sep 23', amount: -3.8, icon: <Croissant size={ICON} /> },
      { id: 'b3', merchant: 'Birthday reward', detail: 'Sep 20', amount: 5, icon: <Gift size={ICON} /> },
    ],
  },
];

const TIPS = [
  { icon: MousePointer2, title: 'Hover', text: 'The stack fans out; the front card tilts and catches the light.' },
  { icon: MoveVertical, title: 'Drag or flick', text: 'Down sends the front card to the pocket; up brings it back.' },
  { icon: Hand, title: 'Click a card', text: 'It lifts out with its balance and activity. Click it, pull it down or press Esc to put it back.' },
  { icon: Keyboard, title: 'Keyboard', text: 'Arrow keys switch cards, Home and End jump, Enter opens.' },
];

export function WalletDemo() {
  const [reduced, setReduced] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-canvas text-ink-900">
      <SiteHeader />

      <section className="mx-auto max-w-5xl px-5 pb-16 pt-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-700">Demo</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Wallet stack</h1>
        <p className="mt-2 max-w-xl text-[15px] text-ink-500">A stack of cards you can fan, flick through, and open to see a balance and recent activity.</p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-[28px] border border-[color:var(--line)] bg-surface px-5 py-8 shadow-card sm:py-12">
            <WalletStack cards={CARDS} label="Maya’s cards" reducedMotion={reduced} onSelectedChange={(c) => setSelected(c?.id ?? null)} />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[color:var(--line)] bg-surface p-5 shadow-card">
              <h2 className="text-[14px] font-semibold">Try it</h2>
              <ul className="mt-3 space-y-3">
                {TIPS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-600">
                      <Icon size={14} />
                    </span>
                    <span className="text-[13px] leading-snug text-ink-600">
                      <span className="font-medium text-ink-900">{title}.</span> {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--line)] bg-surface p-5 shadow-card">
              <span>
                <span className="block text-[14px] font-semibold">Reduce motion</span>
                <span className="block text-[12.5px] text-ink-500">No fan, tilt or light; changes are instant.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={reduced}
                aria-label="Reduce motion"
                onClick={() => setReduced((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${reduced ? 'bg-brand-600' : 'bg-ink-200'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${reduced ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <p className="px-1 text-[12.5px] text-ink-500" aria-live="polite">
              {selected ? (
                <>
                  <code className="rounded bg-ink-100 px-1 py-0.5 text-[12px] text-ink-700">onSelectedChange</code> → {selected}
                </>
              ) : (
                'No card open.'
              )}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
