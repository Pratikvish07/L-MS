import { BookOpen, ChevronRight, GraduationCap, Layers, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { deleteBatch, deleteDegree, deleteStream, deleteSubject, saveBatch, saveDegree, saveStream, saveSubject } from '../lib/data';
import { yearLabel } from '../lib/format';
import { useStore } from '../lib/store';
import type { AppUser, Degree, Stream, Subject } from '../lib/types';
import { ConfirmDialog, Modal } from './Modal';
import { Avatar, Pill } from './ui';

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function FormFooter({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: () => void }) {
  return (
    <>
      <button className="btn btn-outline" onClick={onClose}>
        Cancel
      </button>
      <button className="btn" onClick={onSave} disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </>
  );
}

// ------------------------------------------------------------------ degree

function DegreeForm({ degree, onClose }: { degree?: Degree; onClose: () => void }) {
  const { degrees, subjects } = useStore();
  const [name, setName] = useState(degree?.name ?? '');
  const [durationYears, setDuration] = useState(degree?.durationYears ?? 4);
  const [active, setActive] = useState(degree?.active ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const highestUsedYear = degree ? Math.max(0, ...subjects.filter((s) => s.degreeId === degree.id).map((s) => s.year)) : 0;

  const save = async () => {
    if (!name.trim()) return setError('Degree name is required.');
    if (degrees.some((d) => d.id !== degree?.id && same(d.name, name))) return setError(`${name.trim()} already exists.`);
    if (durationYears < highestUsedYear) return setError(`Subjects exist in ${yearLabel(highestUsedYear)}. Keep at least ${highestUsedYear} years.`);
    setBusy(true);
    try {
      await saveDegree({ name, durationYears, active }, degree?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  };

  return (
    <Modal title={degree ? `Edit ${degree.name}` : 'Add Degree'} onClose={onClose} footer={<FormFooter busy={busy} onClose={onClose} onSave={save} />}>
      {error && <div className="alert">{error}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Degree</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. B.Tech" autoFocus />
        </label>
        <label className="field">
          <span>Duration</span>
          <select className="input" value={durationYears} onChange={(e) => setDuration(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} year{n > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox full">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (shown to faculty)
        </label>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ stream

function StreamForm({ degree, stream, onClose }: { degree: Degree; stream?: Stream; onClose: () => void }) {
  const { streams } = useStore();
  const [name, setName] = useState(stream?.name ?? '');
  const [code, setCode] = useState(stream?.code ?? '');
  const [active, setActive] = useState(stream?.active ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || !code.trim()) return setError('Stream name and short code are required.');
    const siblings = streams.filter((s) => s.degreeId === degree.id && s.id !== stream?.id);
    if (siblings.some((s) => same(s.name, name))) return setError(`${degree.name} already has a stream named “${name.trim()}”.`);
    if (siblings.some((s) => same(s.code, code))) return setError(`${degree.name} already has a stream with code ${code.trim().toUpperCase()}.`);
    setBusy(true);
    try {
      await saveStream({ degreeId: degree.id, name, code, active }, stream?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={stream ? `Edit ${stream.name}` : `Add Stream to ${degree.name}`}
      onClose={onClose}
      footer={<FormFooter busy={busy} onClose={onClose} onSave={save} />}
    >
      {error && <div className="alert">{error}</div>}
      <div className="form-grid">
        <label className="field full">
          <span>Stream</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Computer Science & Engineering" autoFocus />
        </label>
        <label className="field">
          <span>Short code (unique)</span>
          <input className="input" value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CSE" />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------- subject

interface SubjectFormProps {
  subject?: Subject;
  initial: { degreeId: string; streamId: string; year: number };
  onClose: () => void;
}

function SubjectForm({ subject, initial, onClose }: SubjectFormProps) {
  const { degrees, streams, subjects, users } = useStore();
  const faculty = users.filter((u) => u.role === 'faculty');
  const [name, setName] = useState(subject?.name ?? '');
  const [code, setCode] = useState(subject?.code ?? '');
  const [degreeId, setDegreeId] = useState(subject?.degreeId || initial.degreeId);
  const [streamId, setStreamId] = useState(subject?.streamId || initial.streamId);
  const [year, setYear] = useState(subject?.year || initial.year);
  const [facultyUids, setFacultyUids] = useState<string[]>(subject?.facultyUids ?? []);
  const [active, setActive] = useState(subject?.active ?? true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const degree = degrees.find((d) => d.id === degreeId);
  const degreeStreams = streams.filter((s) => s.degreeId === degreeId);
  const visibleFaculty = faculty.filter((f) => !search.trim() || `${f.displayName} ${f.subject} ${f.email}`.toLowerCase().includes(search.trim().toLowerCase()));

  const toggleFaculty = (uid: string) =>
    setFacultyUids((list) => (list.includes(uid) ? list.filter((u) => u !== uid) : [...list, uid]));

  const save = async () => {
    if (!name.trim()) return setError('Subject name is required.');
    if (!degreeId || !streamId || !year) return setError('Choose the degree, stream and year.');
    const duplicate = subjects.some(
      (s) => s.id !== subject?.id && s.degreeId === degreeId && s.streamId === streamId && s.year === year && same(s.name, name),
    );
    if (duplicate) return setError(`“${name.trim()}” already exists for this stream and year.`);
    setBusy(true);
    try {
      await saveSubject({ name, code, degreeId, streamId, year, facultyUids, active }, subject?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  };

  return (
    <Modal title={subject ? `Edit ${subject.name}` : 'Add Subject'} onClose={onClose} footer={<FormFooter busy={busy} onClose={onClose} onSave={save} />}>
      {error && <div className="alert">{error}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Subject</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering Mathematics I" autoFocus />
        </label>
        <label className="field">
          <span>Subject code</span>
          <input className="input" value={code} maxLength={16} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. BTMA101" />
        </label>
        <label className="field">
          <span>Degree</span>
          <select
            className="input"
            value={degreeId}
            onChange={(e) => {
              setDegreeId(e.target.value);
              setStreamId('');
              setYear(1);
            }}
          >
            <option value="">Select degree</option>
            {degrees.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Stream</span>
          <select className="input" value={streamId} onChange={(e) => setStreamId(e.target.value)} disabled={!degreeId}>
            <option value="">Select stream</option>
            {degreeStreams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Year</span>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={!degree}>
            {Array.from({ length: degree?.durationYears ?? 1 }, (_, i) => i + 1).map((y) => (
              <option key={y} value={y}>
                {yearLabel(y)}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>

        <div className="field full">
          <span>Assigned faculty ({facultyUids.length})</span>
          <div className="picker">
            <div className="search">
              <Search size={14} aria-hidden />
              <input className="input" aria-label="Search faculty" placeholder="Search faculty" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="picker-list">
              {faculty.length === 0 && <div className="cell-sub" style={{ padding: 10 }}>No faculty accounts yet. Add them under Faculty.</div>}
              {visibleFaculty.map((f) => (
                <label key={f.uid} className="picker-item">
                  <input type="checkbox" checked={facultyUids.includes(f.uid)} onChange={() => toggleFaculty(f.uid)} />
                  <Avatar name={f.displayName} />
                  <span>
                    <strong>{f.displayName}</strong>
                    <small>{f.subject || f.email}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <p className="cell-sub full" style={{ margin: 0 }}>
          Chapters and topics are added by the assigned faculty in the mobile app (Subjects tab).
        </p>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- browser

function FacultyChips({ uids, users }: { uids: string[]; users: AppUser[] }) {
  const assigned = uids.map((uid) => users.find((u) => u.uid === uid)).filter((u): u is AppUser => !!u);
  if (!assigned.length) {
    return (
      <span className="cell-sub" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <UserRound size={14} aria-hidden /> No faculty assigned
      </span>
    );
  }
  return (
    <div className="chips">
      {assigned.map((u) => (
        <span key={u.uid} className="chip">
          <Avatar name={u.displayName} />
          {u.displayName}
        </span>
      ))}
    </div>
  );
}

function ChapterList({ subject }: { subject: Subject }) {
  const { chapters } = useStore();
  const [open, setOpen] = useState(false);
  const list = chapters.get(subject.id) ?? [];
  const legacy = list.length ? [] : subject.chapters;
  const count = list.length || legacy.length;
  const topicCount = list.reduce((n, c) => n + c.topics.length, 0);

  if (!count) {
    return (
      <div className="cell-sub">
        <BookOpen size={13} aria-hidden style={{ verticalAlign: -2 }} /> No chapters yet — faculty add them in the app
      </div>
    );
  }
  return (
    <div className="chapter-list">
      <button className="link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BookOpen size={13} aria-hidden style={{ verticalAlign: -2 }} /> {count} chapter{count === 1 ? '' : 's'}
        {list.length > 0 && ` · ${topicCount} topic${topicCount === 1 ? '' : 's'}`} {open ? '▴' : '▾'}
      </button>
      {open && (
        <ol>
          {list.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {c.createdByName && <span className="cell-sub"> · {c.createdByName}</span>}
              {c.topics.length > 0 && (
                <ul>
                  {c.topics.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {legacy.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

type Removal =
  | { kind: 'degree'; item: Degree }
  | { kind: 'stream'; item: Stream }
  | { kind: 'subject'; item: Subject };

export function Academics() {
  const { degrees, streams, subjects, users } = useStore();
  const [degreeId, setDegreeId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [year, setYear] = useState(1);
  const [degreeForm, setDegreeForm] = useState<Degree | 'new' | null>(null);
  const [streamForm, setStreamForm] = useState<Stream | 'new' | null>(null);
  const [subjectForm, setSubjectForm] = useState<Subject | 'new' | null>(null);
  const [removing, setRemoving] = useState<Removal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Keep a valid selection as data loads or changes.
  const degree = degrees.find((d) => d.id === degreeId) ?? degrees[0];
  const degreeStreams = useMemo(() => streams.filter((s) => s.degreeId === degree?.id), [streams, degree?.id]);
  const stream = degreeStreams.find((s) => s.id === streamId) ?? degreeStreams[0];
  const years = Array.from({ length: degree?.durationYears ?? 0 }, (_, i) => i + 1);
  const currentYear = years.includes(year) ? year : 1;

  useEffect(() => {
    if (degree && degree.id !== degreeId) setDegreeId(degree.id);
  }, [degree, degreeId]);

  const streamSubjects = subjects.filter((s) => s.degreeId === degree?.id && s.streamId === stream?.id);
  const yearSubjects = streamSubjects.filter((s) => s.year === currentYear);
  const legacy = subjects.filter((s) => !s.degreeId);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setError('');
    try {
      if (removing.kind === 'degree') await deleteDegree(removing.item.id);
      if (removing.kind === 'stream') await deleteStream(removing.item.id);
      if (removing.kind === 'subject') await deleteSubject(removing.item.id);
      setRemoving(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const askRemove = (r: Removal) => {
    setError('');
    if (r.kind === 'degree' && streams.some((s) => s.degreeId === r.item.id)) {
      return setError(`Remove the streams in ${r.item.name} first.`);
    }
    if (r.kind === 'stream' && subjects.some((s) => s.streamId === r.item.id)) {
      return setError(`Remove or move the subjects in ${r.item.name} first.`);
    }
    setRemoving(r);
  };

  return (
    <>
      {error && <div className="alert" role="alert">{error}</div>}

      {legacy.length > 0 && (
        <div className="notice">
          <strong>{legacy.length} subject(s) need a degree, stream and year:</strong>{' '}
          {legacy.map((s) => (
            <button key={s.id} className="link" style={{ marginRight: 10 }} onClick={() => setSubjectForm(s)}>
              {s.name} ({s.legacyClassName || 'no class'}) – assign
            </button>
          ))}
        </div>
      )}

      <div className="academics">
        {/* Degrees */}
        <section className="card acad-col" aria-label="Degrees">
          <header>
            <h2>
              <GraduationCap size={16} aria-hidden /> Degrees
            </h2>
            <button className="icon-btn" aria-label="Add degree" onClick={() => setDegreeForm('new')}>
              <Plus size={16} />
            </button>
          </header>
          {degrees.length === 0 && <div className="empty">Add a degree such as B.Tech (4 years).</div>}
          <ul>
            {degrees.map((d) => {
              const count = streams.filter((s) => s.degreeId === d.id).length;
              return (
                <li key={d.id} className={d.id === degree?.id ? 'active' : ''}>
                  <button className="acad-item" onClick={() => { setDegreeId(d.id); setStreamId(''); setYear(1); }} aria-current={d.id === degree?.id}>
                    <strong>{d.name}</strong>
                    <small>
                      {d.durationYears} years · {count} stream{count === 1 ? '' : 's'}
                      {!d.active && ' · inactive'}
                    </small>
                  </button>
                  <span className="row-actions">
                    <button className="icon-btn" aria-label={`Edit ${d.name}`} onClick={() => setDegreeForm(d)}><Pencil size={13} /></button>
                    <button className="icon-btn danger" aria-label={`Delete ${d.name}`} onClick={() => askRemove({ kind: 'degree', item: d })}><Trash2 size={13} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Streams */}
        <section className="card acad-col" aria-label="Streams">
          <header>
            <h2>
              <Layers size={16} aria-hidden /> Streams {degree && <span className="cell-sub">in {degree.name}</span>}
            </h2>
            <button className="icon-btn" aria-label="Add stream" disabled={!degree} onClick={() => setStreamForm('new')}>
              <Plus size={16} />
            </button>
          </header>
          {degree && degreeStreams.length === 0 && <div className="empty">Add streams like CSE, ECE, ME.</div>}
          <ul>
            {degreeStreams.map((s) => {
              const count = subjects.filter((x) => x.streamId === s.id).length;
              return (
                <li key={s.id} className={s.id === stream?.id ? 'active' : ''}>
                  <button className="acad-item" onClick={() => { setStreamId(s.id); setYear(1); }} aria-current={s.id === stream?.id}>
                    <strong>
                      {s.name} <span className="code">{s.code}</span>
                    </strong>
                    <small>
                      {count} subject{count === 1 ? '' : 's'}
                      {!s.active && ' · inactive'}
                    </small>
                  </button>
                  <span className="row-actions">
                    <button className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setStreamForm(s)}><Pencil size={13} /></button>
                    <button className="icon-btn danger" aria-label={`Delete ${s.name}`} onClick={() => askRemove({ kind: 'stream', item: s })}><Trash2 size={13} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Years and subjects */}
        <section className="card acad-main" aria-label="Subjects">
          {!degree || !stream ? (
            <div className="empty">
              <BookOpen size={28} aria-hidden />
              <p>{!degree ? 'Create a degree to get started.' : `Add a stream to ${degree.name} to manage its subjects.`}</p>
            </div>
          ) : (
            <>
              <header>
                <div className="crumbs">
                  {degree.name} <ChevronRight size={14} aria-hidden /> {stream.name} ({stream.code})
                </div>
                <button className="btn btn-sm" onClick={() => setSubjectForm('new')}>
                  <Plus size={14} /> Add Subject
                </button>
              </header>
              <div className="tabs year-tabs" role="tablist" aria-label="Year of study">
                {years.map((y) => {
                  const n = streamSubjects.filter((s) => s.year === y).length;
                  return (
                    <button key={y} role="tab" aria-selected={y === currentYear} className={y === currentYear ? 'active' : ''} onClick={() => setYear(y)}>
                      {yearLabel(y)} <span className="count">{n}</span>
                    </button>
                  );
                })}
              </div>

              {yearSubjects.length === 0 ? (
                <div className="empty">
                  No subjects in {yearLabel(currentYear)} yet.{' '}
                  <button className="link" onClick={() => setSubjectForm('new')}>
                    Add one
                  </button>
                </div>
              ) : (
                <div className="subject-grid">
                  {yearSubjects.map((s) => (
                    <article key={s.id} className="subject-card">
                      <div className="subject-head">
                        <div>
                          <h3>{s.name}</h3>
                          {s.code && <span className="code">{s.code}</span>}
                        </div>
                        <div className="actions">
                          <button className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setSubjectForm(s)}><Pencil size={14} /></button>
                          <button className="icon-btn danger" aria-label={`Delete ${s.name}`} onClick={() => askRemove({ kind: 'subject', item: s })}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <FacultyChips uids={s.facultyUids} users={users} />
                      <ChapterList subject={s} />
                      <div>{s.active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Inactive</Pill>}</div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {degreeForm && <DegreeForm degree={degreeForm === 'new' ? undefined : degreeForm} onClose={() => setDegreeForm(null)} />}
      {streamForm && degree && <StreamForm degree={degree} stream={streamForm === 'new' ? undefined : streamForm} onClose={() => setStreamForm(null)} />}
      {subjectForm && (
        <SubjectForm
          subject={subjectForm === 'new' ? undefined : subjectForm}
          initial={{ degreeId: degree?.id ?? '', streamId: stream?.id ?? '', year: currentYear }}
          onClose={() => setSubjectForm(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Delete ${removing.item.name}?`}
          message="Faculty will no longer be able to choose it. Existing recordings keep their details. Consider marking it inactive instead."
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}

export function BatchManagement() {
  const { degrees, streams, classrooms, batches } = useStore();
  const [degreeId, setDegreeId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [year, setYear] = useState(1);
  const [name, setName] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const degree = degrees.find((item) => item.id === degreeId);
  const degreeStreams = streams.filter((item) => item.degreeId === degreeId);
  const visible = batches.filter((item) => item.degreeId === degreeId && item.streamId === streamId && item.year === year);
  const add = async () => {
    if (!degreeId || !streamId || !name.trim()) return;
    const room = classrooms.find((item) => item.id === classroomId);
    await saveBatch({ degreeId, streamId, year, name: name.trim(), classroomId, classroomName: room ? `Room ${room.roomNo}` : '', active: true });
    setName('');
  };
  return <section className="card" style={{ marginTop: 18 }}>
    <header style={{ padding: 18, borderBottom: '1px solid var(--line)' }}><h2>Year Batches & Classrooms</h2><p className="cell-sub">Create separate batches for each degree, stream and year.</p></header>
    <div className="form-grid" style={{ padding: 18 }}>
      <label className="field"><span>Degree</span><select className="input" value={degreeId} onChange={(e) => { setDegreeId(e.target.value); setStreamId(''); }}><option value="">Select degree</option>{degrees.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.durationYears} years)</option>)}</select></label>
      <label className="field"><span>Stream</span><select className="input" value={streamId} onChange={(e) => setStreamId(e.target.value)}><option value="">Select stream</option>{degreeStreams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field"><span>Year</span><select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>{Array.from({ length: degree?.durationYears ?? 0 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}</select></label>
      <label className="field"><span>Batch name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Batch A" /></label>
      <label className="field"><span>Classroom</span><select className="input" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}><option value="">No classroom</option>{classrooms.map((c) => <option key={c.id} value={c.id}>Room {c.roomNo}</option>)}</select></label>
      <div style={{ alignSelf: 'end' }}><button className="btn" onClick={add}>+ Add batch</button></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Batch</th><th>Degree / Stream / Year</th><th>Classroom</th><th>Students</th><th /></tr></thead><tbody>{visible.map((batch) => <tr key={batch.id}><td className="cell-title">{batch.name}</td><td>{degree?.name} · {degreeStreams.find((s) => s.id === streamId)?.name} · {yearLabel(year)}</td><td>{batch.classroomName || 'Not assigned'}</td><td>Assign students from Users</td><td><button className="icon-btn danger" onClick={() => deleteBatch(batch.id)}><Trash2 size={15} /></button></td></tr>)}{!visible.length && <tr><td colSpan={5} className="empty">Select a degree, stream and year to view batches.</td></tr>}</tbody></table></div>
  </section>;
}
