/** Injectable clock so time-based jobs (expiry, reminders, decay) are deterministic in tests. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function startOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  return new Date(x.getTime() - diff * DAY_MS);
}
