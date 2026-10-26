// Mirrors the static data model used by web and mobile.

export type UserRole = 'faculty' | 'admin' | 'mount' | 'student';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  facultyId: string;
  subject: string;
  /** Mount devices: the classroom this tripod is locked to. */
  classroomId: string;
  classroomName: string;
  degreeId?: string;
  streamId?: string;
  year?: number;
  batchId?: string;
  batchName?: string;
  createdAt: string;
}

export type RecordingStatus =
  | 'ready'
  | 'recording'
  | 'saved_locally'
  | 'uploading'
  | 'uploaded'
  | 'published'
  | 'failed';

export interface Recording {
  id: string;
  sessionId: string;
  facultyUid: string;
  mountUid: string;
  classroomId: string;
  classroomName: string;
  facultyId: string;
  facultyName: string;
  className: string;
  degreeName: string;
  streamName: string;
  year: number;
  subjectId: string;
  subjectName: string;
  chapter: string;
  topic: string;
  recordedAt: string;
  durationSeconds: number;
  fileSizeBytes: number;
  storagePath: string;
  videoApiId?: string;
  partFileIds?: string[];
  thumbnailPath: string;
  status: RecordingStatus;
  publicationStatus: 'published' | 'unpublished';
  uploadProgress: number;
  errorMessage: string;
  notes: string;
  startedAt: string;
  endedAt: string;
  uploadedAt: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Classroom {
  id: string;
  roomNo: string;
  capacity: number;
  active: boolean;
}

export interface Batch {
  id: string;
  degreeId: string;
  streamId: string;
  year: number;
  name: string;
  classroomId: string;
  classroomName: string;
  active: boolean;
}

/** e.g. B.Tech, 4 years. Years 1..durationYears are generated from it. */
export interface Degree {
  id: string;
  name: string;
  durationYears: number;
  active: boolean;
}

/** e.g. Computer Science & Engineering (CSE). Unique within its degree. */
export interface Stream {
  id: string;
  degreeId: string;
  name: string;
  code: string;
  active: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  degreeId: string;
  streamId: string;
  /** 1-based year of study. */
  year: number;
  /** Faculty assigned to teach this subject. */
  facultyUids: string[];
  chapters: string[];
  active: boolean;
  /** Pre-university-structure subjects only. */
  legacyClassName: string;
}

/** subjects/{subjectId}/chapters/{id}, added by the assigned faculty. */
export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  topics: string[];
  createdByName: string;
}

export interface MountDevice {
  mountUid: string;
  deviceName: string;
  facultyUid: string;
  facultyName: string;
  pairedAt: string;
  state: string;
  lastSeen: number;
  freeBytes: number;
  sessionTopic: string;
}
