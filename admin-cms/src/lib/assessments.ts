// Tests and assignments of a subject, their MCQs, files and marks.
//
//   assessments/{id}                       test or assignment (course + subject + batches)
//   assessments/{id}/questions/{qid}       MCQs (admin/staff only: holds the correct answers)
//   marks/{assessmentId}_{studentUid}      one student's marks for one test/assignment
//   Storage: courses/{courseId}/subjects/{subjectId}/assessments/{id}/{file}
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { firebaseAuth, firebaseStorage, firestore } from './firebase';

type OnError = (error: Error) => void;
const now = () => new Date().toISOString();

export type AssessmentType = 'test' | 'assignment';

export interface AssessmentFile { name: string; path: string; url: string; contentType: string; size: number; uploadedAt: string; }

export interface Assessment {
  id: string;
  type: AssessmentType;
  courseId: string;
  subjectId: string;
  subjectName: string;
  batchIds: string[];
  title: string;
  instructions: string;
  /** Test: date it is held. Assignment: due date. yyyy-mm-dd */
  date: string;
  durationMinutes: number;
  maxMarks: number;
  /** Assignment based on a lecture (optional). */
  lectureId: string;
  lectureTitle: string;
  files: AssessmentFile[];
  questionCount: number;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface McqQuestion { id: string; order: number; text: string; options: string[]; correctIndex: number; marks: number; }

export interface MarkEntry {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  subjectId: string;
  subjectName: string;
  batchId: string;
  /** null = not marked yet / absent. */
  marks: number | null;
  maxMarks: number;
  remarks: string;
  updatedAt: string;
}

function toAssessment(id: string, data: Record<string, unknown>): Assessment {
  return {
    id, type: data.type === 'assignment' ? 'assignment' : 'test',
    courseId: String(data.courseId ?? ''), subjectId: String(data.subjectId ?? ''), subjectName: String(data.subjectName ?? ''),
    batchIds: Array.isArray(data.batchIds) ? data.batchIds.map(String) : [],
    title: String(data.title ?? ''), instructions: String(data.instructions ?? ''), date: String(data.date ?? ''),
    durationMinutes: Number(data.durationMinutes ?? 0), maxMarks: Number(data.maxMarks ?? 0),
    lectureId: String(data.lectureId ?? ''), lectureTitle: String(data.lectureTitle ?? ''),
    files: Array.isArray(data.files) ? (data.files as AssessmentFile[]) : [], questionCount: Number(data.questionCount ?? 0),
    status: data.status === 'draft' ? 'draft' : 'published', createdAt: String(data.createdAt ?? ''), updatedAt: String(data.updatedAt ?? ''),
  };
}
const byDate = (a: Assessment, b: Assessment) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt);

export function subscribeSubjectAssessments(subjectId: string, onData: (rows: Assessment[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'assessments'), where('subjectId', '==', subjectId)), (s) => onData(s.docs.map((d) => toAssessment(d.id, d.data())).sort(byDate)), onError);
}
export function subscribeBatchAssessments(batchId: string, onData: (rows: Assessment[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'assessments'), where('batchIds', 'array-contains', batchId)), (s) => onData(s.docs.map((d) => toAssessment(d.id, d.data())).sort(byDate)), onError);
}
export function subscribeAssessment(id: string, onData: (row: Assessment | null) => void, onError: OnError) {
  return onSnapshot(doc(firestore, 'assessments', id), (s) => onData(s.exists() ? toAssessment(s.id, s.data()) : null), onError);
}
export function subscribeQuestions(assessmentId: string, onData: (rows: McqQuestion[]) => void, onError: OnError) {
  return onSnapshot(collection(firestore, 'assessments', assessmentId, 'questions'), (s) => onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as McqQuestion).sort((a, b) => a.order - b.order)), onError);
}

export const newAssessmentId = () => doc(collection(firestore, 'assessments')).id;

