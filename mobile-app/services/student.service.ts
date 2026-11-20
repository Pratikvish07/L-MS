// Student-side data: profile, courses, enrolment requests, tests/assignments, submissions, marks.
// Collections (see firestore.rules): enrollments, enrollmentRequests, courses, coupons, subjects,
// assessments (+ /paper/main without answers), submissions, marks.
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import type { AppUser } from '@/types/auth.types';
import { firebaseStorage, firestore } from './firebase';

type OnError = (error: Error) => void;
const now = () => new Date().toISOString();

export interface StudentEnrollment { id: string; courseId: string; courseName: string; batchId: string; batchName: string; year: number; purchaseId: string; couponCode: string; enrolledAt: string; status: string; }
export interface PublicCourse { id: string; title: string; description?: string; category?: string; level?: string; imageUrl?: string; status?: string; }
export interface StudentCoupon { id: string; code: string; description: string; discountType: 'percentage' | 'fixed'; discountValue: number; courseIds: string[]; startsAt: string; endsAt: string; usageLimit: number; usedCount: number; active: boolean; }
export interface EnrollmentRequest { id: string; courseId: string; courseName: string; couponCode: string; status: 'pending' | 'approved' | 'rejected'; requestedAt: string; note?: string; }
export interface StudentSubject { id: string; name: string; code: string; courseId: string; instructorName?: string; }
export interface AssessmentFile { name: string; path: string; url: string; contentType: string; size: number; }
export interface StudentAssessment {
  id: string; type: 'test' | 'assignment'; courseId: string; subjectId: string; subjectName: string; batchIds: string[];
  title: string; instructions: string; date: string; durationMinutes: number; maxMarks: number; lectureTitle: string;
  files: AssessmentFile[]; questionCount: number; status: 'draft' | 'published';
}
export interface PaperQuestion { text: string; options: string[]; marks: number; }
export interface Submission {
  id: string; assessmentId: string; studentUid: string; answers: number[] | null; files: AssessmentFile[];
  status: 'submitted' | 'graded'; submittedAt: string; updatedAt: string;
}
export interface StudentMark { id: string; assessmentId: string; assessmentTitle: string; assessmentType: 'test' | 'assignment'; subjectName: string; marks: number | null; maxMarks: number; remarks: string; updatedAt: string; }

/* ---------------------------------------------------------------- profile */

export function updateMyProfile(uid: string, fields: { displayName: string; phone: string }) {
  return updateDoc(doc(firestore, 'users', uid), { displayName: fields.displayName.trim(), phone: fields.phone.trim() });
}

/* ---------------------------------------------------------- course access */

export function subscribeMyEnrollments(uid: string, onData: (rows: StudentEnrollment[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'enrollments'), where('studentUid', '==', uid)), (s) =>
    onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as StudentEnrollment).filter((e) => e.status === 'approved')), onError);
}

/** Published / active courses, open for enrolment. */
export function subscribeLiveCourses(onData: (rows: PublicCourse[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'courses'), where('status', 'in', ['active', 'published'])), (s) =>
    onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as PublicCourse).sort((a, b) => a.title.localeCompare(b.title))), onError);
}

export function subscribeCoupons(onData: (rows: StudentCoupon[]) => void, onError: OnError) {
  return onSnapshot(collection(firestore, 'coupons'), (s) => onData(s.docs.map((d) => {
    const x = d.data();
    return { id: d.id, code: String(x.code ?? d.id), description: String(x.description ?? ''), discountType: x.discountType === 'fixed' ? 'fixed' : 'percentage', discountValue: Number(x.discountValue ?? 0), courseIds: Array.isArray(x.courseIds) ? x.courseIds : [], startsAt: String(x.startsAt ?? ''), endsAt: String(x.endsAt ?? ''), usageLimit: Number(x.usageLimit ?? 0), usedCount: Number(x.usedCount ?? 0), active: x.active !== false } as StudentCoupon;
  })), onError);
}
const today = () => new Date().toLocaleDateString('en-CA');
export function couponUsable(c: StudentCoupon, courseId: string) {
  const d = today();
  return c.active && (!c.startsAt || d >= c.startsAt) && (!c.endsAt || d <= c.endsAt) && (!c.usageLimit || c.usedCount < c.usageLimit) && (!c.courseIds.length || c.courseIds.includes(courseId));
}
/** Offer text for a coupon, e.g. "20% off" or "₹500 off". */
export const couponOffer = (c: Pick<StudentCoupon, 'discountType' | 'discountValue'>) => (c.discountType === 'percentage' ? `${c.discountValue}% off` : `₹${c.discountValue} off`);

