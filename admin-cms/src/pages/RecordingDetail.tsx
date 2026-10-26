import {
  ArrowLeft,
  Book,
  Building2,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  FileVideo,
  GraduationCap,
  Pencil,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { ConfirmDialog, Modal } from '../components/Modal';
import { Spinner, StatusPill } from '../components/ui';
import { VideoPlayer } from '../components/VideoPlayer';
import { deleteRecording, publishRecording, saveRecordingNotes, updateRecordingMetadata, type RecordingEdit } from '../lib/data';
import { formatBytes, formatDateTime, formatDuration, yearLabel } from '../lib/format';
import { useStore } from '../lib/store';
import type { Recording } from '../lib/types';

function toLocalInput(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function EditModal({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  const { classrooms } = useStore();
  const [form, setForm] = useState<RecordingEdit>({
    topic: recording.topic,
    chapter: recording.chapter,
    className: recording.className,
    classroomId: recording.classroomId,
    classroomName: recording.classroomName,
    recordedAt: recording.recordedAt,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.topic.trim() || !form.chapter.trim() || !form.className.trim()) {
      setError('Topic, chapter and class are required.');
      return;
    }
    setBusy(true);
    try {
      await updateRecordingMetadata(recording.id, { ...form, topic: form.topic.trim(), chapter: form.chapter.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Edit recording details"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      {error && <div className="alert">{error}</div>}
      <div className="form-grid">
        <label className="field full">
          <span>Topic</span>
          <input className="input" maxLength={120} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
        </label>
        <label className="field">
          <span>Chapter</span>
          <input className="input" maxLength={120} value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
        </label>
        <label className="field">
          <span>Class</span>
          <input className="input" maxLength={120} value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
        </label>
        <label className="field">
          <span>Classroom</span>
          <select
            className="input"
            value={form.classroomId}
            onChange={(e) => {
              const room = classrooms.find((c) => c.id === e.target.value);
              setForm({ ...form, classroomId: e.target.value, classroomName: room ? `Room ${room.roomNo}` : e.target.value });
            }}
          >
            {!classrooms.some((c) => c.id === form.classroomId) && <option value={form.classroomId}>{form.classroomName}</option>}
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                Room {c.roomNo}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Recorded at</span>
          <input
            className="input"
            type="datetime-local"
            value={toLocalInput(form.recordedAt)}
            onChange={(e) => e.target.value && setForm({ ...form, recordedAt: new Date(e.target.value).toISOString() })}
          />
        </label>
      </div>
    </Modal>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <>
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children || '—'}</dd>
    </>
  );
}

export function RecordingDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { recordings, loading } = useStore();
  const recording = recordings.find((r) => r.id === id);
  const [tab, setTab] = useState<'details' | 'notes' | 'activity'>('details');
  const [notes, setNotes] = useState('');
  const [notesState, setNotesState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = params.get('edit') === '1';

  useEffect(() => {
    setNotes(recording?.notes ?? '');
  }, [recording?.id, recording?.notes]);

  if (loading) return <Spinner />;
  if (!recording) {
    return (
      <div className="card card-pad">
        <p>This recording does not exist or was deleted.</p>
        <Link className="link" to="/recordings">
          Back to recordings
        </Link>
      </div>
    );
  }

  const togglePublish = async () => {
    setBusy(true);
    setError('');
    try {
      await publishRecording(recording, recording.publicationStatus !== 'published');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteRecording(recording);
      navigate('/recordings', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const saveNotes = async () => {
    setNotesState('saving');
    try {
      await saveRecordingNotes(recording.id, notes);
      setNotesState('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save notes.');
      setNotesState('idle');
    }
  };

  const canPublish = recording.status === 'uploaded' || recording.status === 'published';
  const activity = [
    { at: recording.createdAt, label: `Session created by ${recording.facultyName}` },
    { at: recording.startedAt, label: 'Recording started on mount phone' },
    { at: recording.endedAt, label: 'Recording saved on mount phone' },
    { at: recording.uploadedAt, label: 'Upload verified' },
    { at: recording.publishedAt, label: 'Published' },
    { at: recording.updatedAt, label: 'Last updated' },
  ]
    .filter((a) => a.at)
    .sort((a, b) => a.at.localeCompare(b.at));

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/recordings" className="link" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <ArrowLeft size={14} /> All recordings
          </Link>
          <h1 style={{ marginTop: 8 }}>{recording.topic}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={togglePublish} disabled={!canPublish || busy} title={canPublish ? '' : 'Only uploaded recordings can be published'}>
            {recording.publicationStatus === 'published' ? <EyeOff size={16} /> : <Eye size={16} />}
            {recording.publicationStatus === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button className="btn btn-outline" onClick={() => setParams({ edit: '1' })}>
            <Pencil size={16} /> Edit
          </button>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {recording.errorMessage && (
        <div className="alert">
          <strong>Upload error:</strong> {recording.errorMessage}
        </div>
      )}

      <div className="detail-grid">
        <div className="card card-pad">
          <VideoPlayer recording={recording} />
        </div>

        <div className="card card-pad">
          <div className="tabs" role="tablist">
            {(['details', 'notes', 'activity'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'details' && (
            <dl className="kv">
              <Row icon={<GraduationCap size={14} />} label="Faculty">{recording.facultyName}</Row>
              {recording.degreeName ? (
                <>
                  <Row icon={<Users size={14} />} label="Degree">{recording.degreeName}</Row>
                  <Row icon={<Users size={14} />} label="Stream">{recording.streamName}</Row>
                  <Row icon={<Users size={14} />} label="Year">{recording.year ? yearLabel(recording.year) : ''}</Row>
                  <Row icon={<Book size={14} />} label="Subject">{recording.subjectName}</Row>
                </>
              ) : (
                <Row icon={<Users size={14} />} label="Class">{recording.className}</Row>
              )}
              <Row icon={<Building2 size={14} />} label="Classroom">{recording.classroomName}</Row>
              <Row icon={<Book size={14} />} label="Chapter">{recording.chapter}</Row>
              <Row icon={<Tag size={14} />} label="Topic">{recording.topic}</Row>
              <Row icon={<Calendar size={14} />} label="Recorded At">{formatDateTime(recording.recordedAt)}</Row>
              <Row icon={<Clock size={14} />} label="Duration">{recording.durationSeconds ? formatDuration(recording.durationSeconds) : ''}</Row>
              <Row icon={<FileVideo size={14} />} label="File Size">{formatBytes(recording.fileSizeBytes)}</Row>
              <Row icon={<Tag size={14} />} label="Status">
                <StatusPill status={recording.status} progress={recording.uploadProgress} />
              </Row>
              <Row icon={<Eye size={14} />} label="Visibility">
                {recording.publicationStatus === 'published' ? 'Published' : 'Not published'}
              </Row>
              <Row icon={<Tag size={14} />} label="Session ID">
                <code style={{ fontSize: 12 }}>{recording.sessionId}</code>
              </Row>
            </dl>
          )}

          {tab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="field">
                <span>Internal notes (visible to administrators only)</span>
                <textarea
                  className="input"
                  value={notes}
                  maxLength={5000}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesState('idle');
                  }}
                />
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                {notesState === 'saved' && <span className="cell-sub">Saved</span>}
                <button className="btn" onClick={saveNotes} disabled={notesState === 'saving' || notes === recording.notes}>
                  {notesState === 'saving' ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <ul className="timeline">
              {activity.map((a) => (
                <li key={a.label}>
                  <span className="dot" aria-hidden />
                  <div>
                    <div>{a.label}</div>
                    <div className="cell-sub">{formatDateTime(a.at)}</div>
                  </div>
                </li>
              ))}
              {recording.errorMessage && (
                <li>
                  <span className="dot" style={{ background: 'var(--red)' }} aria-hidden />
                  <div>
                    <div>Upload error</div>
                    <div className="cell-sub">{recording.errorMessage}</div>
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {editing && <EditModal recording={recording} onClose={() => setParams({})} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete recording?"
          message={
            <>
              This permanently deletes the video, thumbnail and record for <strong>{recording.topic}</strong>. This cannot be undone.
            </>
          }
          confirmLabel="Delete permanently"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
