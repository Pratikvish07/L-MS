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
}

/** A chapter of a subject, with its topics — added by assigned faculty. */
export interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  topics: string[];
  createdByName: string;
}
