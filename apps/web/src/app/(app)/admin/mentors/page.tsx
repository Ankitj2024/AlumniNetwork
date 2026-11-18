'use client';
import { Trophy } from 'lucide-react';
import { Bar, PageHeader, PageLoader } from '@/components/ui';
import { useApi } from '@/lib/hooks';

export default function MentorEffectiveness() {
  const { data, loading } = useApi<{ mentors: any[] }>('/analytics/mentors');
  if (loading && !data) return <PageLoader />;
  return (
    <>
      <PageHeader icon={Trophy} eyebrow="Programme" title="Mentor effectiveness" subtitle="Score = student rating (40%) + goal completion (25%) + session completion (20%) + responsiveness (15%). Use it to thank top mentors and support struggling ones — not to rank people publicly." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase text-ink-500">
            <tr>
              <th className="px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Mentor</th>
              <th className="px-4 py-2.5">Score</th>
              <th className="px-4 py-2.5">Mentorships</th>
              <th className="px-4 py-2.5">Rating</th>
              <th className="px-4 py-2.5">Sessions</th>
              <th className="px-4 py-2.5">Session completion</th>
              <th className="px-4 py-2.5">Goal completion</th>
              <th className="px-4 py-2.5">Avg response</th>
            </tr>
          </thead>
          <tbody>
            {data?.mentors.map((m, i) => (
              <tr key={m.mentorId} className="border-b border-ink-100 last:border-0">
                <td className="px-4 py-3 text-ink-400">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-ink-500">{m.industry}</div>
                </td>
                <td className="w-32 px-4 py-3">
                  <Bar value={m.effectivenessScore} />
                  <div className="mt-1 text-xs font-medium">{m.effectivenessScore}</div>
                </td>
                <td className="px-4 py-3">
                  {m.mentorships} <span className="text-xs text-ink-500">({m.activeMentorships} active)</span>
                </td>
                <td className="px-4 py-3">{m.avgStudentRating ? `★ ${m.avgStudentRating}` : '—'} <span className="text-xs text-ink-500">({m.ratings})</span></td>
                <td className="px-4 py-3">{m.sessionsCompleted}</td>
                <td className="px-4 py-3">{m.sessionCompletionRate}%</td>
                <td className="px-4 py-3">{m.goalCompletionRate}%</td>
                <td className="px-4 py-3">{m.avgResponseHours != null ? `${m.avgResponseHours} h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
