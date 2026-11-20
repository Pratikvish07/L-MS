// Data for the admin's per-student dashboard.
//
// Tracking is written by the student Website / app (Phase 3):
//   lectureViews/{studentUid}_{recordingId} = { studentUid, recordingId, courseId, batchId, subjectId,
//                                               firstViewedAt, lastViewedAt, views, watchedSeconds, completed }
//   users/{uid}.lastActiveAt                 = ISO time of the student's last visit
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';

import type { Enrollment } from './courses';
import { firestore } from './firebase';
import type { AppUser } from './types';

type OnError = (error: Error) => void;

export interface StudentProfile extends AppUser {
  roleName?: string;
  courseId?: string;
  courseName?: string;
  lastActiveAt?: string;
  approvedAt?: string;
}

export interface LectureView {
  id: string;
  studentUid: string;
  recordingId: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  firstViewedAt: string;
  lastViewedAt: string;
  views: number;
  watchedSeconds: number;
  completed: boolean;
}

export function subscribeStudent(uid: string, onData: (profile: StudentProfile | null) => void, onError: OnError) {
  return onSnapshot(doc(firestore, 'users', uid), (snapshot) => onData(snapshot.exists() ? ({ ...snapshot.data(), uid: snapshot.id } as StudentProfile) : null), onError);
}

export function subscribeStudentEnrollments(uid: string, onData: (rows: Enrollment[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'enrollments'), where('studentUid', '==', uid)), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Enrollment).sort((a, b) => String(b.enrolledAt).localeCompare(String(a.enrolledAt))));
  }, onError);
}

export function subscribeLectureViews(uid: string, onData: (rows: LectureView[]) => void, onError: OnError) {
  return onSnapshot(query(collection(firestore, 'lectureViews'), where('studentUid', '==', uid)), (snapshot) => {
    onData(snapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id, studentUid: String(data.studentUid ?? uid), recordingId: String(data.recordingId ?? ''),
        courseId: String(data.courseId ?? ''), batchId: String(data.batchId ?? ''), subjectId: String(data.subjectId ?? ''),
        firstViewedAt: String(data.firstViewedAt ?? ''), lastViewedAt: String(data.lastViewedAt ?? ''),
        views: Number(data.views ?? 1), watchedSeconds: Number(data.watchedSeconds ?? 0), completed: data.completed === true,
      };
    }));
  }, onError);
}

export function setStudentAccess(uid: string, active: boolean) {
  const now = new Date().toISOString();
  return updateDoc(doc(firestore, 'users', uid), { active, approvalStatus: active ? 'approved' : 'pending', ...(active ? { approvedAt: now } : {}), updatedAt: now });
}
