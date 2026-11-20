// Course → Batch → Subject data used by the Course page.
// Collections: courses, batches (courseId), subjects (courseId), enrollments (`${studentUid}_${courseId}`).
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, runTransaction, setDoc, where, type Transaction } from 'firebase/firestore';

import { couponProblem, normalizeCode, toCoupon, type Coupon } from './coupons';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { createManagedAccount, existingAccountUid, firebaseAuth, firebaseStorage, firestore } from './firebase';

type OnError = (error: Error) => void;
const now = () => new Date().toISOString();

export interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  level?: string;
  delivery?: string;
  imageUrl?: string;
  status?: string;
}

export interface CourseBatch {
  id: string;
  courseId: string;
  name: string;
  year: number;
  classroomId: string;
  classroomName: string;
  capacity: number;
  startDate: string;
  endDate: string;
  active: boolean;
  /** Instructor per subject for this batch: subjectId → instructor. */
  subjectInstructors?: Record<string, { uid: string; name: string }>;
  /** Every instructor teaching in this batch (for "my batches" queries in the instructor app). */
  instructorUids?: string[];
}

export interface CourseSubject {
  id: string;
  courseId: string;
  name: string;
  code: string;
  year: number;
  description: string;
  /** Default instructor for every batch (from Instructor Master); a batch can override it. */
  instructorUid?: string;
  instructorName?: string;
  /** Everyone teaching this subject: the default plus batch overrides. Used by the instructor app. */
  facultyUids: string[];
  facultyNames: string[];
  active: boolean;
}

export interface Enrollment {
  id: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseName: string;
  batchId: string;
  batchName: string;
  year: number;
  purchaseId: string;
  status: string;
  couponCode: string;
  enrolledAt: string;
}

export interface StudentRow { name: string; email: string; phone?: string; password?: string; }
export interface EnrollResult { email: string; status: 'created' | 'enrolled' | 'moved' | 'error'; purchaseId?: string; password?: string; message?: string; couponCode?: string; }

function listen<T>(path: string, courseId: string, onData: (rows: T[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, path), where('courseId', '==', courseId)), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T));
  }, onError);
}

export function subscribeCourse(id: string, onData: (course: Course | null) => void, onError: OnError) {
  return onSnapshot(doc(firestore, 'courses', id), (snapshot) => onData(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as Course) : null), onError);
}
export function saveCourse(id: string, fields: Partial<Omit<Course, 'id'>>) {
  return setDoc(doc(firestore, 'courses', id), { ...fields, updatedAt: now() }, { merge: true });
}
export async function createCourse(fields: Omit<Course, 'id'>) {
  const ref = doc(collection(firestore, 'courses'));
  await setDoc(ref, { ...fields, title: fields.title.trim(), createdAt: now(), updatedAt: now() });
  return ref.id;
}
export const deleteCourse = (id: string) => deleteDoc(doc(firestore, 'courses', id));

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/** Uploads a course image to Storage public/courses/ (publicly readable) and returns its URL. */
export async function uploadCourseImage(file: File, onProgress?: (fraction: number) => void) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG, WebP or GIF image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('The image must be smaller than 5 MB.');
  const path = `public/courses/${Date.now()}-${file.name.replace(/[^\w.\- ]+/g, '_')}`;
  const task = uploadBytesResumable(ref(firebaseStorage, path), file, { contentType: file.type, cacheControl: 'public, max-age=31536000' });
  await new Promise<void>((resolve, reject) => task.on('state_changed', (s) => onProgress?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), reject, () => resolve()));
  return getDownloadURL(task.snapshot.ref);
}
export function subscribeCourses(onData: (rows: Course[]) => void, onError: OnError) {
  return onSnapshot(collection(firestore, 'courses'), (snapshot) => onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Course).sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')))), onError);
}
export function subscribeBatch(id: string, onData: (batch: CourseBatch | null) => void, onError: OnError) {
  return onSnapshot(doc(firestore, 'batches', id), (snapshot) => onData(snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as CourseBatch) : null), onError);
}

/**
 * Sets (or clears, with uid '') the instructor of one subject in one batch.
 * Also refreshes subjects/{id}.facultyUids as the union over all batches, which the
 * instructor app uses to list "my subjects".
 */
