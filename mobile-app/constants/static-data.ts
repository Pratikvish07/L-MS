import type { Chapter, Classroom, Degree, Stream, Subject } from '@/types/catalog.types';

/**
 * Static catalog used by the app instead of a database. Sign-in accounts are in
 * static-users.ts. Only the lecture video file goes to the live video API.
 */

export const STATIC_CLASSROOMS: Classroom[] = [
  { id: 'classroom-101', roomNo: '101', capacity: 60, active: true },
  { id: 'classroom-102', roomNo: '102', capacity: 60, active: true },
];

export const STATIC_DEGREES: Degree[] = [{ id: 'btech', name: 'B.Tech', durationYears: 4 }];

export const STATIC_STREAMS: Stream[] = [{ id: 'cse', degreeId: 'btech', name: 'Computer Science & Engineering', code: 'CSE' }];

export const STATIC_SUBJECTS: Subject[] = [
  { id: 'subject-programming', name: 'Programming Fundamentals', code: 'CSE101', degreeId: 'btech', streamId: 'cse', year: 1, facultyUids: ['faculty-pratik'], chapters: [] },
  { id: 'subject-maths', name: 'Engineering Mathematics', code: 'MTH101', degreeId: 'btech', streamId: 'cse', year: 1, facultyUids: ['faculty-pratik'], chapters: [] },
];

export const STATIC_CHAPTERS: Chapter[] = [
  { id: 'chapter-intro', subjectId: 'subject-programming', name: 'Introduction', topics: ['What is programming', 'Algorithms and flowcharts'], createdByName: 'Pratik Vish' },
  { id: 'chapter-c-basics', subjectId: 'subject-programming', name: 'C Basics', topics: ['Variables and data types', 'Operators'], createdByName: 'Pratik Vish' },
  { id: 'chapter-matrices', subjectId: 'subject-maths', name: 'Matrices', topics: ['Rank of a matrix', 'Eigenvalues'], createdByName: 'Pratik Vish' },
];
