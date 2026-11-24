import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Cancellations & refunds', description: 'How cancellations and refunds work for paid mentoring sessions.' };

/*
 * Mirrors the platform's actual refund rules (apps/api/src/services/payments.ts, sessions.ts):
 * mentor/staff cancellation → full refund; student cancellation → full refund up to the cutoff
 * (24 h by default, set by the programme) and none after; ending a mentorship refunds upcoming
 * paid sessions; unpaid bookings are released after 30 minutes. Review before launch.
 */
export default function RefundsPage() {
  return (
    <LegalPage title="Cancellations & refunds" updated="24 November 2026" intro={<p>Most sessions on {SITE.name} are free. When a mentor sets a session fee, these rules decide what happens if plans change. They’re applied automatically.</p>}>
      <h2>If the mentor cancels</h2>
      <p>You get a <strong>full refund</strong>, whenever they cancel. The same applies if an administrator or the Alumni Relations office cancels the session.</p>

      <h2>If you cancel</h2>
      <ul>
        <li>Cancel <strong>at least 24 hours</strong> before the session starts (or the cutoff your programme sets, shown when you book) and you get a full refund.</li>
        <li>Cancel later than that and the session fee is not refunded, because the mentor has kept that time for you.</li>
        <li>A booked session can be cancelled only before it starts.</li>
      </ul>

      <h2>If a mentorship ends</h2>
      <p>When a mentorship ends — by either side, or because an account is deleted — every upcoming paid session in it is cancelled and refunded in full.</p>

      <h2>If a session doesn’t happen</h2>
      <p>If your mentor doesn’t show up, mark the session as “didn’t happen” and contact us within 7 days. We’ll review it and refund you in full where the session didn’t take place.</p>

      <h2>Unfinished payments</h2>
      <p>A booking is held for 30 minutes while you pay. If payment isn’t completed in that time, the slot is released and nothing is charged. If money reaches us after a hold has expired, it’s refunded automatically.</p>

      <h2>How refunds are paid</h2>
      <p>Refunds go back to the original payment method. Banks usually show them within 5–7 working days of the refund being issued. You can see each payment and its refund under <strong>Payments</strong> in your account.</p>

      <h2>Questions</h2>
      <p>
        {SITE.email ? (
          <>
            Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> with your payment reference.
          </>
        ) : (
          <>
            <Link href="/contact">Contact us</Link> with your payment reference.
          </>
        )}{' '}
        See also our <Link href="/terms">terms of service</Link>.
      </p>
    </LegalPage>
  );
}
