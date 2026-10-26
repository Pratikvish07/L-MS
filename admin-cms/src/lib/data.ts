import { toIso } from './format';
import {
  STATIC_ACCOUNTS,
  STATIC_BATCHES,
  STATIC_CHAPTERS,
  STATIC_CLASSROOMS,
  STATIC_DEGREES,
  STATIC_STREAMS,
  STATIC_SUBJECTS,
  type StaticAccount,
} from './static-data';
import type { AppUser, Batch, Chapter, Classroom, Degree, MountDevice, Recording, Stream, Subject, UserRole } from './types';
import { deleteApiVideo, getApiVideos, type ApiVideo } from './video-api';

type Unsubscribe = () => void;
type OnError = (error: Error) => void;

/**
 * Static data layer. Tables start from static-data.ts and admin edits are
 * saved in this browser's localStorage. Recordings are the videos listed by
 * the live video API, with CMS-only fields (publishing, notes, edits) stored
 * locally on top.
 */

interface Tables {
  accounts: StaticAccount[];
  classrooms: Classroom[];
  degrees: Degree[];
  streams: Stream[];
  subjects: Subject[];
  chapters: Chapter[];
  batches: Batch[];
  recordingEdits: Record<string, Partial<Recording>>;
}

const STORAGE_KEY = 'lms-cms-static-data';

function seed(): Tables {
  return structuredClone({
    accounts: STATIC_ACCOUNTS,
    classrooms: STATIC_CLASSROOMS,
    degrees: STATIC_DEGREES,
    streams: STATIC_STREAMS,
    subjects: STATIC_SUBJECTS,
    chapters: STATIC_CHAPTERS,
    batches: STATIC_BATCHES,
    recordingEdits: {},
  });
}

function load(): Tables {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...seed(), ...(JSON.parse(saved) as Partial<Tables>) };
  } catch {
    // Storage blocked or corrupt: fall back to the seed data.
  }
  return seed();
}

let db = load();
const listeners = new Set<() => void>();

function commit(change: (tables: Tables) => Tables) {
  db = change(db);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Edits still apply for this session.
  }
  listeners.forEach((listener) => listener());
  return Promise.resolve();
}

function subscribe<T>(select: (tables: Tables) => T, onData: (value: T) => void): Unsubscribe {
  const update = () => onData(select(db));
  listeners.add(update);
  update();
  return () => {
    listeners.delete(update);
  };
}

const newId = () => crypto.randomUUID();
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

export function findAccount(email: string, password: string): AppUser | null {
  const account = db.accounts.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
  if (!account) return null;
  const { password: _password, ...user } = account;
  return user;
}

export function getUser(uid: string): AppUser | null {
  const account = db.accounts.find((item) => item.uid === uid);
  if (!account) return null;
  const { password: _password, ...user } = account;
  return user;
}

// ---------- Recordings (live video API + local CMS fields) ----------

let apiVideos: ApiVideo[] = [];

/** Mobile uploads are titled "<topic> - <sessionId>". */
function splitTitle(title: string) {
  const match = /^(.*) - ([0-9a-f-]{36})$/i.exec(title);
  return match ? { topic: match[1], sessionId: match[2] } : { topic: title, sessionId: '' };
}

function mapVideo(video: ApiVideo, edit: Partial<Recording> = {}): Recording {
  const id = String(video.id);
  const { topic, sessionId } = splitTitle(video.title ?? '');
  const createdAt = toIso(video.created_at ?? '');
  return {
    id,
    sessionId: sessionId || id,
    facultyUid: '',
    mountUid: '',
    classroomId: '',
    classroomName: '',
    facultyId: '',
    facultyName: '',
    className: '',
    degreeName: '',
    streamName: '',
    year: 0,
    subjectId: '',
    subjectName: '',
    chapter: '',
    topic,
    recordedAt: createdAt,
    durationSeconds: Number(video.duration ?? 0) || 0,
    fileSizeBytes: Number(video.file_size ?? 0) || 0,
    storagePath: video.video_url,
    videoApiId: id,
    partFileIds: [video.video_url],
    thumbnailPath: video.thumbnail_url ?? '',
    status: 'uploaded',
    publicationStatus: 'unpublished',
    uploadProgress: 100,
    errorMessage: '',
    notes: '',
    startedAt: '',
    endedAt: '',
    uploadedAt: createdAt,
    publishedAt: '',
    createdAt,
    updatedAt: createdAt,
    ...edit,
  };
}

