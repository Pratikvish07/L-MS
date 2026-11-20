// Course management drill-down:
//   /courses                              → one button per course (+ Add course)
//   /courses/:courseId                    → one button per batch (+ New batch), subjects of the course
//   /courses/:courseId/batches/:batchId   → enrol students (CSV or one by one), instructor per subject
import { ArrowLeft, BookOpen, Download, Image as ImageIcon, ListChecks, Pencil, PlayCircle, Plus, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Pill, Spinner } from '../components/ui';
import {
  assignInstructor, createCourse, uploadCourseImage, deleteBatch, deleteCourse, deleteSubject, enrollStudents, parseStudentCsv, removeEnrollment,
  saveBatch, saveCourse, saveSubject, STUDENT_CSV_SAMPLE, subscribeBatch, subscribeCourse, subscribeCourseBatches,
  subscribeCourseEnrollments, subscribeCourses, subscribeCourseSubjects,
  type Course, type CourseBatch, type CourseSubject, type EnrollResult, type Enrollment, type StudentRow,
} from '../lib/courses';
import { couponProblem, discountLabel, subscribeCoupons, type Coupon } from '../lib/coupons';
import { useStore } from '../lib/store';
import { EnrollmentRequests } from './EnrollmentRequests';

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}

/** Keeps a live list/doc in state; `undefined` while loading. */
function useLive<T>(subscribe: (onData: (value: T) => void, onError: (error: Error) => void) => () => void, deps: unknown[]) {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    setValue(undefined);
    return subscribe(setValue, (cause) => setError(cause.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [value, error] as const;
}

/* ================================================================ courses */

type CourseForm = Omit<Course, 'id'>;
const emptyCourse = (): CourseForm => ({ title: '', description: '', category: '', level: '', delivery: '', imageUrl: '', status: 'active' });

function CourseFormModal({ course, onClose, onSaved }: { course: Course | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const [imageProgress, setImageProgress] = useState<number | null>(null);
  const [values, setValues] = useState<CourseForm>(() => ({ ...emptyCourse(), ...(course ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof CourseForm) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const save = async () => {
    if (!values.title.trim()) { setError('Course name is required.'); return; }
    setBusy(true); setError('');
    try {
      const { id: _id, ...fields } = { ...values, id: '' };
      if (course) { await saveCourse(course.id, { ...fields, title: values.title.trim() }); onClose(); }
      else { const id = await createCourse(fields); onClose(); onSaved?.(id); }
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  return (
    <Modal title={course ? `Edit ${course.title}` : 'Add course'} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || imageProgress !== null} onClick={() => void save()}>{busy ? 'Saving…' : course ? 'Save course' : 'Add course'}</button></>}>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="form-grid">
        <label className="field full"><span>Course name *</span><input className="input" autoFocus placeholder="e.g. B.Tech Computer Science" value={values.title} onChange={set('title')} /></label>
        <label className="field"><span>Category</span><input className="input" value={values.category} onChange={set('category')} /></label>
        <label className="field"><span>Level</span><input className="input" value={values.level} onChange={set('level')} /></label>
        <label className="field"><span>Delivery</span><select className="input" value={values.delivery} onChange={set('delivery')}><option value="">Select</option>{['Online', 'In person', 'Hybrid'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Status</span><select className="input" value={values.status} onChange={set('status')}>{['active', 'published', 'draft', 'inactive', 'archived'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="field full"><span>Course image</span>
          <div className="image-picker">
            <div className="image-preview">{values.imageUrl ? <img src={values.imageUrl} alt="Course" /> : <ImageIcon size={26} aria-hidden />}</div>
            <div className="image-actions">
              <label className={`btn btn-outline btn-sm${imageProgress !== null ? ' disabled' : ''}`}>
                <Upload size={14} /> {imageProgress !== null ? `Uploading ${Math.round(imageProgress * 100)}%` : values.imageUrl ? 'Replace image' : 'Upload image'}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" disabled={imageProgress !== null} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setError(''); setImageProgress(0);
                  uploadCourseImage(file, setImageProgress)
                    .then((url) => setValues((current) => ({ ...current, imageUrl: url })))
                    .catch((cause) => setError(`${message(cause)} Check that Firebase Storage is turned on and storage.rules are published.`))
                    .finally(() => setImageProgress(null));
                }} />
              </label>
              {values.imageUrl && <button type="button" className="btn btn-outline btn-sm" onClick={() => setValues((current) => ({ ...current, imageUrl: '' }))}><Trash2 size={14} /> Remove</button>}
              <small className="cell-sub">JPG, PNG or WebP up to 5 MB. Or paste an image link:</small>
              <input className="input" type="url" placeholder="https://…" value={values.imageUrl} onChange={set('imageUrl')} />
            </div>
          </div>
        </div>
        <label className="field full"><span>Description</span><textarea className="input" style={{ minHeight: 80 }} value={values.description} onChange={set('description')} /></label>
      </div>
    </Modal>
  );
}

export function CoursesPage() {
  const [courses, error] = useLive<Course[]>(subscribeCourses, []);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <PageHead title="Course Management" subtitle="Each course opens its batch management"><button className="btn" onClick={() => setAdding(true)}><Plus size={16} /> Add course</button></PageHead>
      {error && <div className="alert" role="alert">{error}</div>}
      {!courses ? <Spinner /> : (
        <div className="tile-grid">
          {courses.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} className="tile">
              {course.imageUrl ? <img className="tile-image" src={course.imageUrl} alt="" /> : <span className="tile-icon"><BookOpen size={20} aria-hidden /></span>}
              <strong>{course.title || 'Untitled course'}</strong>
              <small>{[course.category, course.status].filter(Boolean).join(' · ') || 'Course'}</small>
            </Link>
          ))}
          <button className="tile tile-add" onClick={() => setAdding(true)}><Plus size={22} aria-hidden /><strong>Add course</strong></button>
        </div>
      )}
      {adding && <CourseFormModal course={null} onClose={() => setAdding(false)} />}
      {courses && !courses.length && <p className="cell-sub">No courses yet. Add your first course; it appears here as a button.</p>}
    </>
  );
}

/* ================================================================= course */

const emptyBatch = (courseId: string): Omit<CourseBatch, 'id'> => ({ courseId, name: '', year: 1, classroomId: '', classroomName: '', capacity: 0, startDate: '', endDate: '', active: true });

function BatchFormModal({ courseId, batch, onClose }: { courseId: string; batch: CourseBatch | null; onClose: () => void }) {
  const { classrooms } = useStore();
  const [values, setValues] = useState(() => ({ ...emptyBatch(courseId), ...(batch ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chooseClassroom = (classroomId: string) => {
    const room = classrooms.find((item) => item.id === classroomId);
    setValues((current) => ({ ...current, classroomId, classroomName: room ? `Room ${room.roomNo}` : '', capacity: current.capacity || room?.capacity || 0 }));
  };
  const save = async () => {
    if (!values.name.trim()) { setError('Batch name is required.'); return; }
    if (values.endDate && values.startDate && values.endDate < values.startDate) { setError('End date must be after the start date.'); return; }
    setBusy(true); setError('');
    const { id: _id, ...fields } = { ...values, id: '' };
    try { await saveBatch({ ...fields, courseId, year: Number(values.year) || 1, capacity: Number(values.capacity) || 0 }, batch?.id); onClose(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  return (
    <Modal title={batch ? `Edit ${batch.name}` : 'New batch'} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : batch ? 'Save batch' : 'Create batch'}</button></>}>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="form-grid">
        <label className="field full"><span>Batch name *</span><input className="input" autoFocus placeholder="e.g. 2026 Morning" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
        <label className="field"><span>Year of study</span><input className="input" type="number" min={1} max={6} value={values.year} onChange={(event) => setValues({ ...values, year: Number(event.target.value) })} /></label>
        <label className="field"><span>Classroom</span><select className="input" value={values.classroomId} onChange={(event) => chooseClassroom(event.target.value)}><option value="">Select</option>{classrooms.filter((room) => room.active !== false).map((room) => <option key={room.id} value={room.id}>Room {room.roomNo} ({room.capacity} seats)</option>)}</select></label>
        <label className="field"><span>Capacity (0 = no limit)</span><input className="input" type="number" min={0} value={values.capacity} onChange={(event) => setValues({ ...values, capacity: Number(event.target.value) })} /></label>
        <label className="field checkbox" style={{ alignSelf: 'end' }}><input type="checkbox" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} /> Active</label>
        <label className="field"><span>Start date</span><input className="input" type="date" value={values.startDate} onChange={(event) => setValues({ ...values, startDate: event.target.value })} /></label>
        <label className="field"><span>End date</span><input className="input" type="date" value={values.endDate} onChange={(event) => setValues({ ...values, endDate: event.target.value })} /></label>
      </div>
    </Modal>
  );
}

export function CoursePage() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, courseError] = useLive<Course | null>((onData, onError) => subscribeCourse(courseId, onData, onError), [courseId]);
  const [batches, batchError] = useLive<CourseBatch[]>((onData, onError) => subscribeCourseBatches(courseId, onData, onError), [courseId]);
  const [enrollments] = useLive<Enrollment[]>((onData, onError) => subscribeCourseEnrollments(courseId, onData, onError), [courseId]);
  const [addingBatch, setAddingBatch] = useState(false);
  const [editingCourse, setEditingCourse] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const counts = useMemo(() => (enrollments ?? []).reduce<Record<string, number>>((map, item) => ({ ...map, [item.batchId]: (map[item.batchId] ?? 0) + 1 }), {}), [enrollments]);

  const back = <button className="btn btn-outline" onClick={() => navigate('/courses')}><ArrowLeft size={16} /> All courses</button>;
  if (course === undefined) return <Spinner />;
  if (course === null) return <PageHead title="Course not found">{back}</PageHead>;

  const remove = async () => {
    setBusy(true);
    try { await deleteCourse(course.id); navigate('/courses'); } catch (cause) { setError(message(cause)); setBusy(false); }
  };

  return (
    <>
      <PageHead title={course.title || 'Untitled course'} subtitle="Subjects and batch management">
        {back}
        <button className="btn btn-outline" onClick={() => setEditingCourse(true)}><Pencil size={14} /> Edit course</button>
        <button className="btn btn-soft-danger" onClick={() => { setError(''); if (batches?.length) setError('Delete this course’s batches first.'); else setRemoving(true); }}><Trash2 size={14} /> Delete</button>
      </PageHead>
      {(error || courseError || batchError) && <div className="alert" role="alert">{error || courseError || batchError}</div>}

      <EnrollmentRequests courseId={course.id} batches={batches ?? []} />
      <CourseOffers course={course} />

      <SubjectsSection course={course} batches={batches ?? []} />

      <section className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="section-head"><h2>Batches</h2><button className="btn" onClick={() => setAddingBatch(true)}><Plus size={16} /> New batch</button></div>
        {!batches ? <Spinner /> : (
          <div className="tile-grid">
            {batches.map((batch) => (
              <Link key={batch.id} to={`/courses/${course.id}/batches/${batch.id}`} className="tile">
                <span className="tile-icon"><Users size={20} aria-hidden /></span>
                <strong>{batch.name}</strong>
                <small>Year {batch.year} · {counts[batch.id] ?? 0}{batch.capacity ? ` / ${batch.capacity}` : ''} students{batch.active ? '' : ' · inactive'}</small>
              </Link>
            ))}
            <button className="tile tile-add" onClick={() => setAddingBatch(true)}><Plus size={22} aria-hidden /><strong>New batch</strong></button>
          </div>
        )}
      </section>

      {addingBatch && <BatchFormModal courseId={course.id} batch={null} onClose={() => setAddingBatch(false)} />}
      {editingCourse && <CourseFormModal course={course} onClose={() => setEditingCourse(false)} />}
      {removing && <ConfirmDialog title="Delete course" message={<>Delete <strong>{course.title}</strong>? This cannot be undone.</>} busy={busy} onConfirm={() => void remove()} onCancel={() => setRemoving(false)} />}
    </>
  );
}

/** Coupons currently valid for this course. */
function CourseOffers({ course }: { course: Course }) {
  const [coupons] = useLive<Coupon[]>(subscribeCoupons, []);
  const live = (coupons ?? []).filter((coupon) => !couponProblem(coupon, course.id));
  return (
    <section className="card card-pad course-offers" style={{ marginBottom: 18 }}>
      <div style={{ flex: 1 }}>
        <span className="cell-sub">Active coupons for this course</span>
        <div className="chips" style={{ marginTop: 6 }}>
          {live.map((coupon) => <span key={coupon.id} className="icon-chip ok" title={coupon.description}><code>{coupon.code}</code> {discountLabel(coupon)}</span>)}
          {!live.length && <span className="cell-sub">None.</span>}
          <Link className="link" to="/coupons" style={{ fontSize: 13 }}>Manage coupons</Link>
        </div>
      </div>
    </section>
  );
}

/* Subjects belong to the course; instructors are assigned per batch on the batch page. */
const emptySubject = (courseId: string): Omit<CourseSubject, 'id'> => ({ courseId, name: '', code: '', year: 1, description: '', facultyUids: [], facultyNames: [], active: true });

function SubjectsSection({ course, batches }: { course: Course; batches: CourseBatch[] }) {
  const { users } = useStore();
  const instructors = useMemo(() => users.filter((user) => user.role === 'faculty' && user.active !== false), [users]);
  const [subjects] = useLive<CourseSubject[]>((onData, onError) => subscribeCourseSubjects(course.id, onData, onError), [course.id]);
  const [editing, setEditing] = useState<CourseSubject | 'new' | null>(null);
  const [values, setValues] = useState(emptySubject(course.id));
  const [removing, setRemoving] = useState<CourseSubject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = (subject: CourseSubject | 'new') => { setError(''); setValues(subject === 'new' ? emptySubject(course.id) : { ...emptySubject(course.id), ...subject }); setEditing(subject); };
  const save = async () => {
    if (!values.name.trim()) { setError('Subject name is required.'); return; }
    setBusy(true); setError('');
    const { id: _id, ...fields } = { ...values, id: '' };
    const instructor = instructors.find((user) => user.uid === values.instructorUid);
    try { await saveSubject({ ...fields, courseId: course.id, year: Number(values.year) || 1, instructorUid: instructor?.uid ?? '', instructorName: instructor?.displayName ?? '' }, editing === 'new' ? undefined : editing?.id, batches); setEditing(null); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try { await deleteSubject(removing.id); setRemoving(null); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  return (
    <section className="card card-pad" style={{ marginBottom: 18 }}>
      <div className="section-head"><h2>Subjects</h2><button className="btn" onClick={() => open('new')}><Plus size={16} /> New subject</button></div>
      {error && !editing && <div className="alert" role="alert">{error}</div>}
      {!subjects ? <Spinner /> : (
        <div className="tile-grid">
          {subjects.map((subject) => (
            <div key={subject.id} className="tile tile-subject">
              <Link to={`/courses/${course.id}/subjects/${subject.id}`} className="tile-link">
                <span className="tile-icon"><BookOpen size={20} aria-hidden /></span>
                <strong>{subject.name}</strong>
                <small>{[subject.code, `Year ${subject.year || 1}`, subject.active === false ? 'inactive' : ''].filter(Boolean).join(' · ')}</small>
                <small>{subject.instructorName ? `Instructor: ${subject.instructorName}` : 'No instructor assigned'}</small>
                <span className="tile-cta">Tests · Assignments · Marks →</span>
              </Link>
              <button className="icon-btn tile-edit" aria-label={`Edit ${subject.name}`} title="Edit subject" onClick={() => open(subject)}><Pencil size={14} /></button>
            </div>
          ))}
          <button className="tile tile-add" onClick={() => open('new')}><Plus size={22} aria-hidden /><strong>New subject</strong></button>
        </div>
      )}
      {subjects && !subjects.length && <p className="cell-sub" style={{ marginBottom: 0 }}>Add the subjects of this course. Instructors are assigned per subject inside each batch.</p>}
      {editing && <Modal title={editing === 'new' ? 'New subject' : `Edit ${editing.name}`} onClose={() => setEditing(null)} footer={<>{editing !== 'new' && <button className="btn btn-soft-danger" style={{ marginRight: 'auto' }} onClick={() => { setRemoving(editing); setEditing(null); }}><Trash2 size={14} /> Delete</button>}<button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : editing === 'new' ? 'Create subject' : 'Save subject'}</button></>}>
        {error && <div className="alert" role="alert">{error}</div>}
        <div className="form-grid">
          <label className="field"><span>Subject name *</span><input className="input" autoFocus value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
          <label className="field"><span>Code</span><input className="input" value={values.code} onChange={(event) => setValues({ ...values, code: event.target.value })} /></label>
          <label className="field"><span>Year of study</span><input className="input" type="number" min={1} max={6} value={values.year} onChange={(event) => setValues({ ...values, year: Number(event.target.value) })} /></label>
          <label className="field checkbox" style={{ alignSelf: 'end' }}><input type="checkbox" checked={values.active} onChange={(event) => setValues({ ...values, active: event.target.checked })} /> Active</label>
          <label className="field full"><span>Instructor (from Instructor Master)</span>
            <select className="input" value={values.instructorUid ?? ''} onChange={(event) => setValues({ ...values, instructorUid: event.target.value })}>
              <option value="">Not assigned</option>
              {instructors.map((user) => <option key={user.uid} value={user.uid}>{user.displayName}{user.facultyId ? ` (${user.facultyId})` : ''}</option>)}
            </select>
            <small className="cell-sub">{instructors.length ? 'Used for every batch. A batch can pick a different instructor on its own page.' : 'No active instructors yet. Add them under Instructor Master.'}</small>
          </label>
        </div>
      </Modal>}
      {removing && <ConfirmDialog title="Delete subject" message={<>Delete <strong>{removing.name}</strong>?</>} busy={busy} onConfirm={() => void remove()} onCancel={() => setRemoving(null)} />}
    </section>
  );
}

/* ================================================================== batch */

export function BatchPage() {
  const { courseId = '', batchId = '' } = useParams<{ courseId: string; batchId: string }>();
  const navigate = useNavigate();
  const { users } = useStore();
  const [course] = useLive<Course | null>((onData, onError) => subscribeCourse(courseId, onData, onError), [courseId]);
  const [batch, batchError] = useLive<CourseBatch | null>((onData, onError) => subscribeBatch(batchId, onData, onError), [batchId]);
  const [allBatches] = useLive<CourseBatch[]>((onData, onError) => subscribeCourseBatches(courseId, onData, onError), [courseId]);
  const [subjects] = useLive<CourseSubject[]>((onData, onError) => subscribeCourseSubjects(courseId, onData, onError), [courseId]);
  const [enrollments] = useLive<Enrollment[]>((onData, onError) => subscribeCourseEnrollments(courseId, onData, onError), [courseId]);
  const [enrolMode, setEnrolMode] = useState<'type' | 'upload' | null>(null);
  const [editing, setEditing] = useState(false);
  const [removingBatch, setRemovingBatch] = useState(false);
  const [removing, setRemoving] = useState<Enrollment | null>(null);
  const [savingSubject, setSavingSubject] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const instructors = useMemo(() => users.filter((user) => user.role === 'faculty' && user.active !== false), [users]);
  const students = useMemo(() => (enrollments ?? []).filter((item) => item.batchId === batchId), [enrollments, batchId]);
  const visible = students.filter((item) => !search.trim() || `${item.studentName} ${item.studentEmail} ${item.purchaseId}`.toLowerCase().includes(search.trim().toLowerCase()));
  const back = <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}`)}><ArrowLeft size={16} /> {course?.title ?? 'Course'}</button>;

  if (batch === undefined) return <Spinner />;
  if (batch === null || batch.courseId !== courseId) return <PageHead title="Batch not found">{back}</PageHead>;

  const assign = async (subject: CourseSubject, uid: string) => {
    setSavingSubject(subject.id); setError('');
    const person = instructors.find((user) => user.uid === uid);
    try { await assignInstructor(batch, allBatches ?? [], subject, person ? { uid: person.uid, name: person.displayName } : null); } catch (cause) { setError(message(cause)); } finally { setSavingSubject(''); }
  };
  const removeStudent = async () => {
    if (!removing) return;
    setBusy(true); setError('');
    try { await removeEnrollment(removing.id); setRemoving(null); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const removeBatch = async () => {
    setBusy(true);
    try { await deleteBatch(batch.id); navigate(`/courses/${courseId}`); } catch (cause) { setError(message(cause)); setBusy(false); }
  };

  return (
    <>
      <PageHead title={batch.name} subtitle={`${course?.title ?? ''} · Year ${batch.year}${batch.classroomName ? ` · ${batch.classroomName}` : ''}`}>
        {back}
        <button className="btn" onClick={() => navigate(`/courses/${courseId}/batches/${batch.id}/lectures`)}><PlayCircle size={14} /> Lectures</button>
        <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}/batches/${batch.id}/marks`)}><ListChecks size={14} /> Marks</button>
        <button className="btn btn-outline" onClick={() => setEditing(true)}><Pencil size={14} /> Edit batch</button>
        <button className="btn btn-soft-danger" onClick={() => { setError(''); if (students.length) setError(`Remove the ${students.length} students first.`); else setRemovingBatch(true); }}><Trash2 size={14} /> Delete</button>
      </PageHead>
      {(error || batchError) && <div className="alert" role="alert">{error || batchError}</div>}

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="toolbar"><strong style={{ flex: 1 }}>Assign instructors</strong><span className="cell-sub">Instructors come from Instructor Master</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Subject</th><th>Instructor</th></tr></thead>
          <tbody>
            {(subjects ?? []).map((subject) => (
              <tr key={subject.id}>
                <td><div className="cell-title">{subject.name}</div><div className="cell-sub">{subject.code}</div></td>
                <td>
                  <select className="input" style={{ maxWidth: 320 }} aria-label={`Instructor for ${subject.name}`} disabled={savingSubject === subject.id} value={batch.subjectInstructors?.[subject.id]?.uid ?? ''} onChange={(event) => void assign(subject, event.target.value)}>
                    <option value="">{subject.instructorName ? `Course default: ${subject.instructorName}` : 'Not assigned'}</option>
                    {instructors.map((user) => <option key={user.uid} value={user.uid}>{user.displayName}{user.facultyId ? ` (${user.facultyId})` : ''}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {subjects && !subjects.length && <tr><td className="empty" colSpan={2}>This course has no subjects yet. <Link className="link" to={`/courses/${courseId}`}>Add subjects on the course page.</Link></td></tr>}
          </tbody>
        </table></div>
      </section>

      <section className="card">
        <div className="toolbar">
          <strong style={{ flex: 1 }}>Students ({students.length}{batch.capacity ? ` / ${batch.capacity}` : ''})</strong>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Search name, email, purchase ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button className="btn btn-outline" onClick={() => setEnrolMode('upload')}><Upload size={14} /> Upload CSV</button>
          <button className="btn" onClick={() => setEnrolMode('type')}><UserPlus size={14} /> Add student</button>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Student</th><th>Purchase ID</th><th>Enrolled</th><th>Actions</th></tr></thead>
          <tbody>
            {visible.map((item) => <tr key={item.id}><td><Link className="cell-title link" to={`/students/${item.studentUid}`}>{item.studentName}</Link><div className="cell-sub">{item.studentEmail}</div></td><td><code>{item.purchaseId}</code></td><td>{item.enrolledAt ? new Date(item.enrolledAt).toLocaleDateString() : '—'}</td><td><button className="btn btn-soft-danger btn-sm" onClick={() => setRemoving(item)}>Remove</button></td></tr>)}
            {!visible.length && <tr><td className="empty" colSpan={4}>{students.length ? 'No students match your search.' : 'No students yet. Upload a CSV or add them one by one.'}</td></tr>}
          </tbody>
        </table></div>
      </section>

      {enrolMode && <EnrollModal courseId={courseId} batch={batch} initialMode={enrolMode} onClose={() => setEnrolMode(null)} />}
      {editing && <BatchFormModal courseId={courseId} batch={batch} onClose={() => setEditing(false)} />}
      {removing && <ConfirmDialog title="Remove student" confirmLabel="Remove" message={<>Remove <strong>{removing.studentName}</strong> from <strong>{batch.name}</strong>? They lose access to this course. Their login stays.</>} busy={busy} onConfirm={() => void removeStudent()} onCancel={() => setRemoving(null)} />}
      {removingBatch && <ConfirmDialog title="Delete batch" message={<>Delete <strong>{batch.name}</strong>? This cannot be undone.</>} busy={busy} onConfirm={() => void removeBatch()} onCancel={() => setRemovingBatch(false)} />}
    </>
  );
}

/* --------------------------------------------------------------- enrolment */

const blankRow = (): StudentRow => ({ name: '', email: '', phone: '', password: '' });

function EnrollModal({ courseId, batch, initialMode, onClose }: { courseId: string; batch: CourseBatch; initialMode: 'type' | 'upload'; onClose: () => void }) {
  const [coupons] = useLive<Coupon[]>(subscribeCoupons, []);
  const [couponCode, setCouponCode] = useState('');
  const usable = (coupons ?? []).filter((coupon) => !couponProblem(coupon, courseId));
  const selectedCoupon = usable.find((coupon) => coupon.code === couponCode);
  const [mode, setMode] = useState(initialMode);
  const [typed, setTyped] = useState<StudentRow[]>([blankRow()]);
  const [uploaded, setUploaded] = useState<{ rows: StudentRow[]; errors: string[]; fileName: string } | null>(null);
  const [results, setResults] = useState<EnrollResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rows = mode === 'type' ? typed.filter((row) => row.email.trim()) : uploaded?.rows ?? [];
  const update = (index: number, key: keyof StudentRow, value: string) => setTyped((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const readFile = async (file: File | undefined) => { setError(''); setUploaded(file ? { ...parseStudentCsv(await file.text()), fileName: file.name } : null); };
  const submit = async () => {
    if (!rows.length) { setError(mode === 'type' ? 'Enter at least one student email.' : 'Choose a CSV file with at least one student.'); return; }
    setBusy(true); setError('');
    try { setResults(await enrollStudents(courseId, batch.id, rows.map((row) => ({ ...row, email: row.email.trim().toLowerCase(), name: row.name.trim() })), couponCode)); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };
  const exportResults = () => downloadText(`${batch.name}-enrolment.csv`, ['email,status,purchaseId,coupon,temporaryPassword,message', ...(results ?? []).map((item) => [item.email, item.status, item.purchaseId ?? '', item.couponCode ?? '', item.password ?? '', (item.message ?? '').replace(/,/g, ';')].join(','))].join('\n'));

  if (results) {
    const ok = results.filter((item) => item.status !== 'error').length;
    return (
      <Modal title={`Enrolment result: ${batch.name}`} onClose={onClose} footer={<><button className="btn btn-outline" onClick={exportResults}><Download size={14} /> Download results</button><button className="btn" onClick={onClose}>Done</button></>}>
        <div className="notice">{ok} of {results.length} students enrolled. New accounts get a temporary password. Download the results now: passwords are not shown again.</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Email</th><th>Result</th><th>Purchase ID</th><th>Coupon</th><th>Temporary password</th></tr></thead>
          <tbody>{results.map((item) => <tr key={item.email}><td>{item.email}</td><td>{item.status === 'error' ? <span className="error-text">{item.message}</span> : <Pill tone={item.status === 'created' ? 'green' : 'blue'}>{item.status === 'created' ? 'New account' : item.status === 'moved' ? 'Moved to this batch' : 'Enrolled'}</Pill>}</td><td><code>{item.purchaseId ?? '—'}</code></td><td>{item.couponCode ? <code>{item.couponCode}</code> : '—'}</td><td><code>{item.password ?? '—'}</code></td></tr>)}</tbody>
        </table></div>
      </Modal>
    );
  }

  return (
    <Modal title={`Enrol students: ${batch.name}`} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !rows.length} onClick={() => void submit()}>{busy ? 'Enrolling…' : `Enrol ${rows.length || ''} student${rows.length === 1 ? '' : 's'}`}</button></>}>
      <div className="seg" role="tablist" style={{ marginBottom: 14 }}>
        <button role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'active' : ''} onClick={() => setMode('type')}>One by one</button>
        <button role="tab" aria-selected={mode === 'upload'} className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload CSV</button>
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <p className="cell-sub" style={{ marginTop: 0 }}>New emails get a login (temporary password unless you set one). Existing students are approved and moved into this batch. Each enrolment gets a purchase ID.</p>
      <div className="coupon-apply">
        <label className="field" style={{ flex: 1 }}><span>Coupon (optional)</span>
          <select className="input" value={couponCode} onChange={(event) => setCouponCode(event.target.value)}>
            <option value="">No coupon</option>
            {usable.map((coupon) => <option key={coupon.id} value={coupon.code}>{coupon.code} · {discountLabel(coupon)}{coupon.usageLimit ? ` · ${coupon.usageLimit - coupon.usedCount} left` : ''}</option>)}
          </select>
        </label>
      </div>
      {selectedCoupon && <p className="cell-sub">The coupon applies to new enrolments only and counts one use per student.{selectedCoupon.usageLimit && rows.length > selectedCoupon.usageLimit - selectedCoupon.usedCount ? ` Only ${selectedCoupon.usageLimit - selectedCoupon.usedCount} uses are left, so later rows will fail.` : ''}</p>}
      {mode === 'type' ? (
        <>
          {typed.map((row, index) => (
            <div key={index} className="form-grid enrol-row">
              <label className="field"><span>Name</span><input className="input" value={row.name} onChange={(event) => update(index, 'name', event.target.value)} /></label>
              <label className="field"><span>Email *</span><input className="input" type="email" value={row.email} onChange={(event) => update(index, 'email', event.target.value)} /></label>
              <label className="field"><span>Phone</span><input className="input" value={row.phone} onChange={(event) => update(index, 'phone', event.target.value)} /></label>
              <label className="field"><span>Password</span><input className="input" placeholder="auto" value={row.password} onChange={(event) => update(index, 'password', event.target.value)} /></label>
              <button className="icon-btn danger" aria-label="Remove row" disabled={typed.length === 1} onClick={() => setTyped((current) => current.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => setTyped((current) => [...current, blankRow()])}><Plus size={14} /> Add another student</button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="btn btn-outline"><Upload size={14} /> Choose CSV<input type="file" accept=".csv,text/csv" hidden onChange={(event) => void readFile(event.target.files?.[0])} /></label>
            <button className="btn btn-outline" onClick={() => downloadText('students-sample.csv', STUDENT_CSV_SAMPLE)}><Download size={14} /> Download sample</button>
            {uploaded && <span className="cell-sub">{uploaded.fileName}: {uploaded.rows.length} valid row{uploaded.rows.length === 1 ? '' : 's'}</span>}
          </div>
          <p className="cell-sub">Columns: <code>name,email,phone,password</code>. Only <code>email</code> is required; leave password empty to generate one.</p>
          {uploaded?.errors.length ? <div className="alert">{uploaded.errors.slice(0, 8).map((item) => <div key={item}>{item}</div>)}{uploaded.errors.length > 8 && <div>…and {uploaded.errors.length - 8} more</div>}</div> : null}
          {uploaded?.rows.length ? <div className="table-wrap" style={{ maxHeight: 240 }}><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead><tbody>{uploaded.rows.slice(0, 50).map((row) => <tr key={row.email}><td>{row.name || '—'}</td><td>{row.email}</td><td>{row.phone || '—'}</td></tr>)}</tbody></table></div> : null}
        </>
      )}
    </Modal>
  );
}
