'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { getVideos, type ApiVideo } from '../../lib/videos';

type Enrollment = { id: string; courseId: string; courseName?: string; batchName?: string; year?: string | number };
type Recording = { id: string; title?: string; topic?: string; courseId?: string; batchId?: string; year?: string | number; videoApiId?: string | number; videoUrl?: string; notes?: string };

export default function DashboardPage() {
  const { user, profile, loading, logout } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [videos, setVideos] = useState<ApiVideo[]>([]);
  const [message, setMessage] = useState('Loading your learning space…');

  useEffect(() => {
    if (!user || !profile?.active) return;
    let cancelled = false;
    void (async () => {
      try {
        const enrollmentSnapshot = await getDocs(query(collection(db, 'enrollments'), where('studentUid', '==', user.uid), where('status', '==', 'approved')));
        const approved = enrollmentSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Enrollment);
        if (cancelled) return;
        setEnrollments(approved);
        if (!approved.length) { setMessage('Your account is approved, but no course has been assigned yet.'); return; }
        const courseIds = approved.map((item) => item.courseId).filter(Boolean).slice(0, 30);
        const recordingSnapshot = await getDocs(query(collection(db, 'recordings'), where('publicationStatus', '==', 'published'), where('courseId', 'in', courseIds)));
        const allowed = new Set(approved.map((item) => `${item.courseId}:${item.batchName ?? ''}:${item.year ?? ''}`));
        const found = recordingSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Recording).filter((item) => allowed.has(`${item.courseId}:${item.batchId ?? ''}:${item.year ?? ''}`));
        setRecordings(found);
        setVideos(await getVideos());
        setMessage(found.length ? '' : 'No published lectures are available for your assigned course yet.');
      } catch { setMessage('We could not load your learning content. Please try again later.'); }
    })();
    return () => { cancelled = true; };
  }, [user, profile?.active]);

  if (loading) return <main className="auth-page">Loading…</main>;
  if (!profile) return <main className="auth-page"><div className="auth-card"><h1>Sign in required</h1><Link className="button" href="/login">Student login</Link></div></main>;
  if (!profile.active) return <main className="auth-page"><div className="auth-card"><span className="eyebrow">Registration received</span><h1>Waiting for admin approval</h1><p>Your student account is registered. An administrator must approve it before you can access courses and lectures.</p><button className="button" onClick={() => void logout()}>Sign out</button></div></main>;
  return <main className="portal-page"><div className="portal-header"><div><span className="eyebrow">Student portal</span><h1>Welcome, {profile.displayName}</h1></div><button className="button secondary" onClick={() => void logout()}>Sign out</button></div><section className="panel"><h2>My courses</h2>{enrollments.length ? <div className="grid">{enrollments.map((item) => <article className="card" key={item.id}><h3>{item.courseName ?? item.courseId}</h3><p>Batch: {item.batchName ?? 'Assigned by admin'}</p><p>Year: {item.year ?? '—'}</p><span className="status">Approved</span></article>)}</div> : <p>{message}</p>}</section><section className="panel"><h2>Recorded lectures</h2>{message && enrollments.length > 0 && <p>{message}</p>}<div className="grid">{recordings.map((recording) => { const video = videos.find((item) => String(item.id) === String(recording.videoApiId)); const source = recording.videoUrl ?? video?.video_url; return <article className="card" key={recording.id}><h3>{recording.title ?? recording.topic ?? 'Lecture'}</h3>{recording.notes && <p>{recording.notes}</p>}{source && <video controls preload="metadata" src={source} />}</article>; })}</div></section></main>;
}

