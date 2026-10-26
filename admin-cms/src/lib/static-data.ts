import type { AppUser, Batch, Chapter, Classroom, Degree, Stream, Subject } from './types';

/**
 * Seed data for the CMS. Matches the mobile app's constants/static-*.ts.
 * Admin edits are kept in this browser's localStorage (see data.ts); only video
 * files come from the live video API.
 */

export interface StaticAccount extends AppUser {
  password: string;
}

const created = '2026-01-01T00:00:00.000Z';

export const STATIC_ACCOUNTS: StaticAccount[] = [
  { uid: 'admin', email: 'admin@lms.local', password: 'Admin@123', displayName: 'LMS Admin', role: 'admin', active: true, approvalStatus: 'approved', facultyId: '', subject: '', classroomId: '', classroomName: '', createdAt: created },
  { uid: 'mount-tripod101', email: 'tripod101@gmail.com', password: 'Tripod101@gmail.com', displayName: 'Tripod 101', role: 'mount', active: true, approvalStatus: 'approved', facultyId: '', subject: '', classroomId: 'classroom-101', classroomName: 'Tripod Classroom 101', createdAt: created },
  { uid: 'faculty-pratik', email: 'pratikvish07@gmail.com', password: 'Pratik@123', displayName: 'Pratik Vish', role: 'faculty', active: true, approvalStatus: 'approved', facultyId: 'FAC-001', subject: 'Computer Science', classroomId: '', classroomName: '', createdAt: created },
  { uid: 'student-renu', email: 'renu@gmail.com', password: 'Renu@123', displayName: 'Renu', role: 'student', active: true, approvalStatus: 'approved', facultyId: '', subject: '', classroomId: '', classroomName: '', degreeId: 'btech', streamId: 'cse', year: 1, batchId: 'batch-1', batchName: 'B.Tech CSE - Year 1', createdAt: created },
];

export const STATIC_CLASSROOMS: Classroom[] = [
  { id: 'classroom-101', roomNo: '101', capacity: 60, active: true },
  { id: 'classroom-102', roomNo: '102', capacity: 60, active: true },
];

export const STATIC_DEGREES: Degree[] = [{ id: 'btech', name: 'B.Tech', durationYears: 4, active: true }];

export const STATIC_STREAMS: Stream[] = [{ id: 'cse', degreeId: 'btech', name: 'Computer Science & Engineering', code: 'CSE', active: true }];

export const STATIC_BATCHES: Batch[] = [
  { id: 'batch-1', degreeId: 'btech', streamId: 'cse', year: 1, name: 'B.Tech CSE - Year 1', classroomId: 'classroom-101', classroomName: '101', active: true },
];

export const STATIC_SUBJECTS: Subject[] = [
  { id: 'subject-programming', name: 'Programming Fundamentals', code: 'CSE101', degreeId: 'btech', streamId: 'cse', year: 1, facultyUids: ['faculty-pratik'], chapters: [], active: true, legacyClassName: '' },
  { id: 'subject-maths', name: 'Engineering Mathematics', code: 'MTH101', degreeId: 'btech', streamId: 'cse', year: 1, facultyUids: ['faculty-pratik'], chapters: [], active: true, legacyClassName: '' },
];

export const STATIC_CHAPTERS: Chapter[] = [
  { id: 'chapter-intro', subjectId: 'subject-programming', name: 'Introduction', topics: ['What is programming', 'Algorithms and flowcharts'], createdByName: 'Pratik Vish' },
  { id: 'chapter-c-basics', subjectId: 'subject-programming', name: 'C Basics', topics: ['Variables and data types', 'Operators'], createdByName: 'Pratik Vish' },
  { id: 'chapter-matrices', subjectId: 'subject-maths', name: 'Matrices', topics: ['Rank of a matrix', 'Eigenvalues'], createdByName: 'Pratik Vish' },
];
