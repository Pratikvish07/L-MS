import type { AppUser } from '@/types/auth.types';

export interface StaticUser extends AppUser { password: string; }

export const STATIC_USERS: StaticUser[] = [
  { uid: 'mount-tripod101', email: 'tripod101@gmail.com', password: 'Tripod101@gmail.com', displayName: 'Tripod 101', role: 'mount', active: true, facultyId: '', subject: '', classroomId: 'classroom-101', classroomName: 'Tripod Classroom 101' },
  { uid: 'faculty-pratik', email: 'pratikvish07@gmail.com', password: 'Pratik@123', displayName: 'Pratik Vish', role: 'faculty', active: true, facultyId: 'FAC-001', subject: 'Computer Science' },
  { uid: 'student-renu', email: 'renu@gmail.com', password: 'Renu@123', displayName: 'Renu', role: 'student', active: true, facultyId: '', subject: '', degreeId: 'btech', streamId: 'cse', year: 1, batchId: 'batch-1', batchName: 'B.Tech CSE - Year 1' },
];
