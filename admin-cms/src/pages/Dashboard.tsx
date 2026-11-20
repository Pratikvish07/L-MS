import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowDownRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, MonitorPlay, PlayCircle, UserPlus, Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { AreaChart, BarList, Sparkline, type SeriesPoint } from '../components/Charts';
import { Pill, Spinner, Thumbnail } from '../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { subscribeCourses, type Course } from '../lib/courses';
import { publishRecording } from '../lib/firebase-data';
import { firestore } from '../lib/firebase';
import { dayKey, formatDateTime } from '../lib/format';
import { useStore } from '../lib/store';
import type { Recording } from '../lib/types';

type Row = Record<string, unknown> & { id: string };
const DAY = 86_400_000;
const isUploaded = (r: Recording) => r.status === 'uploaded' || r.status === 'published';

/** Live, admin-readable collection (empty on error so the page still renders). */
function useCollection(name: string) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => onSnapshot(collection(firestore, name), (s) => setRows(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => setRows([])), [name]);
  return rows;
}

/** Day keys (yyyy-mm-dd, local) for the last `days` days ending today. */
function lastDays(days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => dayKey(new Date(today.getTime() - (days - 1 - i) * DAY)));
}
/** Sums `value(item)` per day for items whose `date(item)` falls in `keys`. */
function perDay<T>(items: T[], keys: string[], date: (item: T) => string, value: (item: T) => number = () => 1) {
  const index = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map(() => 0);
  for (const item of items) {
    const raw = date(item);
    if (!raw) continue;
    const i = index.get(dayKey(raw));
    if (i !== undefined) out[i] += value(item);
  }
  return out;
}
/** Change of the last 30 days vs the 30 before, in %, or null when there is no baseline. */
function trend<T>(items: T[], date: (item: T) => string, value: (item: T) => number = () => 1) {
  const now = Date.now();
  let current = 0;
  let previous = 0;
  for (const item of items) {
    const t = Date.parse(date(item));
    if (Number.isNaN(t)) continue;
    if (t > now - 30 * DAY) current += value(item);
    else if (t > now - 60 * DAY) previous += value(item);
  }
  return previous ? Math.round(((current - previous) / previous) * 1000) / 10 : current ? null : 0;
}
const shortDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function DashboardPage() {
  const { displayName } = useAuth();
  const { recordings, users, loading } = useStore();
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => subscribeCourses(setCourses, () => setCourses([])), []);
  const enrollments = useCollection('enrollments');
  const assessments = useCollection('assessments');
  const submissions = useCollection('submissions');
  const marks = useCollection('marks');
  const views = useCollection('lectureViews');

  const [range, setRange] = useState<30 | 90>(30);

  const students = users.filter((u) => u.role === 'student');
  const faculty = users.filter((u) => u.role === 'faculty');
  const instructors = faculty.filter((u) => u.active);
  const courseCreated = (c: Course) => String((c as Course & { createdAt?: string }).createdAt ?? '');
  const liveCourses = courses.filter((c) => c.status === 'active' || c.status === 'published');
  const enrolledAt = (e: Row) => String(e.enrolledAt ?? '');
  const spark = lastDays(30);

  const kpis: { icon: ReactNode; label: string; value: string; change: number | null; series: number[]; tone: string; to: string }[] = [
    { icon: <Users size={22} />, label: 'Total Students', value: students.filter((s) => s.active).length.toLocaleString('en-IN'), change: trend(students, (s) => s.createdAt), series: perDay(students, spark, (s) => s.createdAt), tone: 'purple', to: '/users?role=student' },
    { icon: <GraduationCap size={22} />, label: 'Active Instructors', value: instructors.length.toLocaleString('en-IN'), change: trend(faculty, (u) => u.createdAt), series: perDay(faculty, spark, (u) => u.createdAt), tone: 'blue', to: '/faculty' },
    { icon: <BookOpen size={22} />, label: 'Courses', value: liveCourses.length.toLocaleString('en-IN'), change: trend(courses, courseCreated), series: perDay(courses, spark, courseCreated), tone: 'amber', to: '/courses' },
    { icon: <MonitorPlay size={22} />, label: 'Lectures', value: recordings.filter(isUploaded).length.toLocaleString('en-IN'), change: trend(recordings.filter(isUploaded), (r) => r.uploadedAt), series: perDay(recordings.filter(isUploaded), spark, (r) => r.uploadedAt), tone: 'pink', to: '/lectures' },
    { icon: <UserPlus size={22} />, label: 'Enrollments', value: enrollments.length.toLocaleString('en-IN'), change: trend(enrollments, enrolledAt), series: perDay(enrollments, spark, enrolledAt), tone: 'green', to: '/courses' },
  ];

  const chartKeys = lastDays(range);
  const chartValues = perDay(enrollments, chartKeys, enrolledAt);
  const chartPoints: SeriesPoint[] = chartKeys.map((key, i) => ({ key, label: shortDay(key), value: chartValues[i] }));
  const chartTotal = chartValues.reduce((a, b) => a + b, 0);

  // Course performance = average marks % of everything marked in that course.
  const performance = useMemo(() => {
    const byCourse = new Map<string, { got: number; max: number; n: number }>();
    for (const m of marks) {
      if (m.marks === null || m.marks === undefined) continue;
      const key = String(m.courseId ?? '');
      const cur = byCourse.get(key) ?? { got: 0, max: 0, n: 0 };
      byCourse.set(key, { got: cur.got + Number(m.marks), max: cur.max + Number(m.maxMarks ?? 0), n: cur.n + 1 });
    }
    return [...byCourse.entries()].filter(([, v]) => v.max > 0)
      .map(([id, v]) => ({ key: id, label: courses.find((c) => c.id === id)?.title ?? 'Course', value: (v.got / v.max) * 100, sub: `${v.n} marked` }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [marks, courses]);

  const today = dayKey(new Date());
  const upcoming = assessments.filter((a) => a.status !== 'draft' && String(a.date ?? '') >= today).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 3);

  const nameOf = (uid: unknown) => users.find((u) => u.uid === uid)?.displayName ?? 'Student';
  const activity = useMemo(() => {
    type Item = { id: string; who: string; role: 'Student' | 'Instructor'; what: string; where: string; status: string; tone: 'green' | 'amber' | 'blue' | 'gray'; at: string; kind: 'course' | 'recording' | 'student' };
    const items: Item[] = [
      ...enrollments.map((e): Item => ({ id: `e${e.id}`, who: String(e.studentName ?? 'Student'), role: 'Student', what: 'Enrolled in course', where: `${e.courseName ?? ''} · ${e.batchName ?? ''}`, status: 'Enrolled', tone: 'green', at: enrolledAt(e), kind: 'course' })),
      ...recordings.filter((r) => r.uploadedAt).map((r): Item => ({ id: `r${r.id}`, who: r.facultyName || 'Instructor', role: 'Instructor', what: 'Uploaded recording', where: `${r.subjectName || r.courseName} · ${r.topic}`, status: r.publicationStatus === 'published' ? 'Published' : 'Under review', tone: r.publicationStatus === 'published' ? 'green' : 'amber', at: r.uploadedAt, kind: 'recording' })),
      ...submissions.map((x): Item => ({ id: `s${x.id}`, who: String(x.studentName ?? 'Student'), role: 'Student', what: x.answers ? 'Submitted quiz' : 'Submitted work', where: String(x.assessmentTitle ?? ''), status: 'Submitted', tone: 'blue', at: String(x.submittedAt ?? ''), kind: 'student' })),
      ...views.map((v): Item => ({ id: `v${v.id}`, who: nameOf(v.studentUid), role: 'Student', what: 'Watched lecture', where: recordings.find((r) => r.id === v.recordingId)?.topic ?? 'Lecture', status: 'Watched', tone: 'gray', at: String(v.lastViewedAt ?? ''), kind: 'recording' })),
    ];
    return items.filter((i) => i.at).sort((a, b) => b.at.localeCompare(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, recordings, submissions, views, users]);
  const [activityTab, setActivityTab] = useState<'all' | 'students' | 'instructors' | 'courses' | 'recordings'>('all');
  const shownActivity = activity.filter((a) => activityTab === 'all' || (activityTab === 'students' ? a.role === 'Student' : activityTab === 'instructors' ? a.role === 'Instructor' : activityTab === 'courses' ? a.kind === 'course' : a.kind === 'recording')).slice(0, 7);

  const queue = recordings.filter(isUploaded).sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || '')).slice(0, 4);
  const awaiting = recordings.filter((r) => isUploaded(r) && r.publicationStatus !== 'published').length;
  const [publishing, setPublishing] = useState('');
  const approve = async (r: Recording) => { setPublishing(r.id); try { await publishRecording(r, true); } finally { setPublishing(''); } };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <>
      <section className="dash-hero">
        <div>
          <h1>{greeting}, {(displayName || 'Admin').split(/[\s@]/)[0]} <span aria-hidden>👋</span></h1>
          <p>Here’s what’s happening on Finetution today.</p>
        </div>
        <div className="dash-hero-art" aria-hidden>
          <span className="blob" />
          <BookOpen size={46} className="art-book" />
          <GraduationCap size={58} className="art-cap" />
          <PlayCircle size={50} className="art-play" />
        </div>
      </section>

      {loading ? <Spinner /> : (
        <>
          <div className="kpi-grid">
            {kpis.map((k) => (
              <Link key={k.label} to={k.to} className="kpi">
                <div className="kpi-top">
                  <span className={`kpi-icon tone-${k.tone}`} aria-hidden>{k.icon}</span>
                  <div><span className="kpi-label">{k.label}</span><strong className="kpi-value">{k.value}</strong></div>
                </div>
                <div className="kpi-bottom">
                  {k.change === null ? <span className="trend up"><ArrowUpRight size={13} aria-hidden /> New</span>
                    : <span className={`trend ${k.change < 0 ? 'down' : 'up'}`} title="Last 30 days vs the 30 days before">{k.change < 0 ? <ArrowDownRight size={13} aria-hidden /> : <ArrowUpRight size={13} aria-hidden />}{k.change > 0 ? '+' : ''}{k.change}%</span>}
                  <div className="kpi-spark"><Sparkline values={k.series} /></div>
                </div>
              </Link>
            ))}
          </div>

          <div className="dash-row">
            <section className="card card-pad dash-chart">
              <div className="dash-card-head">
                <h2>Student Enrollments</h2>
                <select className="input" style={{ width: 'auto' }} aria-label="Date range" value={range} onChange={(e) => setRange(Number(e.target.value) as 30 | 90)}>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <p className="dash-sub">{chartTotal} new enrolments in the last {range} days</p>
              <AreaChart points={chartPoints} label={`Enrollments per day, last ${range} days`} format={(v) => String(Math.round(v))} />
            </section>

            <section className="card card-pad">
              <div className="dash-card-head"><h2>Course Performance</h2><span className="cell-sub">Average marks</span></div>
              {performance.length ? <BarList rows={performance} max={100} /> : <p className="cell-sub">Marks appear here once tests and assignments are graded.</p>}
            </section>

            <section className="card card-pad">
              <div className="dash-card-head"><h2>Upcoming Tests</h2><Link className="link" to="/courses">View all</Link></div>
              <div className="upcoming">
                {upcoming.map((a) => {
                  const d = new Date(`${String(a.date)}T12:00:00`);
                  return (
                    <Link key={a.id} to={`/courses/${String(a.courseId)}/subjects/${String(a.subjectId)}/assessments/${a.id}`} className="upcoming-item">
                      <span className="date-chip"><b>{d.getDate()}</b>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="grow"><strong>{String(a.title)}</strong><small>{String(a.subjectName ?? '')} · {a.type === 'assignment' ? 'Assignment' : Number(a.questionCount) ? 'Quiz' : 'Test'}</small></span>
                      <Pill tone={String(a.date) === today ? 'green' : 'blue'}>{String(a.date) === today ? 'Today' : 'Scheduled'}</Pill>
                    </Link>
                  );
                })}
                {!upcoming.length && <p className="cell-sub">No upcoming tests or assignments.</p>}
              </div>
            </section>
          </div>

          <div className="dash-row two">
            <section className="card">
              <div className="dash-card-head pad">
                <h2><ClipboardList size={18} aria-hidden /> Recent Activity</h2>
                <div className="seg" role="tablist" aria-label="Activity filter">
                  {(['all', 'students', 'instructors', 'courses', 'recordings'] as const).map((t) => <button key={t} role="tab" aria-selected={activityTab === t} className={activityTab === t ? 'active' : ''} onClick={() => setActivityTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
                </div>
              </div>
              <div className="table-wrap"><table>
                <thead><tr><th>User</th><th>Role</th><th>Activity</th><th>Course / Class</th><th>Status</th><th>Date & time</th></tr></thead>
                <tbody>
                  {shownActivity.map((a) => (
                    <tr key={a.id}>
                      <td><span className="who"><span className="avatar small" aria-hidden>{a.who.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</span><strong>{a.who}</strong></span></td>
                      <td><span className={`role-tag ${a.role === 'Student' ? 'student' : 'instructor'}`}>{a.role}</span></td>
                      <td>{a.what}</td>
                      <td className="cell-sub" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.where}</td>
                      <td><Pill tone={a.tone}>{a.tone === 'green' ? <CheckCircle2 size={12} aria-hidden /> : null} {a.status}</Pill></td>
                      <td className="cell-sub">{formatDateTime(a.at)}</td>
                    </tr>
                  ))}
                  {!shownActivity.length && <tr><td className="empty" colSpan={6}>No activity yet.</td></tr>}
                </tbody>
              </table></div>
            </section>

            <section className="card">
              <div className="dash-card-head pad"><h2><MonitorPlay size={18} aria-hidden /> Recording Review Queue</h2><Link className="link" to="/lectures">View all{awaiting ? ` (${awaiting} waiting)` : ''}</Link></div>
              <div className="queue">
                {queue.map((r) => (
                  <div key={r.id} className="queue-item">
                    <Thumbnail path={r.thumbnailPath} alt="" />
                    <div className="grow">
                      <strong>{r.lectureNumber ? `L${r.lectureNumber} · ` : ''}{r.topic}</strong>
                      <small>By {r.facultyName || 'Instructor'} · {r.subjectName}</small>
                      <small><CalendarDays size={11} aria-hidden /> {formatDateTime(r.uploadedAt)}</small>
                    </div>
                    {r.publicationStatus === 'published'
                      ? <Pill tone="green"><CheckCircle2 size={12} aria-hidden /> Published</Pill>
                      : <button className="btn btn-sm" disabled={publishing === r.id} onClick={() => void approve(r)}><CheckCircle2 size={14} /> Approve</button>}
                    <Link className="btn btn-outline btn-sm" to={`/recordings/${r.id}`}>Review</Link>
                  </div>
                ))}
                {!queue.length && <p className="cell-sub" style={{ padding: '0 16px' }}>No uploaded lectures yet.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