export async function assignInstructor(batch: CourseBatch, allBatches: CourseBatch[], subject: CourseSubject, instructor: { uid: string; name: string } | null) {
  const subjectInstructors = { ...(batch.subjectInstructors ?? {}) };
  if (instructor) subjectInstructors[subject.id] = instructor;
  else delete subjectInstructors[subject.id];
  const instructorUids = [...new Set(Object.values(subjectInstructors).map((item) => item.uid))];
  await setDoc(doc(firestore, 'batches', batch.id), { subjectInstructors, instructorUids, updatedAt: now() }, { merge: true });
  const batches = allBatches.map((item) => (item.id === batch.id ? { ...item, subjectInstructors } : item));
  await setDoc(doc(firestore, 'subjects', subject.id), { ...subjectTeachers(subject, batches), updatedAt: now() }, { merge: true });
}

/** facultyUids/facultyNames for a subject: its default instructor plus every batch override. */
export function subjectTeachers(subject: Pick<CourseSubject, 'id' | 'instructorUid' | 'instructorName'>, batches: CourseBatch[]) {
  const teachers = new Map<string, string>();
  if (subject.instructorUid) teachers.set(subject.instructorUid, subject.instructorName ?? '');
  for (const batch of batches) {
    const entry = batch.subjectInstructors?.[subject.id];
    if (entry) teachers.set(entry.uid, entry.name);
  }
  return { facultyUids: [...teachers.keys()], facultyNames: [...teachers.values()], instructor: subject.instructorName ?? [...teachers.values()][0] ?? '' };
}

export const subscribeCourseBatches = (courseId: string, onData: (rows: CourseBatch[]) => void, onError: OnError) =>
  listen<CourseBatch>('batches', courseId, (rows) => onData(rows.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, undefined, { numeric: true }))), onError);
export const subscribeCourseSubjects = (courseId: string, onData: (rows: CourseSubject[]) => void, onError: OnError) =>
  listen<CourseSubject>('subjects', courseId, (rows) => onData(rows.map((row) => ({ ...row, facultyUids: row.facultyUids ?? [], facultyNames: row.facultyNames ?? [] })).sort((a, b) => (a.year || 0) - (b.year || 0) || a.name.localeCompare(b.name))), onError);
export const subscribeCourseEnrollments = (courseId: string, onData: (rows: Enrollment[]) => void, onError: OnError) =>
  listen<Enrollment>('enrollments', courseId, (rows) => onData(rows.sort((a, b) => a.studentName.localeCompare(b.studentName))), onError);

export function saveBatch(batch: Omit<CourseBatch, 'id'>, id?: string) {
  const ref = id ? doc(firestore, 'batches', id) : doc(collection(firestore, 'batches'));
  return setDoc(ref, { ...batch, name: batch.name.trim(), ...(id ? {} : { createdAt: now() }), updatedAt: now() }, { merge: true });
}
export const deleteBatch = (id: string) => deleteDoc(doc(firestore, 'batches', id));

/** Saves a subject; pass the course's batches so facultyUids keeps batch overrides. */
export function saveSubject(subject: Omit<CourseSubject, 'id'>, id: string | undefined, batches: CourseBatch[] = []) {
  const ref = id ? doc(firestore, 'subjects', id) : doc(collection(firestore, 'subjects'));
  // `instructor` (display name) keeps older mobile builds working.
  return setDoc(ref, { ...subject, name: subject.name.trim(), code: subject.code.trim().toUpperCase(), instructorUid: subject.instructorUid ?? '', instructorName: subject.instructorName ?? '', ...subjectTeachers({ ...subject, id: ref.id }, batches), ...(id ? {} : { createdAt: now() }), updatedAt: now() }, { merge: true });
}
export const deleteSubject = (id: string) => deleteDoc(doc(firestore, 'subjects', id));

/** Readable temporary password: 7 letters + 3 digits, no look-alike characters. */
function temporaryPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return [...bytes].map((value, index) => (index < 7 ? letters[value % letters.length] : digits[value % digits.length])).join('');
}

/** Next purchase ID, e.g. RBU-2026-00042 (counter per calendar year, inside the same transaction). */
async function nextPurchaseId(transaction: Transaction) {
  const year = new Date().getFullYear();
  const ref = doc(firestore, 'counters', `purchase-${year}`);
  const snapshot = await transaction.get(ref);
  const value = (snapshot.exists() ? Number(snapshot.data().value) : 0) + 1;
  transaction.set(ref, { value, updatedAt: now() });
  return `RBU-${year}-${String(value).padStart(5, '0')}`;
}

