'use client';
import { useEffect, useMemo, useState } from 'react';
import { Compass, Search, SlidersHorizontal, X } from 'lucide-react';
import { MentorCard } from '@/components/MentorCard';
import { Stagger, StaggerItem } from '@/components/motion';
import { EmptyState, ErrorBox, PageHeader, Spinner, cx } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Mentor } from '@/lib/types';

type Facet = { value: string; count: number };
type Res = { total: number; mentors: Mentor[]; facets: { industries: Facet[]; departments: Facet[]; areas: Facet[]; tags: Facet[] } };

export default function DiscoverPage() {
  const { me } = useAuth();
  const isStudent = me?.user.role === 'student';
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [department, setDepartment] = useState('');
  const [minYears, setMinYears] = useState('');
  const [hasCapacity, setHasCapacity] = useState(true);
  const [sort, setSort] = useState(isStudent ? 'relevance' : 'experience');
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const limit = 12;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(0);
  }, [debouncedQ, industries, areas, tags, department, minYears, hasCapacity, sort]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set('q', debouncedQ);
    if (industries.length) p.set('industries', industries.join(','));
    if (areas.length) p.set('areas', areas.join(','));
    if (tags.length) p.set('tags', tags.join(','));
    if (department) p.set('department', department);
    if (minYears) p.set('minYears', minYears);
    p.set('hasCapacity', String(hasCapacity));
    p.set('sort', sort);
    p.set('limit', String(limit));
    p.set('offset', String(page * limit));
    return p.toString();
  }, [debouncedQ, industries, areas, tags, department, minYears, hasCapacity, sort, page]);

  const { data, loading, error } = useApi<Res>(`/mentors/search?${qs}`);
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const activeFilters = industries.length + areas.length + tags.length + (department ? 1 : 0) + (minYears ? 1 : 0);

  const FacetGroup = ({ title, items, value, onToggle, label }: { title: string; items: Facet[]; value: string[]; onToggle: (v: string) => void; label?: (v: string) => string }) => (
    <div>
      <h3 className="eyebrow mb-1.5 px-2">{title}</h3>
      <div className="space-y-1">
        {items.slice(0, 10).map((f) => (
          <label key={f.value} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-[13px] text-ink-700 transition-colors hover:bg-surface">
            <span className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-ink-300 text-brand-600" checked={value.includes(f.value)} onChange={() => onToggle(f.value)} />
              {label ? label(f.value) : f.value}
            </span>
            <span className="text-xs tabular-nums text-ink-400">{f.count}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        icon={Compass}
        eyebrow={isStudent ? 'Discover' : 'Directory'}
        title={isStudent ? 'Find your mentor' : 'Mentor directory'}
        subtitle={isStudent ? 'Ranked by fit with your goals. Only mentors who can take you on right now are shown — so every request reaches someone able to say yes.' : 'Verified alumni mentors.'}
      />

      <div className="sticky top-14 z-10 -mx-4 mb-5 border-b border-[color:var(--line)] bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-0">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1 sm:max-w-lg">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input h-11 pl-10 pr-10 text-[14px]" placeholder="Search by role, company or industry" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search mentors" />
            {q && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100" onClick={() => setQ('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <select className="input h-11 w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              {isStudent && <option value="relevance">Best match</option>}
              <option value="experience">Most experienced</option>
              <option value="capacity">Most open slots</option>
            </select>
            <button className="btn-secondary h-11 lg:hidden" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
              <SlidersHorizontal size={15} /> Filters{activeFilters ? ` · ${activeFilters}` : ''}
            </button>
          </div>
        </div>
        {activeFilters > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {[
              ...industries.map((v) => ({ k: `i-${v}`, label: v, clear: () => setIndustries(industries.filter((x) => x !== v)) })),
              ...areas.map((v) => ({ k: `a-${v}`, label: AREA_LABELS[v] ?? v, clear: () => setAreas(areas.filter((x) => x !== v)) })),
              ...tags.map((v) => ({ k: `t-${v}`, label: v, clear: () => setTags(tags.filter((x) => x !== v)) })),
              ...(department ? [{ k: 'd', label: department, clear: () => setDepartment('') }] : []),
              ...(minYears ? [{ k: 'y', label: `${minYears}+ years`, clear: () => setMinYears('') }] : []),
            ].map((c) => (
              <button key={c.k} className="chip chip-active" onClick={c.clear}>
                {c.label} <X size={11} />
              </button>
            ))}
            <button
              className="text-xs font-medium text-ink-500 underline-offset-2 hover:text-ink-800 hover:underline"
              onClick={() => {
                setIndustries([]);
                setAreas([]);
                setTags([]);
                setDepartment('');
                setMinYears('');
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-7 lg:grid-cols-[232px_1fr]">
        <aside className={cx('space-y-5 lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-48px)] lg:self-start lg:overflow-y-auto lg:pr-1', filtersOpen ? 'block' : 'hidden')}>
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-surface px-3 py-2.5 text-[13px] font-medium text-brand-900">
            Accepting mentees now
            <span className={cx('relative h-5 w-9 rounded-full transition-colors', hasCapacity ? 'bg-brand-500' : 'bg-ink-200')}>
              <input type="checkbox" checked={hasCapacity} onChange={(e) => setHasCapacity(e.target.checked)} className="peer absolute inset-0 cursor-pointer opacity-0" />
              <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', hasCapacity ? 'left-[18px]' : 'left-0.5')} />
            </span>
          </label>
          {data && (
            <>
              <FacetGroup title="Industry" items={data.facets.industries} value={industries} onToggle={(v) => toggle(industries, setIndustries, v)} />
              <FacetGroup title="Mentoring areas" items={data.facets.areas} value={areas} onToggle={(v) => toggle(areas, setAreas, v)} label={(v) => AREA_LABELS[v] ?? v} />
              <FacetGroup title="Expertise" items={data.facets.tags} value={tags} onToggle={(v) => toggle(tags, setTags, v)} />
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Department</h3>
                <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">Any department</option>
                  {data.facets.departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.value} ({d.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Experience</h3>
                <select className="input" value={minYears} onChange={(e) => setMinYears(e.target.value)}>
                  <option value="">Any</option>
                  <option value="3">3+ years</option>
                  <option value="5">5+ years</option>
                  <option value="10">10+ years</option>
                </select>
              </div>
            </>
          )}
        </aside>

        <div>
          <ErrorBox message={error} />
          <div className="mb-3 flex items-center gap-2 text-[13px] text-ink-500">
            {loading && <Spinner />}
            {data && (
              <span>
                <span className="font-semibold text-ink-900">{data.total}</span> mentor{data.total === 1 ? '' : 's'}
                {isStudent && sort === 'relevance' ? ' · best match first' : ''}
              </span>
            )}
          </div>
          {!data && loading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card space-y-3 p-5">
                  <div className="flex justify-between">
                    <div className="skeleton h-14 w-14 rounded-full" />
                    <div className="skeleton h-12 w-12 rounded-full" />
                  </div>
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-4/5" />
                  <div className="skeleton h-6 w-1/2" />
                </div>
              ))}
            </div>
          )}
          {data && data.mentors.length === 0 ? (
            <EmptyState title="No mentors match these filters" body={hasCapacity ? 'Try removing a filter, or include mentors who are currently full.' : 'Try removing a filter.'} />
          ) : (
            <Stagger key={qs} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data?.mentors.map((m, i) => (
                <StaggerItem key={m.id} className="h-full">
                  <MentorCard m={m} topMatch={isStudent && sort === 'relevance' && page === 0 && i === 0 && !!m.match && m.match.score >= 60} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
          {data && data.total > limit && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span className="text-sm text-ink-500">
                Page {page + 1} of {Math.ceil(data.total / limit)}
              </span>
              <button className="btn-secondary" disabled={(page + 1) * limit >= data.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
