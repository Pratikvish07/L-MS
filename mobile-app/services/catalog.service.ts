import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Batch, Classroom, Course, Degree, Stream, Subject } from '@/types/catalog.types';
import { firestore } from './firebase';
type OnError = (e: Error) => void;

function subscribe<T extends { id: string }>(path: string, onData: (rows: T[]) => void, onError: OnError) {
	return onSnapshot(collection(firestore, path), (snapshot) => {
		onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T));
	}, onError);
}
export const subscribeToClassrooms = (onData: (rooms: Classroom[]) => void, onError: OnError) => subscribe('classrooms', onData, onError);
export const subscribeToDegrees = (onData: (items: Degree[]) => void, onError: OnError) => subscribe('degrees', onData, onError);
export const subscribeToStreams = (onData: (items: Stream[]) => void, onError: OnError) => subscribe('streams', onData, onError);
export const subscribeToSubjects = (onData: (items: Subject[]) => void, onError: OnError) => subscribe('subjects', onData, onError);
export const subscribeToBatches = (onData: (items: Batch[]) => void, onError: OnError) => subscribe('batches', onData, onError);
export const subscribeToCourses = (onData: (items: Course[]) => void, onError: OnError) => onSnapshot(query(collection(firestore, 'courses'), where('status', 'in', ['active', 'published'])), (snapshot) => onData(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as Course)), onError);
