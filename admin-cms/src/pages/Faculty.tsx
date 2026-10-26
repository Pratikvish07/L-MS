import { Check, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { PageHead } from '../components/Layout';
import { ConfirmDialog } from '../components/Modal';
import { Avatar, Pill } from '../components/ui';
import { UserForm } from '../components/UserForm';
import { approveStudent, createUser, deleteUserProfile } from '../lib/data';
import { yearLabel } from '../lib/format';
import { useStore } from '../lib/store';
import type { AppUser, UserRole } from '../lib/types';

const ROLE_TONE: Record<UserRole, 'green' | 'blue' | 'amber'> = { faculty: 'green', admin: 'blue', mount: 'amber', student: 'blue' };

/** Faculty Management (role fixed) and Users (all roles) share this page. */
export function PeoplePage({ mode }: { mode: 'faculty' | 'users' }) {
  const { users, recordings, subjects, streams, degrees } = useStore();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AppUser | 'new' | null>(null);
  const [removing, setRemoving] = useState<AppUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [importing, setImporting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const importStudents = async (file: File) => {
    setImporting(true);
    try {
      const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
      const headers = lines.shift()!.split(',').map((item) => item.trim().toLowerCase());
      const value = (cells: string[], key: string) => cells[headers.indexOf(key)]?.trim() ?? '';
      for (const line of lines) {
        const cells = line.split(',');
        const email = value(cells, 'email');
        if (!email) continue;
        await createUser({
          email,
          password: value(cells, 'password'),
          displayName: value(cells, 'name') || email,
          role: 'student',
          degreeId: value(cells, 'degreeid'),
          streamId: value(cells, 'streamid'),
          year: Number(value(cells, 'year') || 1),
          batchId: value(cells, 'batchid'),
          batchName: value(cells, 'batchname'),
        });
      }
      window.alert('Student import completed.');
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Student import failed.');
    } finally {
      setImporting(false);
    }
  };
  const downloadStudentTemplate = () => {
    const csv = 'name,email,password,degreeid,streamid,year,batchid,batchname\nRahul Sharma,rahul@example.com,Student@123,BTECH,CSE,1,BATCH-A,Batch A\nPriya Singh,priya@example.com,Student@123,BTECH,CSE,1,BATCH-B,Batch B\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'student-import-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const term = search.trim().toLowerCase();
  const list = users
    .filter((u) => mode === 'users' || u.role === 'faculty')
    .filter((u) => !term || [u.displayName, u.email, u.subject, u.facultyId].some((v) => v.toLowerCase().includes(term)));

  const remove = async () => {
    if (!removing) return;
    setRemoveError('');
    setBusy(true);
    try {
      await deleteUserProfile(removing.uid);
      setRemoving(null);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title={mode === 'faculty' ? 'Faculty Management' : 'Users'}
        subtitle={mode === 'faculty' ? 'Faculty accounts that can record lectures' : 'Manage accounts and approve student registrations'}
      >
        {mode === 'users' && <>
          <button className="btn btn-outline" onClick={downloadStudentTemplate}>Download Sample CSV</button>
          <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
            {importing ? 'Importing…' : 'Import Students CSV'}
            <input type="file" accept=".csv,text/csv" hidden disabled={importing} onChange={(e) => { const file = e.target.files?.[0]; if (file) void importStudents(file); e.currentTarget.value = ''; }} />
          </label>
        </>}
        <button className="btn" onClick={() => setEditing('new')}>
          <Plus size={16} /> {mode === 'faculty' ? 'Add Faculty' : 'Add User'}
        </button>
      </PageHead>
      <section className="card">
        <div className="toolbar">
          <div className="search">
            <Search size={16} aria-hidden />
            <input className="input" aria-label="Search" placeholder="Search by name, email, subject…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                {mode === 'users' && <th>Role</th>}
                <th>{mode === 'faculty' ? 'Assigned subjects' : 'Subject / Room'}</th>
                {mode === 'faculty' && <th>Recordings</th>}
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No accounts found.
                  </td>
                </tr>
              )}
              {list.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <div className="person">
                      <Avatar name={u.displayName} />
                      <div>
                        <div className="cell-title">{u.displayName}</div>
                        {u.facultyId && <div className="cell-sub">ID {u.facultyId}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  {mode === 'users' && (
                    <td>
                      <Pill tone={ROLE_TONE[u.role]}>{u.role === 'mount' ? 'Mount device' : u.role[0].toUpperCase() + u.role.slice(1)}</Pill>
                    </td>
                  )}
                  <td>
                    {mode === 'faculty' ? (
                      (() => {
                        const mine = subjects.filter((s) => s.facultyUids.includes(u.uid));
                        if (!mine.length) return <span className="cell-sub">{u.subject || 'None assigned'}</span>;
                        return (
                          <div className="chips">
                            {mine.map((s) => {
                              const stream = streams.find((x) => x.id === s.streamId);
                              const degree = degrees.find((x) => x.id === s.degreeId);
                              return (
                                <span key={s.id} className="chip" style={{ paddingLeft: 10 }} title={`${degree?.name ?? ''} ${stream?.name ?? ''} · ${yearLabel(s.year)}`}>
                                  {s.name}
                                  <span className="code">{[degree?.name, stream?.code, s.year ? `Y${s.year}` : ''].filter(Boolean).join(' ')}</span>
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      u.role === 'mount' ? (
                        u.classroomName ? <Pill tone="amber">🔒 {u.classroomName}</Pill> : <span className="cell-sub">No room locked</span>
                      ) : (
                        u.role === 'student' ? `${u.batchName || 'No batch assigned'}${u.year ? ` · Year ${u.year}` : ''}` : u.subject || '—'
                      )
                    )}
                  </td>
                  {mode === 'faculty' && <td>{recordings.filter((r) => r.facultyUid === u.uid).length}</td>}
                  <td>{u.active ? <Pill tone="green">Active</Pill> : <Pill tone="amber">{u.role === 'student' ? 'Pending approval' : 'Inactive'}</Pill>}</td>
                  <td>
                    <div className="actions">
                      {mode === 'users' && u.role === 'student' && !u.active && (u.degreeId && u.streamId && u.year ? <button className="icon-btn" aria-label={`Approve ${u.displayName}`} title="Approve student" disabled={approving === u.uid} onClick={async () => { setApproving(u.uid); try { await approveStudent(u.uid); } catch (e) { window.alert(e instanceof Error ? e.message : 'Approval failed.'); } finally { setApproving(null); } }}><Check size={15} /></button> : <span className="cell-sub" title="Edit and assign degree, stream, and year before approval">Assign academics</span>)}
                      <button className="icon-btn" aria-label={`Edit ${u.displayName}`} onClick={() => setEditing(u)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`Remove ${u.displayName}`}
                        disabled={u.uid === me?.uid}
                        onClick={() => setRemoving(u)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <UserForm
          user={editing === 'new' ? undefined : editing}
          fixedRole={mode === 'faculty' ? 'faculty' : undefined}
          currentUid={me?.uid}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.displayName}?`}
          message={
            <>
              {removeError && <div className="alert" role="alert" style={{ marginBottom: 12 }}>{removeError}</div>}
              This removes <strong>{removing.email}</strong> from the CMS user list. Existing recordings are kept.
            </>
          }
          confirmLabel="Remove access"
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
