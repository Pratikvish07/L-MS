import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHead } from '../components/Layout';
import { dayKey, downloadCsv, formatBytes, formatDuration } from '../lib/format';
import { useStore } from '../lib/store';
import type { Recording } from '../lib/types';

interface Row {
  key: string;
  total: number;
  uploaded: number;
  published: number;
  failed: number;
  seconds: number;
  bytes: number;
}

function aggregate(recordings: Recording[], keyOf: (r: Recording) => string): Row[] {
  const map = new Map<string, Row>();
  for (const r of recordings) {
    const key = keyOf(r) || 'Unknown';
    const row = map.get(key) ?? { key, total: 0, uploaded: 0, published: 0, failed: 0, seconds: 0, bytes: 0 };
    row.total += 1;
    if (r.status === 'uploaded' || r.status === 'published') row.uploaded += 1;
    if (r.publicationStatus === 'published') row.published += 1;
    if (r.status === 'failed') row.failed += 1;
    row.seconds += r.durationSeconds;
    row.bytes += r.fileSizeBytes;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function ReportsPage() {
  const { recordings } = useStore();
  const [groupBy, setGroupBy] = useState<'faculty' | 'classroom' | 'class' | 'subject'>('faculty');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const rows = useMemo(() => {
    const inRange = recordings.filter((r) => {
      const d = r.recordedAt ? dayKey(r.recordedAt) : '';
      return (!from || d >= from) && (!to || d <= to);
    });
    const keyOf: Record<typeof groupBy, (r: Recording) => string> = {
      faculty: (r) => r.facultyName,
      classroom: (r) => r.classroomName,
      class: (r) => r.className,
      subject: (r) => r.subjectName || r.className,
    };
    return aggregate(inRange, keyOf[groupBy]);
  }, [recordings, groupBy, from, to]);

  const label = { faculty: 'Faculty', classroom: 'Classroom', class: 'Class', subject: 'Subject' }[groupBy];

  const exportCsv = () =>
    downloadCsv(`lms-report-by-${groupBy}.csv`, [
      [label, 'Recordings', 'Uploaded', 'Published', 'Failed', 'Total duration (min)', 'Total size (MB)'],
      ...rows.map((r) => [r.key, r.total, r.uploaded, r.published, r.failed, Math.round(r.seconds / 60), Math.round(r.bytes / 1048576)]),
    ]);

  return (
    <>
      <PageHead title="Reports" subtitle="Recording activity and upload reliability">
        <button className="btn btn-outline" onClick={exportCsv} disabled={!rows.length}>
          <Download size={16} /> Export CSV
        </button>
      </PageHead>
      <section className="card">
        <div className="toolbar">
          <div className="seg" role="tablist" aria-label="Group by">
            {(['faculty', 'subject', 'class', 'classroom'] as const).map((g) => (
              <button key={g} role="tab" aria-selected={groupBy === g} className={groupBy === g ? 'active' : ''} onClick={() => setGroupBy(g)}>
                By {g}
              </button>
            ))}
          </div>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span>From</span>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <span>To</span>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{label}</th>
                <th>Recordings</th>
                <th>Uploaded</th>
                <th>Published</th>
                <th>Failed</th>
                <th>Success rate</th>
                <th>Total duration</th>
                <th>Total size</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="empty">No recordings in this period.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="cell-title">{r.key}</td>
                  <td>{r.total}</td>
                  <td>{r.uploaded}</td>
                  <td>{r.published}</td>
                  <td>{r.failed}</td>
                  <td>{r.total ? `${Math.round((r.uploaded / r.total) * 100)}%` : '—'}</td>
                  <td>{formatDuration(r.seconds)}</td>
                  <td>{formatBytes(r.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
