export const AREA_LABELS: Record<string, string> = {
  career_guidance: 'Career guidance',
  interview_prep: 'Interview prep',
  resume_review: 'Resume review',
  higher_studies: 'Higher studies',
  entrepreneurship: 'Entrepreneurship',
  technical_skills: 'Technical skills',
  industry_insight: 'Industry insight',
  networking: 'Networking',
  leadership: 'Leadership',
};

export const DECLINE_LABELS: Record<string, string> = {
  at_capacity: "I'm at capacity right now",
  not_my_expertise: "Not my area of expertise",
  timing: "Timing doesn't work",
  better_match_elsewhere: 'Another mentor would fit better',
  other: 'Other',
};

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function fmtDate(d?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, opts);
}
export function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function relTime(d?: string | null) {
  if (!d) return '—';
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export const homeFor = (role: string) =>
  ({ student: '/student', alumnus: '/mentor', aro: '/admin', admin: '/admin', placement: '/analytics' })[role] ?? '/';
