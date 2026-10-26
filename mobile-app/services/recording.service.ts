import type { AppUser } from '@/types/auth.types';
import type { LectureMetadata, Recording, RecordingStatus } from '@/types/recording.types';
import { createSessionId } from '@/utils/id';

const records = new Map<string, Recording>();
const listeners = new Map<string, Set<(recording: Recording | null) => void>>();
const now = () => new Date().toISOString();
const STORAGE_KEY = 'lms-static-recordings-v1';
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (raw) (JSON.parse(raw) as Recording[]).forEach((recording) => records.set(recording.id, recording));
} catch { /* native storage may not be available */ }
const persist = () => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify([...records.values()])); } catch { /* keep native in-memory fallback */ } };
const notify = (id: string) => listeners.get(id)?.forEach((listener) => listener(records.get(id) ?? null));

export async function createRecordingSession(faculty: AppUser, mountUid: string, lecture: Omit<LectureMetadata, 'facultyId' | 'facultyName'>) {
  const sessionId = createSessionId();
  const metadata = { ...lecture, facultyId: faculty.facultyId || faculty.uid, facultyName: faculty.displayName };
  records.set(sessionId, { ...metadata, id: sessionId, sessionId, facultyUid: faculty.uid, mountUid, durationSeconds: 0, fileSizeBytes: 0, partFileIds: [], thumbnailFileId: '', mimeType: '', status: 'ready', publicationStatus: 'unpublished', uploadProgress: 0, errorMessage: '', notes: '', startedAt: '', endedAt: '', uploadedAt: '', createdAt: now(), updatedAt: now() }); persist();
  return { sessionId, metadata };
}
export async function discardReadySession(sessionId: string) { records.delete(sessionId); persist(); notify(sessionId); }
export function subscribeToFacultyRecordings(facultyUid: string, onData: (rows: Recording[]) => void, _onError: (error: Error) => void) { const update = () => onData([...records.values()].filter((r) => r.facultyUid === facultyUid)); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }
/** Student library: uploaded lectures for one degree, stream and year. */
export function subscribeToClassRecordings(degreeId: string, streamId: string, year: number, onData: (rows: Recording[]) => void, _onError: (error: Error) => void) { const update = () => onData([...records.values()].filter((r) => (r.status === 'uploaded' || r.status === 'published') && r.degreeId === degreeId && r.streamId === streamId && r.year === year).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }
export function subscribeToRecording(sessionId: string, onData: (recording: Recording | null) => void, _onError: (error: Error) => void) { const set = listeners.get(sessionId) ?? new Set(); set.add(onData); listeners.set(sessionId, set); onData(records.get(sessionId) ?? null); return () => { set.delete(onData); }; }
async function updateRecording(sessionId: string, data: Partial<Recording>) { const current = records.get(sessionId); if (!current) return; records.set(sessionId, { ...current, ...data, updatedAt: now() }); persist(); notify(sessionId); }
export const markRecordingStarted = (id: string) => updateRecording(id, { status: 'recording', startedAt: now(), errorMessage: '' });
export const markRecordingAborted = (id: string, errorMessage: string) => updateRecording(id, { status: 'ready', errorMessage: errorMessage.slice(0, 500) });
export const markSavedLocally = (id: string, durationSeconds: number, fileSizeBytes: number) => updateRecording(id, { status: 'saved_locally', durationSeconds: Math.round(durationSeconds), fileSizeBytes, endedAt: now(), uploadProgress: 0 });
export const markUploading = (id: string) => updateRecording(id, { status: 'uploading', uploadProgress: 0, errorMessage: '' });
export const setUploadProgress = (id: string, uploadProgress: number) => updateRecording(id, { uploadProgress });
export const markUploaded = (id: string, fields: { partFileIds: string[]; thumbnailFileId: string; fileSizeBytes: number; mimeType: string; videoApiId?: string }) => updateRecording(id, { ...fields, status: 'uploaded', uploadProgress: 100, uploadedAt: now(), errorMessage: '' });
export const markPending = (id: string) => updateRecording(id, { status: 'saved_locally', uploadProgress: 0 });
export const markFailed = (id: string, errorMessage: string) => updateRecording(id, { status: 'failed', errorMessage: errorMessage.slice(0, 500) });
