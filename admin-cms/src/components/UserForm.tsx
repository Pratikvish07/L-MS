import { useEffect, useState } from 'react';

import { createUser, updateUser } from '../lib/data';
import { useStore } from '../lib/store';
import type { AppUser, UserRole } from '../lib/types';
import { Modal } from './Modal';

const ROLE_LABEL: Record<UserRole, string> = {
  faculty: 'Faculty',
  mount: 'Mount device (tripod phone)',
  admin: 'Administrator',
  student: 'Student',
};

function friendly(e: unknown) {
  return e instanceof Error ? e.message : 'Save failed.';
}

interface UserFormProps {
  /** Existing user to edit; omit to create. */
  user?: AppUser;
  /** Fix the role (e.g. the Faculty page always creates faculty). */
  fixedRole?: UserRole;
  currentUid?: string;
  onClose: () => void;
}

export function UserForm({ user, fixedRole, currentUid, onClose }: UserFormProps) {
  const { classrooms, users, degrees, streams, batches } = useStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role ?? fixedRole ?? 'faculty');
  const [facultyId, setFacultyId] = useState(user?.facultyId ?? '');
  const [subject, setSubject] = useState(user?.subject ?? '');
  const [active, setActive] = useState(user?.active ?? true);
  const [classroomId, setClassroomId] = useState(user?.classroomId ?? '');
  const [degreeId, setDegreeId] = useState(user?.degreeId ?? '');
  const [streamId, setStreamId] = useState(user?.streamId ?? '');
  const [year, setYear] = useState(user?.year ?? 1);
  const [batchName, setBatchName] = useState(user?.batchName ?? '');
  const [batchId, setBatchId] = useState(user?.batchId ?? '');
  useEffect(() => {
    if (!batchId) return;
    const selected = batches.find((b) => b.id === batchId);
    if (!selected) return;
    setDegreeId((current) => current || selected.degreeId);
    setStreamId((current) => current || selected.streamId);
    setYear(selected.year);
    setBatchName(selected.name);
  }, [batchId, batches]);
  // A room can be locked to only one tripod.
  const roomOwner = (roomId: string) =>
    users.find((u) => u.role === 'mount' && u.classroomId === roomId && u.uid !== user?.uid);
  const room = classrooms.find((c) => c.id === classroomId);
  const selectedBatch = batches.find((b) => b.id === batchId);
  const roomFields = role === 'mount' && room
    ? { classroomId: room.id, classroomName: `Room ${room.roomNo}` }
    : { classroomId: '', classroomName: '' };
  const studentClassroomFields = role === 'student' && selectedBatch
    ? { classroomId: selectedBatch.classroomId, classroomName: selectedBatch.classroomName }
    : {};
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSelf = !!user && user.uid === currentUid;

  const suggestedFacultyId = (() => {
    const used = new Set(users.map((item) => item.facultyId.trim()).filter(Boolean));
    let next = 1;
    while (used.has(String(next).padStart(3, '0'))) next++;
    return String(next).padStart(3, '0');
  })();
  const facultyIdValue = !user && role === 'faculty' ? facultyId || suggestedFacultyId : facultyId;

  const save = async () => {
    setError('');
    if (!displayName.trim()) return setError('Name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!user && password.length < 8) return setError('Password must be at least 8 characters.');
    const selectedFacultyId = facultyIdValue.trim();
    if (!user && role === 'faculty' && users.some((item) => item.facultyId === selectedFacultyId)) {
      return setError(`Faculty ID ${selectedFacultyId} is already assigned. Change it before creating this account.`);
    }
    if (role === 'mount' && classroomId && roomOwner(classroomId)) {
      return setError(`${room ? `Room ${room.roomNo}` : 'That room'} is already locked to ${roomOwner(classroomId)!.displayName}.`);
    }
    setBusy(true);
    try {
      if (user) {
        await updateUser(user.uid, {
          displayName: displayName.trim(),
          role,
          active,
          facultyId: facultyId.trim(),
          subject: subject.trim(),
          degreeId,
          streamId,
          year,
          batchId,
          batchName,
          ...roomFields,
          ...studentClassroomFields,
        });
      } else {
        await createUser({ email, password, displayName, role, facultyId: selectedFacultyId, subject, degreeId, streamId, year, batchId, batchName, ...roomFields, ...studentClassroomFields });
      }
      onClose();
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  };

  const title = user ? `Edit ${user.displayName}` : fixedRole === 'faculty' ? 'Add Faculty' : 'Add User';

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : user ? 'Save changes' : 'Create account'}
          </button>
        </>
      }
    >
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="form-grid">
        <label className="field full">
          <span>Full name</span>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Mr. Rahul Sharma" />
        </label>
        <label className="field full">
          <span>Email</span>
          <input className="input" type="email" value={email} disabled={!!user} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {!user && (
          <label className="field full">
            <span>Temporary password</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {!fixedRole && (
          <label className="field">
            <span>Role</span>
            <select className="input" value={role} disabled={isSelf} onChange={(e) => setRole(e.target.value as UserRole)}>
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        )}
        {role === 'faculty' && (
          <>
            <label className="field">
              <span>Faculty ID</span>
              <input className="input" value={facultyIdValue} onChange={(e) => setFacultyId(e.target.value)} />
            </label>
            <label className="field">
              <span>Subject</span>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
            </label>
          </>
        )}
        {role === 'mount' && (
          <label className="field full">
            <span>Locked classroom</span>
            <select className="input" value={classroomId} onChange={(e) => setClassroomId(e.target.value)}>
              <option value="">Not locked (faculty choose the room)</option>
              {classrooms.map((c) => {
                const owner = roomOwner(c.id);
                return (
                  <option key={c.id} value={c.id} disabled={!!owner}>
                    Room {c.roomNo}
                    {owner ? ` — locked to ${owner.displayName}` : ''}
                  </option>
                );
              })}
            </select>
            <small className="cell-sub">
              Lectures recorded with this tripod always use this room; faculty cannot change it.
            </small>
          </label>
        )}
        {role === 'student' && (
          <>
            <label className="field"><span>Degree</span><select className="input" value={degreeId} onChange={(e) => { setDegreeId(e.target.value); setStreamId(''); }}><option value="">Select degree</option>{degrees.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            <label className="field"><span>Stream</span><select className="input" value={streamId} onChange={(e) => setStreamId(e.target.value)}><option value="">Select stream</option>{streams.filter((s) => s.degreeId === degreeId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field"><span>Year</span><input className="input" type="number" min="1" max="6" value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
            <label className="field"><span>Batch / Classroom</span><select className="input" value={batchId} onChange={(e) => { const selected = batches.find((b) => b.id === e.target.value); setBatchId(e.target.value); setBatchName(selected?.name ?? ''); if (selected) { setDegreeId(selected.degreeId); setStreamId(selected.streamId); setYear(selected.year); } }}><option value="">Select batch</option>{batches.filter((b) => b.year === year && (!degreeId || b.degreeId === degreeId) && (!streamId || b.streamId === streamId)).map((b) => <option key={b.id} value={b.id}>{b.name} {b.classroomName ? `— ${b.classroomName}` : ''}</option>)}</select></label>
          </>
        )}
        {user && (
          <label className="checkbox full">
            <input type="checkbox" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
            Active (inactive accounts cannot sign in to the app or CMS)
          </label>
        )}
      </div>
      {!user && role === 'mount' && (
        <div className="notice">Sign in with this account on the tripod phone. It can only pair, record and upload.</div>
      )}
      {!user && (
        <div className="cell-sub">Share the temporary password securely. Users and edits are saved in this browser only.</div>
      )}
    </Modal>
  );
}
