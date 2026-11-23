/** Card network as a plain text wordmark for the wallet cards (sized in container units). */
export function NetworkMark({ network }: { network: string }) {
  switch (network) {
    case 'visa':
      return <span className="text-[5.6cqw] font-black italic leading-none tracking-[-0.03em]">VISA</span>;
    case 'mastercard':
      return <span className="text-[4cqw] font-semibold leading-none tracking-[-0.01em]">mastercard</span>;
    case 'rupay':
      return <span className="text-[4.8cqw] font-extrabold italic leading-none tracking-[-0.02em]">RuPay</span>;
    case 'amex':
      return <span className="text-[4.4cqw] font-black leading-none tracking-[0.06em]">AMEX</span>;
    default:
      return <span className="text-[3.8cqw] font-semibold uppercase leading-none tracking-[0.08em]">Card</span>;
  }
}
