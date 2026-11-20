// User Manager (all users) and Instructor Master (faculty only).
// Role dropdown comes from Role Master (`roles`). The role's name/code decides
// which fields show and what the apps let the user do (see roleAccess).
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Pill } from '../components/ui';
import { confirmedWrite, createManagedAccount, existingAccountUid, firestore } from '../lib/firebase';
import { useStore } from '../lib/store';
import type { AppUser, UserRole } from '../lib/types';

type Access = UserRole;
interface RoleRow { id: string; name: string; code: string; status?: string; }
interface Profile extends AppUser { roleId?: string; roleName?: string; courseId?: string; courseName?: string; }

const ACCESS: Access[] = ['admin', 'faculty', 'mount', 'student'];
const ROLE_NAME_HINT = 'Its name or code must contain admin, faculty/instructor/teacher/staff, mount/tripod, or student.';
const ACCESS_LABEL: Record<Access, string> = { admin: 'Admin', faculty: 'Instructor', mount: 'Mount phone', student: 'Student' };
const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
const now = () => new Date().toISOString();

/** What a Role Master role can do, from words in its name or code. */
export function roleAccess(role: Pick<RoleRow, 'name' | 'code'>): Access | null {
  const text = `${role.name} ${role.code}`.toLowerCase();
  if (text.includes('admin')) return 'admin';
  if (text.includes('mount') || text.includes('tripod')) return 'mount';
  if (text.includes('stud')) return 'student';
  if (/(faculty|instructor|teacher|staff)/.test(text)) return 'faculty';
  return null;
}

interface FormState {
  displayName: string; email: string; phone: string; roleId: string; password: string; active: boolean;
  facultyId: string; classroomId: string; courseId: string; batchId: string;
}
const emptyForm = (roleId = ''): FormState => ({ displayName: '', email: '', phone: '', roleId, password: '', active: true, facultyId: '', classroomId: '', courseId: '', batchId: '' });

/** /users?role=student opens User Manager filtered to one role (sidebar "Students"). */
export function UsersRoute() {
  const [params] = useSearchParams();
  const role = params.get('role');
  const initial = ACCESS.includes(role as Access) ? (role as Access) : '';
  return <UsersPage key={initial} initialFilter={initial} />;
}

export function UsersPage({ only, initialFilter = '' }: { only?: Access; initialFilter?: Access | '' }) {
  const { users, classrooms } = useStore();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Access | ''>(only ?? initialFilter);
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => onSnapshot(collection(firestore, 'roles'), (snapshot) => setRoles(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as RoleRow).sort((a, b) => String(a.name).localeCompare(String(b.name)))), (cause) => setError(cause.message)), []);

  const profiles = users as Profile[];
  const visible = profiles.filter((user) => (!filter || user.role === filter) && (!search.trim() || `${user.displayName} ${user.email} ${user.roleName ?? ''} ${user.facultyId ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())));
  const pending = profiles.filter((user) => user.role === 'student' && !user.active && user.approvalStatus === 'pending').length;

  const approve = async (user: Profile) => {
    setError('');
    try { await confirmedWrite(updateDoc(doc(firestore, 'users', user.uid), { active: true, approvalStatus: 'approved', approvedAt: now() })); } catch (cause) { setError(message(cause)); }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true); setError('');
    try {
      await deleteDoc(doc(firestore, 'users', removing.uid));
      if (removing.role === 'admin') await deleteDoc(doc(firestore, 'admins', removing.uid));
      setNotice(`${removing.displayName}'s profile was deleted, so they can no longer use the apps. Their Firebase login still exists: remove it under Firebase console → Authentication if needed.`);
      setRemoving(null);
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };

  const detail = (user: Profile) => {
    if (user.role === 'faculty') return user.facultyId ? `ID ${user.facultyId}` : '—';
    if (user.role === 'mount') return user.classroomName || 'No classroom';
    if (user.role === 'student') return [user.courseName, user.batchName].filter(Boolean).join(' · ') || 'Not enrolled';
    return '—';
  };
  const title = only === 'faculty' ? 'Instructor Master' : 'User Manager';

  return (
    <>
      <PageHead title={title} subtitle={only === 'faculty' ? 'Instructors used in subject and batch assignment' : 'Add employees and faculty here. Students are added from Courses → batch.'}>
        <button className="btn" onClick={() => { setError(''); setEditing('new'); }}><Plus size={16} /> {only === 'faculty' ? 'Add instructor' : 'Add employee / faculty'}</button>
      </PageHead>
      {error && <div className="alert" role="alert">{error}</div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      {!only && pending > 0 && <div className="notice">{pending} student registration{pending === 1 ? '' : 's'} waiting for approval.</div>}
      <section className="card">
        <div className="toolbar">
          <div className="search"><Search size={16} aria-hidden /><input className="input" aria-label="Search users" placeholder="Search name, email, role" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          {!only && <div className="seg" role="tablist">{(['', ...ACCESS] as const).map((item) => <button key={item || 'all'} role="tab" aria-selected={filter === item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item ? ACCESS_LABEL[item] : 'All'}</button>)}</div>}
          <span className="cell-sub">{visible.length} users</span>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Role</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.uid}>
                <td>{user.role === 'student' ? <Link className="cell-title link" to={`/students/${user.uid}`}>{user.displayName}</Link> : <div className="cell-title">{user.displayName}</div>}<div className="cell-sub">{user.email}{user.phone ? ` · ${user.phone}` : ''}</div></td>
                <td>{user.roleName || ACCESS_LABEL[user.role] || user.role}</td>
                <td>{detail(user)}</td>
                <td>{user.active ? <Pill tone="green">Active</Pill> : user.approvalStatus === 'pending' ? <Pill tone="amber">Pending approval</Pill> : <Pill tone="gray">Disabled</Pill>}</td>
                <td><div className="actions">
                  {!user.active && user.approvalStatus === 'pending' && <button className="btn btn-sm" onClick={() => void approve(user)}><Check size={14} /> Approve</button>}
                  <button className="icon-btn" aria-label={`Edit ${user.displayName}`} onClick={() => { setError(''); setEditing(user); }}><Pencil size={14} /></button>
                  <button className="icon-btn danger" aria-label={`Delete ${user.displayName}`} onClick={() => setRemoving(user)}><Trash2 size={14} /></button>
                </div></td>
              </tr>
            ))}
            {!visible.length && <tr><td className="empty" colSpan={5}>{users.length ? 'No users match.' : 'No users yet.'}</td></tr>}
          </tbody>
        </table></div>
      </section>
      {editing && <UserFormModal user={editing === 'new' ? null : editing} only={only} roles={roles} classrooms={classrooms} onClose={() => setEditing(null)} onSaved={setNotice} />}
      {removing && <ConfirmDialog title="Delete user" message={<>Delete <strong>{removing.displayName}</strong> ({removing.email})? They lose access to every app.</>} busy={busy} onConfirm={() => void remove()} onCancel={() => setRemoving(null)} />}
    </>
  );
}