/**
 * Enrol students into one batch. Runs in the admin's browser (allowed by the
 * admin-only rules on users, enrollments and counters):
 *  - new email → Firebase login created with the given or a temporary password
 *  - existing student → approved and moved into this batch
 *  - every enrolment (`${uid}_${courseId}`) gets a purchase ID once
 */
/**
 * `couponCode` (optional) applies to NEW enrolments only: it is recorded on the enrolment and the
 * coupon's usedCount goes up in the same transaction, so the usage limit cannot be overrun.
 */
export async function enrollStudents(courseId: string, batchId: string, students: StudentRow[], couponCode = ''): Promise<EnrollResult[]> {
  const adminUid = firebaseAuth.currentUser?.uid ?? '';
  const [course, batch] = await Promise.all([getDoc(doc(firestore, 'courses', courseId)), getDoc(doc(firestore, 'batches', batchId))]);
  if (!course.exists()) throw new Error('Course not found.');
  if (!batch.exists() || batch.data().courseId !== courseId) throw new Error('Batch not found in this course.');
  const courseName = String(course.data().title ?? courseId);
  const code = normalizeCode(couponCode);
  const couponRef = code ? doc(firestore, 'coupons', code) : null;
  if (couponRef) {
    const snapshot = await getDoc(couponRef);
    if (!snapshot.exists()) throw new Error(`Coupon ${code} does not exist.`);
    const problem = couponProblem(toCoupon(snapshot.id, snapshot.data()), courseId);
    if (problem) throw new Error(problem);
  }
  const batchName = String(batch.data().name ?? batchId);
  const year = Number(batch.data().year ?? 0);
  const capacity = Number(batch.data().capacity ?? 0);
  // Check the rules allow enrolment writes BEFORE creating any login, so a refused save
  // never leaves a login without a profile behind.
  try {
    await getDoc(doc(firestore, 'counters', `purchase-${new Date().getFullYear()}`));
  } catch (cause) {
    if ((cause as { code?: string }).code === 'permission-denied') throw new Error('Enrolment is blocked by the Firestore rules on the server. Publish the latest firestore.rules (Firebase console → Firestore → Rules → Publish), wait a minute, then try again.');
    throw cause;
  }
  let seats = (await getDocs(query(collection(firestore, 'enrollments'), where('batchId', '==', batchId)))).size;

  const results: EnrollResult[] = [];
  const seen = new Set<string>();
  for (const row of students) {
    const email = row.email.trim().toLowerCase();
    const name = row.name.trim();
    const phone = (row.phone ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { results.push({ email, status: 'error', message: 'Invalid email.' }); continue; }
    if (seen.has(email)) { results.push({ email, status: 'error', message: 'Duplicate row.' }); continue; }
    seen.add(email);
    try {
      const existing = await getDocs(query(collection(firestore, 'users'), where('email', '==', email)));
      let uid = existing.docs[0]?.id;
      let password: string | undefined;
      if (!uid) {
        password = (row.password ?? '').trim() || temporaryPassword();
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        try { uid = (await createManagedAccount(email, password)).uid; } catch (cause) {
          if ((cause as { code?: string }).code !== 'auth/email-already-in-use') throw cause;
          // A login exists without a profile (e.g. an earlier attempt was refused). Recover it with its password.
          const typed = (row.password ?? '').trim();
          if (!typed) throw new Error('This email already has a login but no profile. Type that login’s password in the Password column and enrol again, or delete the login in Firebase console → Authentication.');
          try { uid = await existingAccountUid(email, typed); } catch { throw new Error('This email already has a login and the password does not match it. Use the original password, or delete the login in Firebase console → Authentication.'); }
          password = undefined; // existing login: no new password to hand out
        }
      }
      const profileRef = doc(firestore, 'users', uid);
      const enrollmentRef = doc(firestore, 'enrollments', `${uid}_${courseId}`);
      const outcome = await runTransaction(firestore, async (transaction) => {
        const [profile, enrollment, couponSnap] = await Promise.all([transaction.get(profileRef), transaction.get(enrollmentRef), couponRef ? transaction.get(couponRef) : Promise.resolve(null)]);
        // All reads happen before any write (Firestore transaction rule), so the coupon is checked here.
        let coupon: Coupon | null = null;
        if (couponRef && couponSnap?.exists() && !enrollment.exists()) {
          coupon = toCoupon(couponSnap.id, couponSnap.data());
          const problem = couponProblem(coupon, courseId);
          if (problem) throw new Error(problem);
        }
        const role = profile.exists() ? profile.data().role : 'student';
        if (role !== 'student') throw new Error(`This email belongs to a ${role} account.`);
        const sameBatch = enrollment.exists() && enrollment.data().batchId === batchId;
        if (!sameBatch && capacity > 0 && seats >= capacity) throw new Error(`Batch is full (${capacity} seats).`);
        const purchaseId = enrollment.exists() ? String(enrollment.data().purchaseId) : await nextPurchaseId(transaction);
        transaction.set(profileRef, {
          uid, email, role: 'student', displayName: name || (profile.exists() ? profile.data().displayName : email),
          ...(phone ? { phone } : {}),
          active: true, approvalStatus: 'approved', approvedAt: now(), approvedBy: adminUid,
          courseId, courseName, batchId, batchName, year,
          ...(profile.exists() ? {} : { createdAt: now() }), updatedAt: now(),
        }, { merge: true });
        transaction.set(enrollmentRef, {
          studentUid: uid, studentEmail: email, studentName: name || (profile.exists() ? profile.data().displayName : email),
          courseId, courseName, batchId, batchName, year, purchaseId, status: 'approved',
          couponCode: enrollment.exists() ? enrollment.data().couponCode ?? '' : coupon?.code ?? '',
          enrolledAt: enrollment.exists() ? enrollment.data().enrolledAt : now(), updatedAt: now(), updatedBy: adminUid,
        }, { merge: true });
        if (coupon && couponRef) transaction.update(couponRef, { usedCount: coupon.usedCount + 1, updatedAt: now() });
        return { purchaseId, sameBatch, moved: enrollment.exists() && !sameBatch, couponCode: enrollment.exists() ? String(enrollment.data().couponCode ?? '') : coupon?.code ?? '' };
      });
      if (!outcome.sameBatch) seats += 1;
      results.push({ email, purchaseId: outcome.purchaseId, couponCode: outcome.couponCode, status: password ? 'created' : outcome.moved ? 'moved' : 'enrolled', ...(password ? { password } : {}) });
    } catch (cause) {
      results.push({ email, status: 'error', message: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  return results;
}

/** Removes one enrolment and clears the student's current course if it was this one. Their login stays. */
export async function removeEnrollment(enrollmentId: string) {
  const ref = doc(firestore, 'enrollments', enrollmentId);
  await runTransaction(firestore, async (transaction) => {
    const enrollment = await transaction.get(ref);
    if (!enrollment.exists()) return;
    const profileRef = doc(firestore, 'users', String(enrollment.data().studentUid));
    const profile = await transaction.get(profileRef);
    if (profile.exists() && profile.data().courseId === enrollment.data().courseId) {
      transaction.update(profileRef, { courseId: '', courseName: '', batchId: '', batchName: '', year: 0, updatedAt: now() });
    }
    transaction.delete(ref);
  });
}

export const STUDENT_CSV_SAMPLE = 'name,email,phone,password\nAarav Sharma,aarav.sharma@example.com,9876543210,\nPriya Singh,priya.singh@example.com,9876500000,Welcome@123\n';

/** Parses name,email,phone,password CSV (header row required; quoted cells allowed). */
export function parseStudentCsv(text: string): { rows: StudentRow[]; errors: string[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [], errors: ['The file is empty.'] };
  const split = (line: string) => {
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
  };
  const headers = split(lines[0]).map((item) => item.toLowerCase());
  const at = (key: string) => headers.indexOf(key);
  if (at('email') < 0) return { rows: [], errors: ['The first row must be a header with at least an "email" column (see the sample).'] };
  const rows: StudentRow[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, index) => {
    const cells = split(line);
    const email = (cells[at('email')] ?? '').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push(`Row ${index + 2}: invalid email "${email}".`); return; }
    rows.push({ email, name: at('name') >= 0 ? cells[at('name')] ?? '' : '', phone: at('phone') >= 0 ? cells[at('phone')] ?? '' : '', password: at('password') >= 0 ? cells[at('password')] ?? '' : '' });
  });
  return { rows, errors };
}
