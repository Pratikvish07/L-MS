import { deleteApp, getApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, inMemoryPersistence, updateProfile } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { toIso } from './format';
import { firestore } from './firebase';
import { deleteApiVideo, getApiVideos, type ApiVideo } from './video-api';
import type { AppUser, Batch, Chapter, Classroom, Degree, MountDevice, Recording, RecordingStatus, Stream, Subject, UserRole } from './types';

type Row = Record<string, any>;
type Unsubscribe = () => void;
type OnError = (error: Error) => void;
const now = () => new Date().toISOString();
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

function splitTitle(title: string) {
  const match = /^(.*) - ([0-9a-f-]{36})$/i.exec(title);
  return match ? { topic: match[1], sessionId: match[2] } : { topic: title, sessionId: '' };
}

let apiVideos: ApiVideo[] = [];
let metadataRows: Record<string, Row> = {};
let editRows: Record<string, Partial<Recording>> = {};
let apiLoaded = false;
let recordingListener: ((rows: Recording[]) => void) | null = null;

function toRecording(id: string, metadata: Row, video?: ApiVideo): Recording {
  const { topic: titleTopic, sessionId: parsedSessionId } = splitTitle(video?.title ?? '');
  const createdAt = toIso(video?.created_at ?? metadata.createdAt ?? '');
  const videoUrl = video?.video_url ?? (Array.isArray(metadata.partFileIds) ? String(metadata.partFileIds[0] ?? '') : '');
  return {
    id, sessionId: String(metadata.sessionId ?? (parsedSessionId || id)),
    courseId: String(metadata.courseId ?? ''), courseName: String(metadata.courseName ?? ''),
    batchId: String(metadata.batchId ?? ''), batchName: String(metadata.batchName ?? ''),
    lectureNumber: String(metadata.lectureNumber ?? ''), lectureNotes: Array.isArray(metadata.lectureNotes) ? metadata.lectureNotes : [],
    facultyUid: String(metadata.facultyUid ?? ''), mountUid: String(metadata.mountUid ?? ''),
    classroomId: String(metadata.classroomId ?? ''), classroomName: String(metadata.classroomName ?? ''),
    facultyId: String(metadata.facultyId ?? ''), facultyName: String(metadata.facultyName ?? ''),
    degreeId: String(metadata.degreeId ?? ''), degreeName: String(metadata.degreeName ?? ''),
    streamId: String(metadata.streamId ?? ''), streamName: String(metadata.streamName ?? ''), year: Number(metadata.year ?? 0),
    subjectId: String(metadata.subjectId ?? ''), subjectName: String(metadata.subjectName ?? ''),
    className: String(metadata.className ?? ''), chapter: String(metadata.chapter ?? ''), topic: String(metadata.topic ?? (titleTopic || 'Untitled lecture')),
    recordedAt: toIso(metadata.recordedAt ?? createdAt), durationSeconds: Number(video?.duration ?? metadata.durationSeconds ?? 0) || 0,
    fileSizeBytes: Number(metadata.fileSizeBytes ?? 0) || 0, mimeType: String(video?.mime_type ?? metadata.mimeType ?? ''),
    storagePath: videoUrl, videoApiId: video ? String(video.id) : String(metadata.videoApiId ?? ''), partFileIds: videoUrl ? [videoUrl] : [],
    thumbnailPath: video?.thumbnail_url ?? '',
    status: (metadata.status ?? (video ? 'uploaded' : 'ready')) as RecordingStatus,
    publicationStatus: (metadata.publicationStatus === 'published' ? 'published' : 'unpublished') as 'published' | 'unpublished',
    uploadProgress: Number(metadata.uploadProgress ?? (video ? 100 : 0)), errorMessage: String(metadata.errorMessage ?? ''), notes: String(metadata.notes ?? ''),
    startedAt: toIso(metadata.startedAt), endedAt: toIso(metadata.endedAt), uploadedAt: toIso(metadata.uploadedAt ?? (video ? createdAt : '')),
    publishedAt: toIso(metadata.publishedAt), createdAt, updatedAt: toIso(metadata.updatedAt ?? video?.updated_at ?? createdAt),
  } satisfies Recording;
}

