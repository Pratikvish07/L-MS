import { Download, FileText, Sparkles } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';

import { Pill } from '../components/ui';
import { filePreviewUrl, friendlyError, saveMarks, type Assessment, type AssessmentFile, type MarkEntry, type McqQuestion } from '../lib/assessments';
import { firestore } from '../lib/firebase';
import { formatDateTime } from '../lib/format';

export interface SubmissionRow {
  id: string; assessmentId: string; batchId: string; studentUid: string; studentName: string; studentEmail: string;
  answers?: number[]; files?: AssessmentFile[]; submittedAt: string; status: string;
}

/** Score = sum of marks of questions answered with the correct option. */
export const scoreAnswers = (questions: McqQuestion[], answers: number[] = []) =>
  questions.reduce((sum, q, i) => sum + (answers[i] === q.correctIndex ? q.marks : 0), 0);

/** Student submissions for one test/assignment: files, quiz answers, and one-click auto-grading. */
export function SubmissionsPanel({ assessment, questions, marks, batchName }: { assessment: Assessment; questions: McqQuestion[]; marks: MarkEntry[]; batchName: (id: string) => string }) {
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => onSnapshot(query(collection(firestore, 'submissions'), where('assessmentId', '==', assessment.id)), (s) => {
    setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }) as SubmissionRow).sort((a, b) => a.studentName.localeCompare(b.studentName)));
  }, (cause) => { setRows([]); setError(friendlyError(cause)); }), [assessment.id]);

  const marked = useMemo(() => new Map(marks.map((m) => [m.studentUid, m])), [marks]);
  const quizRows = (rows ?? []).filter((r) => Array.isArray(r.answers));
  const ungraded = quizRows.filter((r) => marked.get(r.studentUid)?.marks == null);

  const autoGrade = async (all: boolean) => {
    const target = all ? quizRows : ungraded;
    if (!questions.length || !target.length) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await saveMarks(assessment, target.map((r) => ({
        studentUid: r.studentUid, studentName: r.studentName, studentEmail: r.studentEmail, batchId: r.batchId,
        marks: scoreAnswers(questions, r.answers), remarks: marked.get(r.studentUid)?.remarks || 'Auto-graded quiz',
      })));
      setNotice(`Graded ${target.length} quiz${target.length === 1 ? '' : 'zes'}. Students can now see their marks.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(false); }
  };

  const exportCsv = () => {
    const lines = ['name,email,batch,submittedAt,files,score', ...(rows ?? []).map((r) => [r.studentName, r.studentEmail, batchName(r.batchId), r.submittedAt, (r.files ?? []).map((f) => f.url).join(' '), r.answers ? scoreAnswers(questions, r.answers) : ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `${assessment.title}-submissions.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <div className="toolbar">
        <strong style={{ flex: 1 }}>{rows?.length ?? 0} submission{rows?.length === 1 ? '' : 's'}</strong>
        {questions.length > 0 && <>
          <button className="btn" disabled={busy || !ungraded.length} onClick={() => void autoGrade(false)}><Sparkles size={14} /> {busy ? 'Grading…' : `Auto-grade ${ungraded.length} new`}</button>
          <button className="btn btn-outline btn-sm" disabled={busy || !quizRows.length} onClick={() => void autoGrade(true)}>Re-grade all</button>
        </>}
        <button className="btn btn-outline btn-sm" disabled={!rows?.length} onClick={exportCsv}><Download size={14} /> Export</button>
      </div>
      {error && <div className="alert" role="alert" style={{ margin: 16 }}>{error}</div>}
      {notice && <div className="notice" role="status" style={{ margin: 16 }}>{notice}</div>}
      <div className="table-wrap"><table>
        <thead><tr><th>Student</th><th>Batch</th><th>Submitted</th><th>{questions.length ? 'Quiz score' : 'Files'}</th><th>Marks</th></tr></thead>
        <tbody>
          {(rows ?? []).map((r) => {
            const mark = marked.get(r.studentUid);
            return (
              <tr key={r.id}>
                <td><div className="cell-title">{r.studentName}</div><div className="cell-sub">{r.studentEmail}</div></td>
                <td>{batchName(r.batchId)}</td>
                <td>{r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</td>
                <td>
                  {r.answers && questions.length ? <strong>{scoreAnswers(questions, r.answers)} / {assessment.maxMarks}</strong> : null}
                  {(r.files ?? []).map((f) => <div key={f.path}><a className="link" href={filePreviewUrl(f)} target="_blank" rel="noreferrer"><FileText size={13} aria-hidden /> {f.name}</a></div>)}
                  {!r.answers && !(r.files ?? []).length && <span className="cell-sub">—</span>}
                </td>
                <td>{mark?.marks != null ? <Pill tone="green">{mark.marks} / {mark.maxMarks}</Pill> : <Pill tone="amber">Not marked</Pill>}</td>
              </tr>
            );
          })}
          {rows && !rows.length && <tr><td className="empty" colSpan={5}>No submissions yet. Students submit from the student app.</td></tr>}
        </tbody>
      </table></div>
      <p className="cell-sub" style={{ padding: '0 16px 14px', margin: 0 }}>{questions.length ? 'Auto-grade compares each answer with the answer key and saves the marks; adjust any of them under Marks entry.' : 'Open the files, then enter marks under Marks entry.'}</p>
    </section>
  );
}
