import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import type { AppUser } from '@/types/auth.types';
import type { LectureMetadata, Recording, RecordingStatus } from '@/types/recording.types';
import { toIso } from '@/utils/date';
import { createSessionId } from '@/utils/id';
import { firestore } from './firebase';

type Row = Record<string, any>;
const now = () => new Date().toISOString();

export function mapRecording(data: Row): Recording {
  const id = String(data.id ?? data.sessionId ?? '');
  return {
    id,
    sessionId: String(data.sessionId ?? id),
    facultyUid: String(data.facultyUid ?? ''),
    mountUid: String(data.mountUid ?? ''),
    classroomId: String(data.classroomId ?? ''),
    classroomName: String(data.classroomName ?? data.classroomId ?? ''),
    facultyId: String(data.facultyId ?? ''),
    facultyName: String(data.facultyName ?? ''),
    degreeId: String(data.degreeId ?? ''),
    degreeName: String(data.degreeName ?? ''),
    streamId: String(data.streamId ?? ''),
    streamName: String(data.streamName ?? ''),
    year: Number(data.year ?? 0),
    batchId: String(data.batchId ?? ''),
    batchName: String(data.batchName ?? ''),
    subjectId: String(data.subjectId ?? ''),
    subjectName: String(data.subjectName ?? ''),
    courseId: String(data.courseId ?? data.subjectId ?? ''),
    courseName: String(data.courseName ?? data.subjectName ?? ''),
    className: String(data.className ?? ''),
    chapter: String(data.chapter ?? ''),
    topic: String(data.topic ?? ''),
    lectureNumber: String(data.lectureNumber ?? ''),
    recordedAt: toIso(data.recordedAt),
    durationSeconds: Number(data.durationSeconds ?? 0),
    fileSizeBytes: Number(data.fileSizeBytes ?? 0),
    partFileIds: Array.isArray(data.partFileIds) ? data.partFileIds.map(String) : [],
    videoApiId: String(data.videoApiId ?? ''),
    thumbnailFileId: String(data.thumbnailFileId ?? ''),
    mimeType: String(data.mimeType ?? ''),
    status: (data.status ?? 'ready') as RecordingStatus,
    publicationStatus: data.publicationStatus === 'published' ? 'published' : 'unpublished',
    uploadProgress: Number(data.uploadProgress ?? 0),
    errorMessage: String(data.errorMessage ?? ''),
    notes: String(data.notes ?? ''),
    startedAt: toIso(data.startedAt),
    endedAt: toIso(data.endedAt),
    uploadedAt: toIso(data.uploadedAt),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function createRecordingSession(faculty: AppUser, mountUid: string, lecture: Omit<LectureMetadata, 'facultyId' | 'facultyName'>) {
  const sessionId = createSessionId();
  const metadata: LectureMetadata = { ...lecture, facultyId: faculty.facultyId || faculty.uid, facultyName: faculty.displayName };
  await setDoc(doc(firestore, 'recordings', sessionId), {
    ...metadata, courseId: metadata.courseId || metadata.subjectId, courseName: metadata.courseName || metadata.subjectName, sessionId, facultyUid: faculty.uid, mountUid,
    status: 'ready', publicationStatus: 'unpublished', uploadProgress: 0,
    durationSeconds: 0, fileSizeBytes: 0, partFileIds: [], createdAt: now(), updatedAt: now(),
  });
  return { sessionId, metadata };
}

export function discardReadySession(sessionId: string) { return deleteDoc(doc(firestore, 'recordings', sessionId)); }

export function subscribeToFacultyRecordings(facultyUid: string, onData: (recordings: Recording[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(firestore, 'recordings'), where('facultyUid', '==', facultyUid)), (snapshot) => {
    onData(snapshot.docs.map((item) => mapRecording({ ...item.data(), id: item.id })).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)));
  }, onError);
}

/** Published lectures of the student's course + batch (the same check the Firestore rules make). */
export function subscribeToClassRecordings(courseId: string, batchId: string, onData: (recordings: Recording[]) => void, onError: (error: Error) => void) {
  const recordingsQuery = query(collection(firestore, 'recordings'), where('publicationStatus', '==', 'published'), where('courseId', '==', courseId), where('batchId', '==', batchId));
  return onSnapshot(recordingsQuery, (snapshot) => onData(snapshot.docs.map((item) => mapRecording({ ...item.data(), id: item.id })).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))), onError);
}

export function subscribeToRecording(sessionId: string, onData: (recording: Recording | null) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(firestore, 'recordings', sessionId), (snapshot) => onData(snapshot.exists() ? mapRecording({ ...snapshot.data(), id: snapshot.id }) : null), onError);
}

function updateRecording(sessionId: string, data: Record<string, unknown>) {
  return updateDoc(doc(firestore, 'recordings', sessionId), { ...data, updatedAt: now() });
}

export const markRecordingStarted = (sessionId: string) => updateRecording(sessionId, { status: 'recording', startedAt: now(), errorMessage: null });
export const markRecordingAborted = (sessionId: string, errorMessage: string) => updateRecording(sessionId, { status: 'ready', errorMessage: errorMessage.slice(0, 500) });
export const markSavedLocally = (sessionId: string, durationSeconds: number, fileSizeBytes: number) => updateRecording(sessionId, { status: 'saved_locally', durationSeconds: Math.round(durationSeconds), fileSizeBytes, endedAt: now(), uploadProgress: 0 });
export const markUploading = (sessionId: string) => updateRecording(sessionId, { status: 'uploading', uploadProgress: 0, errorMessage: null });
export const setUploadProgress = (sessionId: string, uploadProgress: number) => updateRecording(sessionId, { uploadProgress });

export function markUploaded(sessionId: string, fields: { partFileIds: string[]; thumbnailFileId: string; fileSizeBytes: number; mimeType: string; videoApiId?: string }) {
  return updateRecording(sessionId, { partFileIds: fields.partFileIds, ...(fields.videoApiId ? { videoApiId: fields.videoApiId } : {}), thumbnailFileId: fields.thumbnailFileId || '', fileSizeBytes: fields.fileSizeBytes, mimeType: fields.mimeType, status: 'uploaded', uploadProgress: 100, uploadedAt: now(), errorMessage: null, publicationStatus: 'published', publishedAt: now() });
}
export const markPending = (sessionId: string) => updateRecording(sessionId, { status: 'saved_locally', uploadProgress: 0 });
export const markFailed = (sessionId: string, errorMessage: string) => updateRecording(sessionId, { status: 'failed', errorMessage: errorMessage.slice(0, 500) });