export function subscribeMyRequests(uid: string, onData: (rows: EnrollmentRequest[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'enrollmentRequests'), where('studentUid', '==', uid)), (s) => onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as EnrollmentRequest)), onError);
}
/** Asks the admin to enrol this student in a course; the admin picks the batch. */
export function requestEnrollment(student: AppUser, course: PublicCourse, couponCode: string) {
  return setDoc(doc(firestore, 'enrollmentRequests', `${student.uid}_${course.id}`), {
    studentUid: student.uid, studentName: student.displayName, studentEmail: student.email,
    courseId: course.id, courseName: course.title, couponCode: couponCode.trim().toUpperCase(), status: 'pending', requestedAt: now(),
  });
}

export function subscribeCourseSubjects(courseId: string, onData: (rows: StudentSubject[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'subjects'), where('courseId', '==', courseId)), (s) =>
    onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as StudentSubject).sort((a, b) => a.name.localeCompare(b.name))), onError);
}

/* ------------------------------------------------- tests and assignments */

function toAssessment(id: string, x: Record<string, unknown>): StudentAssessment {
  return {
    id, type: x.type === 'assignment' ? 'assignment' : 'test', courseId: String(x.courseId ?? ''), subjectId: String(x.subjectId ?? ''), subjectName: String(x.subjectName ?? ''),
    batchIds: Array.isArray(x.batchIds) ? x.batchIds.map(String) : [], title: String(x.title ?? ''), instructions: String(x.instructions ?? ''), date: String(x.date ?? ''),
    durationMinutes: Number(x.durationMinutes ?? 0), maxMarks: Number(x.maxMarks ?? 0), lectureTitle: String(x.lectureTitle ?? ''),
    files: Array.isArray(x.files) ? (x.files as AssessmentFile[]) : [], questionCount: Number(x.questionCount ?? 0), status: x.status === 'draft' ? 'draft' : 'published',
  };
}
/** Published tests and assignments for the student's batch, newest first. */
export function subscribeBatchAssessments(batchId: string, onData: (rows: StudentAssessment[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'assessments'), where('batchIds', 'array-contains', batchId)), (s) =>
    onData(s.docs.map((d) => toAssessment(d.id, d.data())).filter((a) => a.status === 'published').sort((a, b) => (b.date || '').localeCompare(a.date || ''))), onError);
}
export function subscribeAssessment(id: string, onData: (row: StudentAssessment | null) => void, onError: OnError) {
  return onSnapshot(doc(firestore, 'assessments', id), (s) => onData(s.exists() ? toAssessment(s.id, s.data()) : null), onError);
}
/** MCQs without the correct answers (assessments/{id}/paper/main, written by the Admin CMS). */
export async function getPaper(assessmentId: string): Promise<PaperQuestion[]> {
  const snapshot = await getDoc(doc(firestore, 'assessments', assessmentId, 'paper', 'main'));
  return snapshot.exists() && Array.isArray(snapshot.data().questions) ? (snapshot.data().questions as PaperQuestion[]) : [];
}

