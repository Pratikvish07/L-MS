import { STATIC_CLASSROOMS, STATIC_DEGREES, STATIC_STREAMS, STATIC_SUBJECTS } from '@/constants/static-data';
import type { Classroom, Degree, Stream, Subject } from '@/types/catalog.types';
type OnError = (e: Error) => void;

function subscribe<T>(value: T, onData: (data: T) => void, _onError: OnError) { onData(value); return () => undefined; }
export function subscribeToClassrooms(onData: (rooms: Classroom[]) => void, onError: OnError) { return subscribe(STATIC_CLASSROOMS, onData, onError); }
export function subscribeToDegrees(onData: (items: Degree[]) => void, onError: OnError) { return subscribe(STATIC_DEGREES, onData, onError); }
export function subscribeToStreams(onData: (items: Stream[]) => void, onError: OnError) { return subscribe(STATIC_STREAMS, onData, onError); }
export function subscribeToSubjects(onData: (items: Subject[]) => void, onError: OnError) { return subscribe(STATIC_SUBJECTS, onData, onError); }
