import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export type Course = { id: string; title: string; description?: string; category?: string; instructor?: string; status?: string };
export async function getPublishedCourses(): Promise<Course[]> { const snapshot = await getDocs(collection(db, 'courses')); return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Course).filter((course) => course.status === 'published' || course.status === 'active').sort((a, b) => a.title.localeCompare(b.title)); }
export async function getPublishedQuizzes(): Promise<Course[]> { const snapshot = await getDocs(query(collection(db, 'quizzes'), where('status', '==', 'published'))); return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Course); }
export async function getPublicContent(key: string) { const snapshot = await getDocs(query(collection(db, 'websiteContent'), where('key', '==', key))); return snapshot.docs[0]?.data() ?? null; }
