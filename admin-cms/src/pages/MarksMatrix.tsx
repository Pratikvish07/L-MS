import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { csvCell, downloadCsv, friendlyError, subscribeBatchMarks, type Assessment, type MarkEntry } from '../lib/assessments';
import type { CourseBatch, Enrollment } from '../lib/courses';

const pct = (got: number, max: number) => (max ? Math.round((got / max) * 1000) / 10 : 0);
const grade = (p: number) => (p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'F');

/**
 * Students × tests/assignments for one batch: marks, total, percentage, grade.
 * Pass `fixedBatchId` to lock the batch (batch page); otherwise a batch picker is shown.
 */
export function MarksMatrix({ assessments, batches, enrollments, fixedBatchId }: { assessments: Assessment[]; batches: CourseBatch[]; enrollments: Enrollment[]; fixedBatchId?: string }) {
  const [chosen, setChosen] = useState('');
  const batchId = fixedBatchId || chosen || batches[0]?.id || '';
  const [marks, setMarks] = useState<MarkEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setMarks([]);
    if (!batchId) return;
    return subscribeBatchMarks(batchId, setMarks, (cause) => setError(friendlyError(cause)));
  }, [batchId]);

  const columns = useMemo(() => assessments.filter((a) => a.batchIds.includes(batchId)).sort((a, b) => (a.date || a.createdAt).localeCompare(b.date || b.createdAt)), [assessments, batchId]);
  const students = useMemo(() => enrollments.filter((e) => e.batchId === batchId).sort((a, b) => a.studentName.localeCompare(b.studentName)), [enrollments, batchId]);
  const cell = useMemo(() => new Map(marks.map((m) => [`${m.assessmentId}_${m.studentUid}`, m])), [marks]);

  const rows = students.map((student) => {
    let got = 0;
    let max = 0;
    for (const a of columns) {
      const entry = cell.get(`${a.id}_${student.studentUid}`);
      if (entry && entry.marks !== null) { got += entry.marks; max += a.maxMarks; }
    }
    return { student, got, max, percent: pct(got, max) };
  });
  const columnAverage = (a: Assessment) => {
    const values = students.map((s) => cell.get(`${a.id}_${s.studentUid}`)?.marks).filter((v): v is number => typeof v === 'number');
    return values.length ? Math.round((values.reduce((x, y) => x + y, 0) / values.length) * 10) / 10 : null;
  };

  const exportCsv = () => {
    const header = ['Student', 'Email', 'Purchase ID', ...columns.map((a) => `${a.title} (/${a.maxMarks})`), 'Total', 'Out of', 'Percent', 'Grade'];
    const lines = rows.map(({ student, got, max, percent }) => [student.studentName, student.studentEmail, student.purchaseId, ...columns.map((a) => cell.get(`${a.id}_${student.studentUid}`)?.marks ?? ''), got, max, max ? percent : '', max ? grade(percent) : ''].map(csvCell).join(','));
    downloadCsv(`marks-${batches.find((b) => b.id === batchId)?.name ?? batchId}.csv`, [header.map(csvCell).join(','), ...lines].join('\n'));
  };

  return (
    <section className="card">
      <div className="toolbar">
        <strong style={{ flex: 1 }}>Marks{fixedBatchId ? '' : ' by batch'}</strong>
        {!fixedBatchId && <select className="input" style={{ maxWidth: 240 }} aria-label="Batch" value={batchId} onChange={(e) => setChosen(e.target.value)}>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
        <button className="btn btn-outline" disabled={!students.length} onClick={exportCsv}><Download size={14} /> Export CSV</button>
      </div>
      {error && <div className="alert" role="alert" style={{ margin: 16 }}>{error}</div>}
      <div className="table-wrap"><table className="marks-table">
        <thead>
          <tr>
            <th>Student</th>
            {columns.map((a) => <th key={a.id} title={a.title}><span className={`icon-chip ${a.type === 'test' ? 'info' : 'ok'}`}>{a.type === 'test' ? 'T' : 'A'}</span> {a.title}<div className="cell-sub">/{a.maxMarks}</div></th>)}
            <th>Total</th><th>%</th><th>Grade</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, got, max, percent }) => (
            <tr key={student.id}>
              <td><Link className="cell-title link" to={`/students/${student.studentUid}`}>{student.studentName}</Link><div className="cell-sub">{student.studentEmail}</div></td>
              {columns.map((a) => {
                const entry = cell.get(`${a.id}_${student.studentUid}`);
                const value = entry?.marks;
                return <td key={a.id} className={typeof value === 'number' ? (pct(value, a.maxMarks) < 40 ? 'mark-low' : '') : 'cell-sub'} title={entry?.remarks || undefined}>{typeof value === 'number' ? value : '—'}</td>;
              })}
              <td><strong>{max ? `${got} / ${max}` : '—'}</strong></td>
              <td>{max ? `${percent}%` : '—'}</td>
              <td>{max ? <span className={`grade grade-${grade(percent).replace('+', 'p')}`}>{grade(percent)}</span> : '—'}</td>
            </tr>
          ))}
          {students.length > 0 && columns.length > 0 && (
            <tr className="marks-avg"><td>Class average</td>{columns.map((a) => <td key={a.id}>{columnAverage(a) ?? '—'}</td>)}<td colSpan={3} /></tr>
          )}
          {!students.length && <tr><td className="empty" colSpan={columns.length + 4}>No students in this batch yet.</td></tr>}
          {students.length > 0 && !columns.length && <tr><td className="empty" colSpan={4}>No tests or assignments for this batch yet.</td></tr>}
        </tbody>
      </table></div>
      <p className="cell-sub" style={{ padding: '0 16px 14px', margin: 0 }}>Enter marks on each test or assignment. Totals count only marked work. Red = below 40%.</p>
    </section>
  );
}
