import { Check, Inbox, X } from 'lucide-react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { enrollStudents, type CourseBatch } from '../lib/courses';
import { firestore } from '../lib/firebase';
import { formatDateTime } from '../lib/format';

interface RequestRow { id: string; studentUid: string; studentName: string; studentEmail: string; courseId: string; couponCode: string; status: string; requestedAt: string; }

/** Students who asked to join this course from the student app. Approve = enrol into a batch. */
export function EnrollmentRequests({ courseId, batches }: { courseId: string; batches: CourseBatch[] }) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [batchFor, setBatchFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onSnapshot(query(collection(firestore, 'enrollmentRequests'), where('courseId', '==', courseId)), (s) => {
    setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as RequestRow).filter((r) => r.status === 'pending').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)));
  }, () => setRows([])), [courseId]);

  if (!rows.length) return null;

  const approve = async (row: RequestRow) => {
    const batchId = batchFor[row.id] || batches[0]?.id;
    if (!batchId) { setError('Create a batch first.'); return; }
    setBusy(row.id); setError('');
    try {
      const [result] = await enrollStudents(courseId, batchId, [{ name: row.studentName, email: row.studentEmail }], row.couponCode);
      if (result.status === 'error') throw new Error(`${row.studentEmail}: ${result.message}`);
      await updateDoc(doc(firestore, 'enrollmentRequests', row.id), { status: 'approved', batchId, purchaseId: result.purchaseId ?? '', decidedAt: new Date().toISOString() });
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(''); }
  };
  const reject = async (row: RequestRow) => {
    const note = window.prompt(`Decline ${row.studentName}'s request? Optional note for the student:`, '');
    if (note === null) return;
    setBusy(row.id);
    try { await updateDoc(doc(firestore, 'enrollmentRequests', row.id), { status: 'rejected', note, decidedAt: new Date().toISOString() }); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(''); }
  };

  return (
    <section className="card" style={{ marginBottom: 18, borderColor: 'var(--amber)' }}>
      <div className="toolbar"><Inbox size={18} aria-hidden /><strong style={{ flex: 1 }}>Enrolment requests ({rows.length})</strong><span className="cell-sub">From the student app</span></div>
      {error && <div className="alert" role="alert" style={{ margin: 16 }}>{error}</div>}
      <div className="table-wrap"><table>
        <thead><tr><th>Student</th><th>Requested</th><th>Coupon</th><th>Batch</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><div className="cell-title">{row.studentName}</div><div className="cell-sub">{row.studentEmail}</div></td>
              <td>{formatDateTime(row.requestedAt)}</td>
              <td>{row.couponCode ? <code>{row.couponCode}</code> : '—'}</td>
              <td><select className="input" style={{ maxWidth: 200 }} aria-label="Batch" value={batchFor[row.id] ?? batches[0]?.id ?? ''} onChange={(e) => setBatchFor((cur) => ({ ...cur, [row.id]: e.target.value }))}>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>
              <td><div className="actions">
                <button className="btn btn-sm" disabled={busy === row.id} onClick={() => void approve(row)}><Check size={14} /> Approve</button>
                <button className="btn btn-soft-danger btn-sm" disabled={busy === row.id} onClick={() => void reject(row)}><X size={14} /> Decline</button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </section>
  );
}