export async function saveAssessment(id: string, fields: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt'>, isNew: boolean) {
  await setDoc(doc(firestore, 'assessments', id), { ...fields, title: fields.title.trim(), updatedAt: now(), ...(isNew ? { createdAt: now(), createdBy: firebaseAuth.currentUser?.uid ?? '' } : {}) }, { merge: true });
}

/** Replaces all MCQs of an assessment and updates questionCount (and maxMarks to their total). */
export async function replaceQuestions(assessmentId: string, questions: Omit<McqQuestion, 'id'>[]) {
  const existing = await getDocs(collection(firestore, 'assessments', assessmentId, 'questions'));
  const batch = writeBatch(firestore);
  existing.docs.forEach((item) => batch.delete(item.ref));
  questions.forEach((question, index) => batch.set(doc(collection(firestore, 'assessments', assessmentId, 'questions')), { ...question, order: index + 1 }));
  batch.set(doc(firestore, 'assessments', assessmentId), { questionCount: questions.length, maxMarks: questions.reduce((sum, q) => sum + q.marks, 0), updatedAt: now() }, { merge: true });
  // What students see: same questions and options, no correct answers.
  batch.set(doc(firestore, 'assessments', assessmentId, 'paper', 'main'), { questions: questions.map((q) => ({ text: q.text, options: q.options, marks: q.marks })), updatedAt: now() });
  await batch.commit();
}

export async function deleteAssessment(assessment: Assessment) {
  const [questions, marks] = await Promise.all([
    getDocs(collection(firestore, 'assessments', assessment.id, 'questions')),
    getDocs(query(collection(firestore, 'marks'), where('assessmentId', '==', assessment.id))),
  ]);
  const batch = writeBatch(firestore);
  questions.docs.forEach((item) => batch.delete(item.ref));
  marks.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(doc(firestore, 'assessments', assessment.id, 'paper', 'main'));
  batch.delete(doc(firestore, 'assessments', assessment.id));
  await batch.commit();
  await Promise.all(assessment.files.map((file) => deleteObject(ref(firebaseStorage, file.path)).catch(() => undefined)));
}