function recordings(tables: Tables) {
  return apiVideos
    .map((video) => mapVideo(video, tables.recordingEdits[String(video.id)]))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function subscribeRecordings(onData: (rows: Recording[]) => void, onError: OnError): Unsubscribe {
  let active = true;
  let loaded = false;
  const refresh = () =>
    getApiVideos()
      .then((videos) => {
        if (!active) return;
        apiVideos = videos;
        loaded = true;
        onData(recordings(db));
      })
      .catch((error: unknown) => active && onError(error instanceof Error ? error : new Error(String(error))));
  refresh();
  const timer = setInterval(refresh, 30_000);
  // Local edits (publish, notes) re-render immediately; wait for the first API list.
  const unsubscribe = subscribe(recordings, (rows) => loaded && onData(rows));
  return () => {
    active = false;
    clearInterval(timer);
    unsubscribe();
  };
}

function editRecording(id: string, fields: Partial<Recording>) {
  return commit((t) => ({ ...t, recordingEdits: { ...t.recordingEdits, [id]: { ...t.recordingEdits[id], ...fields, updatedAt: new Date().toISOString() } } }));
}

export function publishRecording(recording: Recording, publish: boolean) {
  if (publish && recording.status !== 'uploaded' && recording.status !== 'published') {
    return Promise.reject(new Error('Only uploaded recordings can be published.'));
  }
  return editRecording(recording.id, {
    publicationStatus: publish ? 'published' : 'unpublished',
    status: publish ? 'published' : 'uploaded',
    publishedAt: publish ? new Date().toISOString() : '',
  });
}

export type RecordingEdit = Pick<Recording, 'topic' | 'chapter' | 'className' | 'classroomId' | 'classroomName' | 'recordedAt'>;

export function updateRecordingMetadata(id: string, edit: RecordingEdit) {
  return editRecording(id, { ...edit, recordedAt: new Date(edit.recordedAt).toISOString() });
}

export function saveRecordingNotes(id: string, notes: string) {
  return editRecording(id, { notes });
}

export async function deleteRecording(recording: Recording) {
  if (recording.videoApiId) await deleteApiVideo(recording.videoApiId);
  apiVideos = apiVideos.filter((video) => String(video.id) !== recording.id);
  await commit((t) => {
    const { [recording.id]: _removed, ...recordingEdits } = t.recordingEdits;
    return { ...t, recordingEdits };
  });
}

export async function fetchObjectUrl(fileIds: string | string[]): Promise<string> {
  const ids = (Array.isArray(fileIds) ? fileIds : [fileIds]).filter(Boolean);
  if (!ids.length || !/^https?:\/\//i.test(ids[0])) throw new Error('This recording does not have a video API URL.');
  return ids[0];
}

// ---------- People ----------

export function subscribeUsers(onData: (rows: AppUser[]) => void, _onError: OnError): Unsubscribe {
  return subscribe(
    (t) => t.accounts.map(({ password: _password, ...user }) => user).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    onData,
  );
}

export interface NewUser {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  facultyId?: string;
  subject?: string;
  classroomId?: string;
  classroomName?: string;
  degreeId?: string;
  streamId?: string;
  year?: number;
  batchId?: string;
  batchName?: string;
}

export async function createUser(input: NewUser) {
  const email = input.email.trim().toLowerCase();
  if (db.accounts.some((account) => account.email === email)) throw new Error('A user with this email already exists.');
  const uid = newId();
  await commit((t) => ({
    ...t,
    accounts: [...t.accounts, {
      uid,
      email,
      password: input.password,
      displayName: input.displayName.trim(),
      role: input.role, active: true, approvalStatus: 'approved',
      facultyId: input.facultyId ?? '', subject: input.subject ?? '',
      classroomId: input.classroomId ?? '', classroomName: input.classroomName ?? '',
      degreeId: input.degreeId ?? '', streamId: input.streamId ?? '', year: input.year ?? 0,
      batchId: input.batchId ?? '', batchName: input.batchName ?? '',
      createdAt: new Date().toISOString(),
    }],
  }));
  return { uid };
}

function editAccount(uid: string, fields: Partial<StaticAccount>) {
  return commit((t) => ({ ...t, accounts: t.accounts.map((account) => (account.uid === uid ? { ...account, ...fields } : account)) }));
}

export function updateUser(uid: string, fields: Partial<Pick<AppUser, 'displayName' | 'role' | 'active' | 'facultyId' | 'subject' | 'classroomId' | 'classroomName' | 'degreeId' | 'streamId' | 'year' | 'batchId' | 'batchName'>>) {
  return editAccount(uid, {
    ...fields,
    ...(fields.active !== undefined ? { approvalStatus: fields.active ? 'approved' : 'pending' } : {}),
  });
}

export function approveStudent(uid: string) {
  return editAccount(uid, { active: true, approvalStatus: 'approved' });
}

export function deleteUserProfile(uid: string) {
  return commit((t) => ({ ...t, accounts: t.accounts.filter((account) => account.uid !== uid) }));
}

/** Mount pairing lives on the phones, so the CMS has no live device list. */
export function subscribeMountDevices(onData: (devices: MountDevice[]) => void, _onError: OnError): Unsubscribe {
  onData([]);
  return () => undefined;
}

// ---------- Academic catalog ----------

type ListKey = 'classrooms' | 'degrees' | 'streams' | 'subjects' | 'batches';

function saveItem<K extends ListKey>(key: K, item: Omit<Tables[K][number], 'id'>, id?: string) {
  return commit((t) => {
    const list = t[key] as Tables[K][number][];
    const rowId = id ?? newId();
    const row = { ...list.find((existing) => existing.id === rowId), ...item, id: rowId } as Tables[K][number];
    const next = list.some((existing) => existing.id === rowId) ? list.map((existing) => (existing.id === rowId ? row : existing)) : [...list, row];
    return { ...t, [key]: next };
  });
}

function deleteItem(key: ListKey, id: string) {
  return commit((t) => ({ ...t, [key]: (t[key] as { id: string }[]).filter((item) => item.id !== id) }));
}

export function subscribeBatches(onData: (rows: Batch[]) => void, _onError: OnError): Unsubscribe {
  return subscribe((t) => [...t.batches].sort(byName), onData);
}

export function subscribeClassrooms(onData: (rows: Classroom[]) => void, _onError: OnError): Unsubscribe {
  return subscribe((t) => [...t.classrooms].sort((a, b) => a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true })), onData);
}