export const submissionId = (assessmentId: string, uid: string) => `${assessmentId}_${uid}`;
export function subscribeMySubmission(assessmentId: string, uid: string, onData: (row: Submission | null) => void, onError: OnError) {
  return onSnapshot(doc(firestore, 'submissions', submissionId(assessmentId, uid)), (s) => onData(s.exists() ? ({ ...s.data(), id: s.id } as Submission) : null), (e) => (e.code === 'permission-denied' ? onData(null) : onError(e)));
}
export function subscribeMySubmissions(uid: string, onData: (rows: Submission[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'submissions'), where('studentUid', '==', uid)), (s) => onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Submission)), onError);
}

/** Saves the student's MCQ choices (index per question, -1 = skipped) and/or uploaded files. */
export function submitAssessment(student: AppUser, assessment: StudentAssessment, batchId: string, fields: { answers?: number[]; files?: AssessmentFile[] }) {
  return setDoc(doc(firestore, 'submissions', submissionId(assessment.id, student.uid)), {
    assessmentId: assessment.id, assessmentTitle: assessment.title, assessmentType: assessment.type,
    courseId: assessment.courseId, subjectId: assessment.subjectId, batchId,
    studentUid: student.uid, studentName: student.displayName, studentEmail: student.email,
    ...(fields.answers ? { answers: fields.answers } : {}), ...(fields.files ? { files: fields.files } : {}),
    status: 'submitted', submittedAt: now(), updatedAt: now(), serverTime: serverTimestamp(),
  }, { merge: true });
}

/** Uploads one answer sheet / assignment file to the student's own submission folder. */
export async function uploadSubmissionFile(assessment: StudentAssessment, uid: string, file: { uri: string; name: string; mimeType: string; size: number }, onProgress?: (f: number) => void): Promise<AssessmentFile> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Files must be smaller than 25 MB.');
  const path = `courses/${assessment.courseId}/subjects/${assessment.subjectId}/assessments/${assessment.id}/submissions/${uid}/${Date.now()}-${file.name.replace(/[^\w.\- ]+/g, '_')}`;
  const blob = await (await fetch(file.uri)).blob();
  const task = uploadBytesResumable(ref(firebaseStorage, path), blob, { contentType: file.mimeType });
  await new Promise<void>((resolve, reject) => task.on('state_changed', (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve()));
  return { name: file.name, path, url: await getDownloadURL(task.snapshot.ref), contentType: file.mimeType, size: file.size || blob.size };
}

/* ------------------------------------------------------------------ marks */

export function subscribeMyMarks(uid: string, onData: (rows: StudentMark[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'marks'), where('studentUid', '==', uid)), (s) =>
    onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as StudentMark).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))), onError);
}

/* ---------------------------------------------------------- lecture views */

export interface LectureViewRow { id: string; recordingId: string; subjectId: string; lastViewedAt: string; views: number; }

/** Records that the student opened a lecture (lectureViews/{uid}_{recordingId}); the admin dashboard reads this. */
export async function markLectureViewed(student: AppUser, lecture: { id: string; courseId: string; batchId: string; subjectId: string }) {
  const ref = doc(firestore, 'lectureViews', `${student.uid}_${lecture.id}`);
  const existing = await getDoc(ref).catch(() => null);
  const views = existing?.exists() ? Number(existing.data().views ?? 0) + 1 : 1;
  await setDoc(ref, {
    studentUid: student.uid, recordingId: lecture.id, courseId: lecture.courseId, batchId: lecture.batchId, subjectId: lecture.subjectId,
    ...(existing?.exists() ? {} : { firstViewedAt: now() }), lastViewedAt: now(), views, completed: true,
  }, { merge: true });
  await updateDoc(doc(firestore, 'users', student.uid), { lastActiveAt: now() }).catch(() => undefined);
}

export function subscribeMyViews(uid: string, onData: (rows: LectureViewRow[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'lectureViews'), where('studentUid', '==', uid)), (s) =>
    onData(s.docs.map((d) => ({ ...d.data(), id: d.id }) as LectureViewRow)), onError);
}
