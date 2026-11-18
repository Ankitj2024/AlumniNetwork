'use client';
import { Database } from 'lucide-react';
import { useState } from 'react';
import { Card, PageHeader, Spinner, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { useApi } from '@/lib/hooks';

const SAMPLE = 'rollNumber,fullName,graduationYear,degree,department,dateOfBirth\n2019CS123,Jane Doe,2019,B.Tech,Computer Science & Engineering,1997-02-14';

export default function RecordsPage() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const { data, reload } = useApi<{ total: number; records: any[] }>(`/alumni/records?q=${encodeURIComponent(q)}`);
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);

  async function importCsv() {
    setBusy(true);
    try {
      const r = await post<{ imported: number; created: number; updated: number }>('/alumni/records/import', { csv });
      toast(`Imported ${r.imported} rows (${r.created} new, ${r.updated} updated)`);
      setCsv('');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader icon={Database} eyebrow="Data" title="Institution records" subtitle="The alumni register that verification claims are matched against. Import from your ERP as CSV." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title={`Records (${data?.total ?? '…'})`} actions={<input className="input w-56 py-1.5" placeholder="Search name or roll no." value={q} onChange={(e) => setQ(e.target.value)} />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase text-ink-500">
                <tr>
                  <th className="py-2 pr-3">Roll no.</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Year</th>
                  <th className="py-2 pr-3">Programme</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {data?.records.map((r) => (
                  <tr key={r.id} className="border-t border-ink-100">
                    <td className="py-2 pr-3 font-mono text-xs">{r.rollNumber}</td>
                    <td className="py-2 pr-3">{r.fullName}</td>
                    <td className="py-2 pr-3">{r.graduationYear}</td>
                    <td className="py-2 pr-3 text-ink-600">
                      {r.degree} {r.department}
                    </td>
                    <td className="py-2 text-xs text-ink-500">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Import CSV">
          <p className="mb-2 text-xs text-ink-500">Required columns: rollNumber, fullName, graduationYear, degree, department. Optional: dateOfBirth (YYYY-MM-DD). Existing roll numbers are updated.</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="input mb-2"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
          />
          <textarea className="input min-h-[180px] font-mono text-xs" placeholder={SAMPLE} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <button className="btn-primary mt-3 w-full" disabled={busy || csv.length < 10} onClick={importCsv}>
            {busy && <Spinner />} Import
          </button>
        </Card>
      </div>
    </>
  );
}