export function subscribeDegrees(onData: (rows: Degree[]) => void, _onError: OnError): Unsubscribe {
  return subscribe((t) => [...t.degrees].sort(byName), onData);
}

export function subscribeStreams(onData: (rows: Stream[]) => void, _onError: OnError): Unsubscribe {
  return subscribe((t) => [...t.streams].sort(byName), onData);
}

export function subscribeSubjects(onData: (rows: Subject[]) => void, _onError: OnError): Unsubscribe {
  return subscribe((t) => [...t.subjects].sort(byName), onData);
}

export function subscribeChapters(onData: (chapters: Map<string, Chapter[]>) => void, _onError: OnError): Unsubscribe {
  return subscribe((t) => {
    const grouped = new Map<string, Chapter[]>();
    for (const chapter of t.chapters) grouped.set(chapter.subjectId, [...(grouped.get(chapter.subjectId) ?? []), chapter]);
    for (const list of grouped.values()) list.sort(byName);
    return grouped;
  }, onData);
}

export function saveBatch(batch: Omit<Batch, 'id'>, id?: string) {
  return saveItem('batches', batch, id);
}

export function deleteBatch(id: string) {
  return deleteItem('batches', id);
}

export function saveClassroom(room: Omit<Classroom, 'id'>, id?: string) {
  return saveItem('classrooms', { roomNo: room.roomNo.trim(), capacity: Number(room.capacity) || 0, active: room.active }, id);
}

export function deleteClassroom(id: string) {
  return deleteItem('classrooms', id);
}

export function saveDegree(degree: Omit<Degree, 'id'>, id?: string) {
  return saveItem('degrees', { name: degree.name.trim(), durationYears: Math.min(6, Math.max(1, Math.round(degree.durationYears))), active: degree.active }, id);
}

export function deleteDegree(id: string) {
  return deleteItem('degrees', id);
}

export function saveStream(stream: Omit<Stream, 'id'>, id?: string) {
  return saveItem('streams', { degreeId: stream.degreeId, name: stream.name.trim(), code: stream.code.trim().toUpperCase(), active: stream.active }, id);
}

export function deleteStream(id: string) {
  return deleteItem('streams', id);
}

export function saveSubject(subject: Omit<Subject, 'id' | 'legacyClassName' | 'chapters'>, id?: string) {
  return saveItem('subjects', {
    name: subject.name.trim(),
    code: subject.code.trim().toUpperCase(),
    degreeId: subject.degreeId,
    streamId: subject.streamId,
    year: subject.year,
    facultyUids: subject.facultyUids,
    active: subject.active,
    chapters: [],
    legacyClassName: '',
  }, id);
}

export function deleteSubject(id: string) {
  return deleteItem('subjects', id);
}