/** Every video on the video API (with its Firestore details) plus lectures whose video is not uploaded yet. */
function mappedRecordings(): Recording[] {
  const matched = new Set<string>();
  const fromApi = apiVideos.map((video) => {
    const id = String(video.id);
    const { sessionId: parsedSessionId } = splitTitle(video.title ?? '');
    const entry = Object.entries(metadataRows).find(([, row]) => String(row.videoApiId ?? '') === id || (parsedSessionId && String(row.sessionId ?? '') === parsedSessionId));
    if (entry) matched.add(entry[0]);
    return toRecording(id, { ...(entry?.[1] ?? {}), ...(editRows[id] ?? {}) }, video);
  });
  const notUploaded = Object.entries(metadataRows).filter(([docId]) => !matched.has(docId)).map(([docId, row]) => toRecording(docId, row));
  return [...fromApi, ...notUploaded].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}
function emitRecordings() { recordingListener?.(mappedRecordings()); }

/** onVideoApiStatus: a message while the video server fails, null once it works again. */
export function subscribeRecordings(onData: (rows: Recording[]) => void, onError: OnError, onVideoApiStatus?: (message: string | null) => void): Unsubscribe {
  let active = true;
  recordingListener = onData;
  const refreshApi = async () => {
    try {
      apiVideos = await getApiVideos();
      if (!active) return;
      apiLoaded = true;
      emitRecordings();
      onVideoApiStatus?.(null);
    } catch (error) {
      if (!active) return;
      // Video server down or slow: still show every lecture from Firestore (using the
      // last video list we had), say what happened, and keep retrying every 30 s.
      apiLoaded = true;
      emitRecordings();
      const detail = error instanceof Error ? error.message : String(error);
      onVideoApiStatus?.(`The video server is not responding right now (${detail}). Lecture details still show; videos may be missing or not play. Retrying automatically every 30 seconds.`);
    }
  };
  const stopRecords = onSnapshot(collection(firestore, 'recordings'), (snapshot) => {
    metadataRows = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data()]));
    if (apiLoaded) emitRecordings();
  }, onError);
  const stopEdits = onSnapshot(collection(firestore, 'recordingEdits'), (snapshot) => {
    editRows = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data() as Partial<Recording>]));
    if (apiLoaded) emitRecordings();
  }, onError);
  void refreshApi();
  const timer = window.setInterval(() => void refreshApi(), 30_000);
  return () => { active = false; recordingListener = null; stopRecords(); stopEdits(); window.clearInterval(timer); };
}

