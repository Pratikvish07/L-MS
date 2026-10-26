import { STATIC_CHAPTERS } from '@/constants/static-data';
import type { AppUser } from '@/types/auth.types';
import type { Chapter } from '@/types/catalog.types';
import { createSessionId } from '@/utils/id';

// Static chapters, kept in memory while the app is running.
let chapters: Chapter[] = STATIC_CHAPTERS.map((chapter) => ({ ...chapter, topics: [...chapter.topics] }));
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const byName = (a: Chapter, b: Chapter) => a.name.localeCompare(b.name, undefined, { numeric: true });

export function subscribeToChapters(subjectId: string, onData: (chapters: Chapter[]) => void, _onError: (e: Error) => void) {
  const update = () => onData(chapters.filter((chapter) => chapter.subjectId === subjectId).sort(byName));
  listeners.add(update);
  update();
  return () => { listeners.delete(update); };
}

export async function addChapter(subjectId: string, name: string, faculty: AppUser, firstTopic?: string) {
  const id = createSessionId();
  chapters = [...chapters, { id, subjectId, name: name.trim(), topics: firstTopic?.trim() ? [firstTopic.trim()] : [], createdByName: faculty.displayName }];
  notify();
  return id;
}

function changeChapter(chapterId: string, change: (chapter: Chapter) => Chapter) {
  if (!chapters.some((chapter) => chapter.id === chapterId)) return Promise.reject(new Error('Chapter not found.'));
  chapters = chapters.map((chapter) => (chapter.id === chapterId ? change(chapter) : chapter));
  notify();
  return Promise.resolve();
}
export function renameChapter(_subjectId: string, chapterId: string, name: string) { return changeChapter(chapterId, (chapter) => ({ ...chapter, name: name.trim() })); }
export async function deleteChapter(_subjectId: string, chapterId: string) { chapters = chapters.filter((chapter) => chapter.id !== chapterId); notify(); }

export function addTopic(_subjectId: string, chapterId: string, topic: string) { const value = topic.trim(); return changeChapter(chapterId, (chapter) => (chapter.topics.includes(value) ? chapter : { ...chapter, topics: [...chapter.topics, value] })); }
export function removeTopic(_subjectId: string, chapterId: string, topic: string) { return changeChapter(chapterId, (chapter) => ({ ...chapter, topics: chapter.topics.filter((item) => item !== topic) })); }

export async function rememberChapterAndTopic(subjectId: string, current: Chapter[], chapterName: string, topic: string, faculty: AppUser) {
  const existing = current.find((chapter) => chapter.name.trim().toLowerCase() === chapterName.trim().toLowerCase());
  if (!existing) { await addChapter(subjectId, chapterName, faculty, topic); return; }
  if (!existing.topics.some((item) => item.trim().toLowerCase() === topic.trim().toLowerCase())) await addTopic(subjectId, existing.id, topic);
}
