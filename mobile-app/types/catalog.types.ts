export interface Classroom {
  id: string;
  roomNo: string;
  capacity: number;
  active: boolean;
}

/** e.g. B.Tech, 4 years. */
export interface Degree {
  id: string;
  name: string;
  durationYears: number;
}

/** e.g. Computer Science & Engineering (CSE), unique within its degree. */
export interface Stream {
  id: string;
  degreeId: string;
  name: string;
  code: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  degreeId: string;
  streamId: string;
  /** 1-based year of study. */
  year: number;
  facultyUids: string[];
  chapters: string[];
  courseId?: string;
  courseName?: string;
  /** Course-level default instructor (Admin CMS → course → subject). */
  instructorUid?: string;
  instructorName?: string;
}

export interface Course { id: string; title: string; status?: string; }

export interface Batch {
  id: string;
  degreeId: string;
  streamId: string;
  year: number;
  name: string;
  classroomId: string;
  classroomName: string;
  courseId?: string;
  courseName?: string;
  /** Per-batch instructor override: subjectId → instructor. */
  subjectInstructors?: Record<string, { uid: string; name: string }>;
  instructorUids?: string[];
  active?: boolean;
}

/** A chapter of a subject, with its topics — added by assigned faculty. */
export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  topics: string[];
  createdByName: string;
}