async function saveRecordingFields(recording: Recording, fields: Partial<Recording>) {
  const match = Object.entries(metadataRows).find(([docId, row]) => docId === recording.id || String(row.videoApiId ?? '') === recording.id || String(row.sessionId ?? '') === recording.sessionId);
  if (match) await updateDoc(doc(firestore, 'recordings', match[0]), { ...fields, updatedAt: now() });
  else await setDoc(doc(firestore, 'recordingEdits', recording.id), { ...editRows[recording.id], ...fields, updatedAt: now() }, { merge: true });
}
export function publishRecording(recording: Recording, publish: boolean) {
  if (publish && recording.status !== 'uploaded' && recording.status !== 'published') return Promise.reject(new Error('Only uploaded recordings can be published.'));
  return saveRecordingFields(recording, { publicationStatus: publish ? 'published' : 'unpublished', status: publish ? 'published' : 'uploaded', publishedAt: publish ? now() : '' });
}
export type RecordingEdit = Pick<Recording, 'topic' | 'chapter' | 'className' | 'classroomId' | 'classroomName' | 'recordedAt'>;
export function updateRecordingMetadata(id: string, edit: RecordingEdit) {
  const recording = mappedRecordings().find((item) => item.id === id);
  return recording ? saveRecordingFields(recording, { ...edit, recordedAt: new Date(edit.recordedAt).toISOString() }) : Promise.reject(new Error('Recording was not found.'));
}
export function saveRecordingNotes(id: string, notes: string) {
  const recording = mappedRecordings().find((item) => item.id === id);
  return recording ? saveRecordingFields(recording, { notes }) : Promise.reject(new Error('Recording was not found.'));
}
export async function deleteRecording(recording: Recording) {
  const apiVideo = apiVideos.find((video) => String(video.id) === recording.videoApiId);
  if (apiVideo?.slug) await deleteApiVideo(apiVideo.slug);
  else if (recording.videoApiId) throw new Error('Could not find this video on the video service. Refresh the Video Library and try again.');
  const match = Object.entries(metadataRows).find(([docId, row]) => docId === recording.id || String(row.videoApiId ?? '') === recording.id || String(row.sessionId ?? '') === recording.sessionId);
  if (match) await deleteDoc(doc(firestore, 'recordings', match[0]));
  await deleteDoc(doc(firestore, 'recordingEdits', recording.id));
}
export async function fetchObjectUrl(fileIds: string | string[]): Promise<string> {
  const ids = (Array.isArray(fileIds) ? fileIds : [fileIds]).filter(Boolean);
  if (!ids.length || !/^https?:\/\//i.test(ids[0])) throw new Error('This recording does not have a video API URL.');
  return ids[0];
}

export function subscribeUsers(onData: (rows: AppUser[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(collection(firestore, 'users'), (snapshot) => onData(snapshot.docs.map((item) => ({ ...item.data(), uid: item.id }) as AppUser).sort((a, b) => a.displayName.localeCompare(b.displayName))), onError);
}
export interface NewUser {
  email: string; password: string; displayName: string; role: UserRole; facultyId?: string; subject?: string;
  phone?: string; gender?: string;
  classroomId?: string; classroomName?: string; degreeId?: string; streamId?: string; year?: number; batchId?: string; batchName?: string;
}
export async function createUser(input: NewUser) {
  const secondary = initializeApp(getApp().options, `user-${crypto.randomUUID()}`);
  const auth = getAuth(secondary);
  try {
    await auth.setPersistence(inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(auth, input.email.trim().toLowerCase(), input.password);
    await updateProfile(credential.user, { displayName: input.displayName.trim() });
    const profile: AppUser = {
      uid: credential.user.uid, email: input.email.trim().toLowerCase(), displayName: input.displayName.trim(), role: input.role,
      active: true, approvalStatus: 'approved', facultyId: input.facultyId ?? '', subject: input.subject ?? '',
      phone: input.phone ?? '', gender: input.gender ?? '',
      classroomId: input.classroomId ?? '', classroomName: input.classroomName ?? '', degreeId: input.degreeId ?? '',
      streamId: input.streamId ?? '', year: input.year ?? 0, batchId: input.batchId ?? '', batchName: input.batchName ?? '', createdAt: now(),
    };
    await setDoc(doc(firestore, 'users', credential.user.uid), profile);
    if (input.role === 'admin') await setDoc(doc(firestore, 'admins', credential.user.uid), { email: profile.email, role: 'admin', isActive: true });
    return { uid: credential.user.uid };
  } finally { await deleteApp(secondary); }
}
export function updateUser(uid: string, fields: Partial<Pick<AppUser, 'displayName' | 'role' | 'active' | 'facultyId' | 'subject' | 'phone' | 'gender' | 'classroomId' | 'classroomName' | 'degreeId' | 'streamId' | 'year' | 'batchId' | 'batchName'>>) {
  return updateDoc(doc(firestore, 'users', uid), { ...fields, ...(fields.active !== undefined ? { approvalStatus: fields.active ? 'approved' : 'pending' } : {}) });
}
export function approveStudent(uid: string) { return updateDoc(doc(firestore, 'users', uid), { active: true, approvalStatus: 'approved', approvedAt: now() }); }
export function deleteUserProfile(uid: string) { return deleteDoc(doc(firestore, 'users', uid)); }

export function subscribeMountDevices(onData: (devices: MountDevice[]) => void, onError: OnError): Unsubscribe {
  return onSnapshot(collection(firestore, 'pairings'), (snapshot) => onData(snapshot.docs.map((item) => {
    const row = item.data();
    return { mountUid: item.id, deviceName: String(row.deviceName ?? 'Mount device'), facultyUid: String(row.facultyUid ?? ''), facultyName: String(row.facultyName ?? ''), pairedAt: toIso(row.pairedAt), state: String(row.mountStatus?.state ?? 'idle'), lastSeen: Number(row.mountStatus?.lastSeen ?? 0), freeBytes: Number(row.mountStatus?.freeBytes ?? 0), sessionTopic: String(row.session?.metadata?.topic ?? '') };
  })), onError);
}

function subscribeCatalog<T extends { id: string }>(name: string, onData: (rows: T[]) => void, onError: OnError, sort?: (a: T, b: T) => number): Unsubscribe {
  return onSnapshot(collection(firestore, name), (snapshot) => { const rows = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T); onData(sort ? rows.sort(sort) : rows); }, onError);
}
function saveItem<T extends { id: string }>(name: string, item: Omit<T, 'id'>, id?: string) {
  const row = id ? doc(firestore, name, id) : doc(collection(firestore, name));
  return setDoc(row, item, { merge: true });
}
function deleteItem(name: string, id: string) { return deleteDoc(doc(firestore, name, id)); }

export const subscribeBatches = (onData: (rows: Batch[]) => void, onError: OnError) => subscribeCatalog<Batch>('batches', onData, onError, byName);
export const subscribeClassrooms = (onData: (rows: Classroom[]) => void, onError: OnError) => subscribeCatalog<Classroom>('classrooms', onData, onError, (a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true }));
export const subscribeDegrees = (onData: (rows: Degree[]) => void, onError: OnError) => subscribeCatalog<Degree>('degrees', onData, onError, byName);
export const subscribeStreams = (onData: (rows: Stream[]) => void, onError: OnError) => subscribeCatalog<Stream>('streams', onData, onError, byName);
export const subscribeSubjects = (onData: (rows: Subject[]) => void, onError: OnError) => subscribeCatalog<Subject>('subjects', onData, onError, byName);

export function subscribeChapters(onData: (chapters: Map<string, Chapter[]>) => void, onError: OnError): Unsubscribe {
  return onSnapshot(collection(firestore, 'chapters'), (snapshot) => {
    const grouped = new Map<string, Chapter[]>();
    for (const chapter of snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Chapter)) grouped.set(chapter.subjectId, [...(grouped.get(chapter.subjectId) ?? []), chapter]);
    for (const list of grouped.values()) list.sort(byName);
    onData(grouped);
  }, onError);
}
export const saveBatch = (item: Omit<Batch, 'id'>, id?: string) => saveItem<Batch>('batches', item, id);
export const deleteBatch = (id: string) => deleteItem('batches', id);
export const saveClassroom = (item: Omit<Classroom, 'id'>, id?: string) => saveItem<Classroom>('classrooms', { ...item, roomNo: item.roomNo.trim(), capacity: Number(item.capacity) || 0 }, id);
export const deleteClassroom = (id: string) => deleteItem('classrooms', id);
export const saveDegree = (item: Omit<Degree, 'id'>, id?: string) => saveItem<Degree>('degrees', { ...item, name: item.name.trim(), durationYears: Math.min(6, Math.max(1, Math.round(item.durationYears))) }, id);
export const deleteDegree = (id: string) => deleteItem('degrees', id);
export const saveStream = (item: Omit<Stream, 'id'>, id?: string) => saveItem<Stream>('streams', { ...item, name: item.name.trim(), code: item.code.trim().toUpperCase() }, id);
export const deleteStream = (id: string) => deleteItem('streams', id);
export function saveSubject(item: Omit<Subject, 'id' | 'legacyClassName' | 'chapters'>, id?: string) { return saveItem<Subject>('subjects', { ...item, name: item.name.trim(), code: item.code.trim().toUpperCase(), chapters: [], legacyClassName: '' }, id); }
export const deleteSubject = (id: string) => deleteItem('subjects', id);
