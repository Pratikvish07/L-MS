import type { AppUser } from '@/types/auth.types';
import type { Chapter } from '@/types/catalog.types';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { firestore } from './firebase';

export function subscribeToChapters(subjectId: string, onData: (chapters: Chapter[]) => void, onError: (e: Error) => void) {
  return onSnapshot(query(collection(firestore, 'chapters'), where('subjectId', '==', subjectId)), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Chapter).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
  }, onError);
}

export async function addChapter(subjectId: string, name: string, faculty: AppUser, firstTopic?: string) {
  const result = await addDoc(collection(firestore, 'chapters'), { subjectId, name: name.trim(), topics: firstTopic?.trim() ? [firstTopic.trim()] : [], createdByName: faculty.displayName });
  return result.id;
}

export function renameChapter(_subjectId: string, chapterId: string, name: string) { return updateDoc(doc(firestore, 'chapters', chapterId), { name: name.trim() }); }
export function deleteChapter(_subjectId: string, chapterId: string) { return deleteDoc(doc(firestore, 'chapters', chapterId)); }
export async function addTopic(_subjectId: string, chapterId: string, topic: string) { const snapshot = await getDoc(doc(firestore, 'chapters', chapterId)); const topics = (snapshot.data()?.topics as string[] | undefined) ?? []; const value = topic.trim(); if (!topics.includes(value)) await updateDoc(doc(firestore, 'chapters', chapterId), { topics: [...topics, value] }); }
export async function removeTopic(_subjectId: string, chapterId: string, topic: string) { const snapshot = await getDoc(doc(firestore, 'chapters', chapterId)); const topics = (snapshot.data()?.topics as string[] | undefined) ?? []; await updateDoc(doc(firestore, 'chapters', chapterId), { topics: topics.filter((item) => item !== topic) }); }

export async function rememberChapterAndTopic(subjectId: string, current: Chapter[], chapterName: string, topic: string, faculty: AppUser) {
  const existing = current.find((chapter) => chapter.name.trim().toLowerCase() === chapterName.trim().toLowerCase());
  if (!existing) { await addChapter(subjectId, chapterName, faculty, topic); return; }
  if (!existing.topics.some((item) => item.trim().toLowerCase() === topic.trim().toLowerCase())) await addTopic(subjectId, existing.id, topic);
}
