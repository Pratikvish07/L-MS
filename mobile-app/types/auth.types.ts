/**
 * Roles and approval status are stored in the Firestore users/{uid} profile.
 * Students get courseId/courseName/batchId/batchName when an admin enrols them.
 * "mount" is a dedicated account signed in on the tripod phone.
 */
export type UserRole = 'faculty' | 'admin' | 'mount' | 'student';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  facultyId?: string;
  subject?: string;
  courseId?: string;
  courseName?: string;
  photoURL?: string;
  /** Mount devices only: the classroom this tripod is locked to. */
  classroomId?: string;
  classroomName?: string;
  degreeId?: string;
  streamId?: string;
  year?: number;
  batchId?: string;
  batchName?: string;
}