function UserFormModal({ user, only, roles, classrooms, onClose, onSaved }: {
  user: Profile | null; only?: Access; roles: RoleRow[];
  classrooms: { id: string; roomNo: string; active: boolean }[]; onClose: () => void; onSaved: (text: string) => void;
}) {
  // Students are created from Courses → batch, so User Manager only offers employee/faculty roles.
  const editingStudent = user?.role === 'student';
  const usable = roles.filter((role) => role.status !== 'inactive' && role.status !== 'archived' && roleAccess(role) !== 'student' && (!only || roleAccess(role) === only));
  const [form, setForm] = useState<FormState>(() => user ? {
    displayName: user.displayName ?? '', email: user.email ?? '', phone: user.phone ?? '', password: '', active: user.active !== false,
    roleId: user.roleId ?? usable.find((role) => roleAccess(role) === user.role)?.id ?? '',
    facultyId: user.facultyId ?? '', classroomId: user.classroomId ?? '', courseId: user.courseId ?? '', batchId: user.batchId ?? '',
  } : emptyForm(usable.length === 1 ? usable[0].id : ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const role = roles.find((item) => item.id === form.roleId);
  const access: Access | null = editingStudent ? 'student' : role ? roleAccess(role) : null;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.displayName.trim()) { setError('Full name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }

    // Students: only name, phone and active here. Course and batch change on the course pages.
    if (editingStudent && user) {
      setBusy(true); setError('');
      try {
        await confirmedWrite(updateDoc(doc(firestore, 'users', user.uid), { displayName: form.displayName.trim(), phone: form.phone.trim(), active: form.active, approvalStatus: form.active ? 'approved' : user.approvalStatus ?? 'pending', updatedAt: now() }));
        onSaved(`${form.displayName.trim()} updated.`);
        onClose();
      } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
      return;
    }

    if (!role || !access) { setError(role ? `The role “${role.name}” is not recognised. ${ROLE_NAME_HINT}` : 'Choose a role.'); return; }
    if (user && user.role !== access && user.role === 'admin') { setError('Change admin accounts from Firebase directly.'); return; }
    if (access === 'mount' && !form.classroomId) { setError('Choose the classroom this mount phone is locked to.'); return; }
    if (!user && form.password && form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setBusy(true); setError('');
    let createdLogin = false;
    const generated = !user && !form.password ? temporaryPassword() : '';
    try {
      const room = classrooms.find((item) => item.id === form.classroomId);
      let uid = user?.uid;
      if (!uid) {
        try {
          uid = (await createManagedAccount(email, form.password || generated)).uid;
          createdLogin = true;
        } catch (cause) {
          if ((cause as { code?: string }).code !== 'auth/email-already-in-use') throw cause;
          // A login already exists (e.g. an earlier save failed after creating it): reuse it with its password.
          if (!form.password) throw new Error('This email already has a login. Type that login’s password in the Password field and save again to finish setting it up, or delete the login in Firebase console → Authentication.');
          try { uid = await existingAccountUid(email, form.password); }
          catch { throw new Error('This email already has a login, and the password does not match it. Use its original password, or delete the login in Firebase console → Authentication and add the user again.'); }
        }
      }
      const fields = {
        uid, email, displayName: form.displayName.trim(), phone: form.phone.trim(),
        roleId: role.id, roleName: role.name, role: access,
        active: form.active, approvalStatus: form.active ? 'approved' : 'pending',
        facultyId: access === 'faculty' ? form.facultyId.trim() : '',
        classroomId: access === 'mount' ? form.classroomId : '', classroomName: access === 'mount' && room ? `Room ${room.roomNo}` : '',
        ...(user ? {} : { createdAt: now() }), updatedAt: now(),
      };
      await confirmedWrite(setDoc(doc(firestore, 'users', uid), fields, { merge: true }));
      if (access === 'admin') await confirmedWrite(setDoc(doc(firestore, 'admins', uid), { email, displayName: fields.displayName, role: 'admin', isActive: form.active }, { merge: true }));
      if (access === 'mount' && room) await confirmedWrite(setDoc(doc(firestore, 'classrooms', room.id), { mountId: uid, mountName: fields.displayName }, { merge: true }));
      onSaved(user ? `${fields.displayName} updated.` : generated ? `${fields.displayName} can sign in with ${email} / ${generated}. Share the password now; it is not shown again.` : `${fields.displayName} can sign in with ${email} and the password you set.`);
      onClose();
    } catch (cause) {
      // The login exists but its profile did not save: the person cannot sign in until it does.
      setError(createdLogin
        ? `The login for ${email} was created, but its profile could not be saved (${message(cause)}). Press Save again ${generated ? `with password ${generated} typed in the Password field` : 'with the same password'} once Firebase accepts writes, and it will finish setting up this account.`
        : message(cause));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={user ? `Edit ${user.displayName}` : only === 'faculty' ? 'Add instructor' : 'Add employee / faculty'} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button></>}>
      {error && <div className="alert" role="alert">{error}</div>}
      {!user && !only && <p className="cell-sub" style={{ marginTop: 0 }}>Students are added from <Link className="link" to="/courses">Courses</Link> → batch (Add student or Upload CSV).</p>}
      <div className="form-grid">
        <label className="field"><span>Full name *</span><input className="input" autoFocus value={form.displayName} onChange={(event) => set('displayName', event.target.value)} /></label>
        <label className="field"><span>Email *</span><input className="input" type="email" disabled={Boolean(user)} value={form.email} onChange={(event) => set('email', event.target.value)} /></label>
        {editingStudent ? (
          <label className="field"><span>Role</span><input className="input" disabled value={user?.roleName || 'Student'} /></label>
        ) : (
          <label className="field"><span>Role * (from Role Master)</span>
            <select className="input" value={form.roleId} onChange={(event) => set('roleId', event.target.value)}>
              <option value="">Select role</option>
              {usable.map((item) => { const kind = roleAccess(item); return <option key={item.id} value={item.id} disabled={!kind}>{item.name}{kind ? ` (${ACCESS_LABEL[kind]})` : ' (unrecognised name)'}</option>; })}
            </select>
            {!usable.length ? <small className="cell-sub"><Link className="link" to="/modules/roles">Add employee or faculty roles in Role Master</Link> first.</small> : usable.some((item) => !roleAccess(item)) ? <small className="cell-sub">{ROLE_NAME_HINT}</small> : null}
          </label>
        )}
        <label className="field"><span>Phone</span><input className="input" value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label>

        {access === 'faculty' && <label className="field"><span>Instructor ID</span><input className="input" placeholder="e.g. FAC-001" value={form.facultyId} onChange={(event) => set('facultyId', event.target.value)} /></label>}
        {access === 'mount' && <label className="field"><span>Classroom (Classroom Master) *</span><select className="input" value={form.classroomId} onChange={(event) => set('classroomId', event.target.value)}><option value="">Select classroom</option>{classrooms.filter((room) => room.active !== false).map((room) => <option key={room.id} value={room.id}>Room {room.roomNo}</option>)}</select>{!classrooms.length && <small className="cell-sub"><Link className="link" to="/modules/classrooms">Add classrooms</Link> first.</small>}</label>}
        {editingStudent && <div className="field full"><span>Course and batch</span><div className="cell-sub">{[user?.courseName, user?.batchName].filter(Boolean).join(' · ') || 'Not enrolled'}. Change it from <Link className="link" to={user?.courseId ? `/courses/${user.courseId}` : '/courses'}>the course page</Link>.</div></div>}

        {access && !user && <label className="field"><span>Password (empty = generate)</span><input className="input" type="text" autoComplete="new-password" value={form.password} onChange={(event) => set('password', event.target.value)} /></label>}
        {access && <label className="field checkbox" style={{ alignSelf: 'end' }}><input type="checkbox" checked={form.active} onChange={(event) => set('active', event.target.checked)} /> Active (can sign in to the apps)</label>}
      </div>
    </Modal>
  );
}

function temporaryPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  return [...crypto.getRandomValues(new Uint32Array(10))].map((value, index) => (index < 7 ? letters[value % letters.length] : String(2 + (value % 8)))).join('');
}