export const ASSESSMENT_FILE_TYPES = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function uploadAssessmentFile(assessment: Pick<Assessment, 'courseId' | 'subjectId'>, assessmentId: string, file: File, onProgress?: (fraction: number) => void): Promise<AssessmentFile> {
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} is larger than 25 MB.`);
  const path = `courses/${assessment.courseId}/subjects/${assessment.subjectId}/assessments/${assessmentId}/${Date.now()}-${file.name.replace(/[^\w.\- ]+/g, '_')}`;
  const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type || 'application/octet-stream' });
  await new Promise<void>((resolve, reject) => task.on('state_changed', (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve()));
  return { name: file.name, path, url: await getDownloadURL(task.snapshot.ref), contentType: file.type, size: file.size, uploadedAt: now() };
}
export const removeAssessmentFile = (file: AssessmentFile) => deleteObject(ref(firebaseStorage, file.path)).catch(() => undefined);

/* ------------------------------------------------------------------ marks */

export function subscribeAssessmentMarks(assessmentId: string, onData: (rows: MarkEntry[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'marks'), where('assessmentId', '==', assessmentId)), (s) => onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as MarkEntry)), onError);
}
export function subscribeBatchMarks(batchId: string, onData: (rows: MarkEntry[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'marks'), where('batchId', '==', batchId)), (s) => onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as MarkEntry)), onError);
}
export function subscribeStudentMarks(studentUid: string, onData: (rows: MarkEntry[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'marks'), where('studentUid', '==', studentUid)), (s) => onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as MarkEntry)), onError);
}

/** Saves many students' marks for one assessment in one batch write. */
export async function saveMarks(assessment: Assessment, rows: Omit<MarkEntry, 'id' | 'assessmentId' | 'assessmentTitle' | 'assessmentType' | 'courseId' | 'subjectId' | 'subjectName' | 'maxMarks' | 'updatedAt'>[]) {
  for (const row of rows) {
    if (row.marks !== null && (Number.isNaN(row.marks) || row.marks < 0 || row.marks > assessment.maxMarks)) throw new Error(`${row.studentName}: marks must be between 0 and ${assessment.maxMarks}.`);
  }
  const batch = writeBatch(firestore);
  for (const row of rows) {
    batch.set(doc(firestore, 'marks', `${assessment.id}_${row.studentUid}`), {
      ...row, assessmentId: assessment.id, assessmentTitle: assessment.title, assessmentType: assessment.type,
      courseId: assessment.courseId, subjectId: assessment.subjectId, subjectName: assessment.subjectName,
      maxMarks: assessment.maxMarks, updatedAt: now(), gradedBy: firebaseAuth.currentUser?.uid ?? '',
    }, { merge: true });
  }
  await batch.commit();
}
export const clearMark = (assessmentId: string, studentUid: string) => deleteDoc(doc(firestore, 'marks', `${assessmentId}_${studentUid}`));

/* ------------------------------------------------------------- MCQ upload */

export const MCQ_CSV_SAMPLE = 'question,optionA,optionB,optionC,optionD,correct,marks\n"What is 2 + 2?",3,4,5,6,B,1\n"Which is a prime number?",4,6,7,9,C,1\n"Derivative of x²?",x,2x,x²,2,B,2\n';

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * Columns: question, optionA..optionF (at least 2), correct (A–F or the option text), marks (default 1).
 */
export function parseMcqCsv(text: string): { questions: Omit<McqQuestion, 'id'>[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { questions: [], errors: ['The file is empty.'] };
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const qi = headers.indexOf('question');
  const ci = headers.indexOf('correct');
  const mi = headers.indexOf('marks');
  const optionCols = headers.map((h, i) => (/^option[a-f]$/.test(h) ? i : -1)).filter((i) => i >= 0);
  if (qi < 0 || ci < 0 || optionCols.length < 2) return { questions: [], errors: ['Header must include question, optionA, optionB (up to optionF), correct and marks. Download the sample.'] };
  const questions: Omit<McqQuestion, 'id'>[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line);
    const row = index + 2;
    const textValue = cells[qi] ?? '';
    const options = optionCols.map((i) => cells[i] ?? '').filter(Boolean);
    const correct = (cells[ci] ?? '').trim();
    if (!textValue) { errors.push(`Row ${row}: question is empty.`); return; }
    if (options.length < 2) { errors.push(`Row ${row}: needs at least two options.`); return; }
    let correctIndex = /^[a-f]$/i.test(correct) ? correct.toUpperCase().charCodeAt(0) - 65 : options.findIndex((o) => o.toLowerCase() === correct.toLowerCase());
    if (correctIndex < 0 || correctIndex >= options.length) { errors.push(`Row ${row}: "correct" must be a letter A–${String.fromCharCode(64 + options.length)} or the text of an option.`); correctIndex = -1; }
    const marks = mi >= 0 && cells[mi] ? Number(cells[mi]) : 1;
    if (!Number.isFinite(marks) || marks <= 0) { errors.push(`Row ${row}: marks must be a positive number.`); return; }
    if (correctIndex >= 0) questions.push({ order: questions.length + 1, text: textValue, options, correctIndex, marks });
  });
  return { questions, errors };
}

export function downloadCsv(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}
export const csvCell = (value: unknown) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };

export const filePreviewUrl = (file: Pick<AssessmentFile, 'url' | 'contentType'>) =>
  file.contentType === 'application/pdf' ? file.url : `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url)}`;

/** Firestore error → message. Permission errors mean the server is still on older rules. */
export function friendlyError(cause: { code?: string; message: string }) {
  return cause.code === 'permission-denied'
    ? 'Blocked by the Firestore rules on the server: publish the latest firestore.rules (Firebase console → Firestore Database → Rules → Publish), wait a minute and reload.'
    : cause.message;
}
