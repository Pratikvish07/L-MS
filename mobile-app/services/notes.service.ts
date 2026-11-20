import * as DocumentPicker from 'expo-document-picker';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Linking } from 'react-native';

import type { LectureNote } from '@/types/recording.types';
import { firebaseStorage, firestore } from './firebase';

export const NOTE_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
];
const MAX_NOTE_BYTES = 25 * 1024 * 1024; // matches storage.rules

export interface PickedNote { uri: string; name: string; mimeType: string; size: number; }

/** Lets the instructor choose one Word or PDF file. Returns null if cancelled. */
export async function pickNotesFile(): Promise<PickedNote | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: NOTE_TYPES, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || guessType(asset.name);
  if (!NOTE_TYPES.includes(mimeType)) throw new Error('Choose a Word (.doc, .docx) or PDF file.');
  if ((asset.size ?? 0) > MAX_NOTE_BYTES) throw new Error('Notes must be smaller than 25 MB.');
  return { uri: asset.uri, name: asset.name, mimeType, size: asset.size ?? 0 };
}

function guessType(name: string) {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return '';
}

/** Folder shared by instructors and students: course → batch → subject → lecture → notes. */
export function lectureNotesFolder(lecture: { courseId: string; batchId: string; subjectId: string }, sessionId: string) {
  return `courses/${lecture.courseId}/batches/${lecture.batchId}/subjects/${lecture.subjectId}/lectures/${sessionId}/notes`;
}

/** Uploads a picked file and attaches it to recordings/{sessionId}.lectureNotes. */
export async function uploadLectureNote(
  lecture: { courseId: string; batchId: string; subjectId: string },
  sessionId: string,
  file: PickedNote,
  uploadedBy: string,
  onProgress?: (fraction: number) => void,
): Promise<LectureNote> {
  if (!lecture.courseId || !lecture.batchId || !lecture.subjectId) throw new Error('Select the course, batch and subject before adding notes.');
  const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
  const path = `${lectureNotesFolder(lecture, sessionId)}/${Date.now()}-${safeName}`;
  const blob = await (await fetch(file.uri)).blob();
  const task = uploadBytesResumable(ref(firebaseStorage, path), blob, { contentType: file.mimeType });
  await new Promise<void>((resolve, reject) => {
    task.on('state_changed', (snapshot) => onProgress?.(snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0), reject, () => resolve());
  });
  const note: LectureNote = {
    name: file.name, path, url: await getDownloadURL(task.snapshot.ref), contentType: file.mimeType,
    size: file.size || blob.size, uploadedAt: new Date().toISOString(), uploadedBy,
  };
  await updateDoc(doc(firestore, 'recordings', sessionId), { lectureNotes: arrayUnion(note), updatedAt: new Date().toISOString() });
  return note;
}

export async function removeLectureNote(sessionId: string, note: LectureNote) {
  await updateDoc(doc(firestore, 'recordings', sessionId), { lectureNotes: arrayRemove(note), updatedAt: new Date().toISOString() });
  await deleteObject(ref(firebaseStorage, note.path)).catch(() => undefined);
}

/** PDFs open directly; Word files open in Microsoft's online viewer so they render without Word installed. */
export function notePreviewUrl(note: Pick<LectureNote, 'url' | 'contentType'>) {
  return note.contentType === 'application/pdf' ? note.url : `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(note.url)}`;
}

export function previewNote(note: Pick<LectureNote, 'url' | 'contentType'>) {
  return Linking.openURL(notePreviewUrl(note));
}
