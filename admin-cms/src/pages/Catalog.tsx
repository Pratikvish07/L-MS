import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Academics, BatchManagement } from '../components/Academics';
import { PageHead } from '../components/Layout';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Pill } from '../components/ui';
import { deleteClassroom, saveClassroom } from '../lib/data';
import { useStore } from '../lib/store';
import type { Classroom } from '../lib/types';

function ClassroomForm({ room, onClose }: { room?: Classroom; onClose: () => void }) {
  const [roomNo, setRoomNo] = useState(room?.roomNo ?? '');
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 40));
  const [active, setActive] = useState(room?.active ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!roomNo.trim()) return setError('Room number is required.');
    if (!(Number(capacity) > 0)) return setError('Capacity must be a positive number.');
    setBusy(true);
    try {
      await saveClassroom({ roomNo, capacity: Number(capacity), active }, room?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setBusy(false);
    }
  };

  return (
    <Modal
      title={room ? `Edit Room ${room.roomNo}` : 'Add Classroom'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      {error && <div className="alert">{error}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Room No.</span>
          <input className="input" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} placeholder="101" />
        </label>
        <label className="field">
          <span>Capacity</span>
          <input className="input" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <label className="checkbox full">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (shown to faculty)
        </label>
      </div>
    </Modal>
  );
}


export function CatalogPage({ tab }: { tab: 'classrooms' | 'subjects' }) {
  const { classrooms } = useStore();
  const navigate = useNavigate();
  const [roomForm, setRoomForm] = useState<Classroom | 'new' | null>(null);
  const [removing, setRemoving] = useState<Classroom | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteClassroom(removing.id);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title={tab === 'classrooms' ? 'Classrooms' : 'Degrees, Streams & Subjects'}
        subtitle={
          tab === 'classrooms'
            ? 'Rooms where lectures are recorded'
            : 'Degree → stream → year → subjects with assigned faculty. Faculty choose from these when recording.'
        }
      >
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'classrooms'} className={tab === 'classrooms' ? 'active' : ''} onClick={() => navigate('/classrooms')}>
            Classrooms
          </button>
          <button role="tab" aria-selected={tab === 'subjects'} className={tab === 'subjects' ? 'active' : ''} onClick={() => navigate('/subjects')}>
            Academics
          </button>
        </div>
        {tab === 'classrooms' && (
          <button className="btn" onClick={() => setRoomForm('new')}>
            <Plus size={16} /> Add Classroom
          </button>
        )}
      </PageHead>

      {tab === 'subjects' ? (
        <><Academics /><BatchManagement /></>
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room No.</th>
                  <th>Capacity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.length === 0 && (
                  <tr><td colSpan={4} className="empty">No classrooms yet. Add the rooms where lectures are recorded.</td></tr>
                )}
                {classrooms.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-title">Room {c.roomNo}</td>
                    <td>{c.capacity}</td>
                    <td>{c.active ? <Pill tone="green">Active</Pill> : <Pill tone="gray">Inactive</Pill>}</td>
                    <td>
                      <div className="actions">
                        <button className="icon-btn" aria-label={`Edit room ${c.roomNo}`} onClick={() => setRoomForm(c)}><Pencil size={15} /></button>
                        <button className="icon-btn danger" aria-label={`Delete room ${c.roomNo}`} onClick={() => setRemoving(c)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {roomForm && <ClassroomForm room={roomForm === 'new' ? undefined : roomForm} onClose={() => setRoomForm(null)} />}
      {removing && (
        <ConfirmDialog
          title={`Delete Room ${removing.roomNo}?`}
          message="Faculty will no longer be able to choose it. Existing recordings keep their details. Consider marking it inactive instead."
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}
