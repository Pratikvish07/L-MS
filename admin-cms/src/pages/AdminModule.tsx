import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/ui';
import { firestore } from '../lib/firebase';
import { ADMIN_MODULES, type AdminModule } from '../lib/admin-modules';
import { useStore } from '../lib/store';

// Masters other pages read (Role Master → User Manager, Classroom Master → batches and mount phones)
// live in top-level collections. Everything else stays under adminModules/{id}/items.
const TOP_LEVEL = new Set(['roles', 'classrooms']);
const dataPath = (moduleId: string) => (TOP_LEVEL.has(moduleId) ? moduleId : `adminModules/${moduleId}/items`);
const legacyPath = (moduleId: string) => `adminModules/${moduleId}/items`;
const singular = (title: string) => (/[^s]s$/.test(title) ? title.slice(0, -1) : title);


type ModuleRow = Record<string, string | number | boolean | null> & { id: string };
type FormValues = Record<string, string | number | boolean>;

function initialValues(module: AdminModule, row?: ModuleRow): FormValues {
  return Object.fromEntries(module.fields.map((field) => {
    const value = row?.[field.key];
    if (value !== undefined && value !== null) return [field.key, value];
    return [field.key, field.type === 'checkbox' ? false : ''];
  }));
}

function fieldText(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '—');
}

export function AdminModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const module = ADMIN_MODULES.find((item) => item.id === moduleId);
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ModuleRow | 'new' | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  const { users } = useStore();
  const mounts = useMemo(() => users.filter((user) => user.role === 'mount'), [users]);

  // Records saved before Role/Classroom Master moved to top-level collections.
  useEffect(() => {
    setLegacyCount(0);
    if (!module || !TOP_LEVEL.has(module.id)) return;
    return onSnapshot(collection(firestore, legacyPath(module.id)), (snapshot) => setLegacyCount(snapshot.size), () => setLegacyCount(0));
  }, [module]);

  useEffect(() => {
    if (!module) return;
    setLoading(true);
    return onSnapshot(collection(firestore, dataPath(module.id)), (snapshot) => {
      setRows(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ModuleRow));
      setLoading(false);
      setError('');
    }, (cause) => {
      setError(cause.message);
      setLoading(false);
    });
  }, [module]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => module?.fields.some((field) => String(row[field.key] ?? '').toLowerCase().includes(term)));
  }, [module, rows, search]);

  if (!module) return <Navigate to="/modules/question-groups" replace />;

  const openNew = () => {
    setValues(initialValues(module));
    setEditing('new');
  };
  const openEdit = (row: ModuleRow) => {
    setValues(initialValues(module, row));
    setEditing(row);
  };
  const save = async () => {
    if (!editing) return;
    for (const field of module.fields) {
      if (field.required && !String(values[field.key] ?? '').trim()) {
        setError(`${field.label} is required.`);
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const id = editing === 'new' ? doc(collection(firestore, dataPath(module.id))).id : editing.id;
      const extra = module.id === 'classrooms' ? { mountName: mounts.find((user) => user.uid === values.mountId)?.displayName ?? '' } : {};
      await setDoc(doc(firestore, dataPath(module.id), id), { ...values, ...extra, updatedAt: new Date().toISOString(), ...(editing === 'new' ? { createdAt: new Date().toISOString() } : {}) }, { merge: true });
      setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (row: ModuleRow) => {
    if (!window.confirm(`Delete “${module.fields.map((field) => row[field.key]).find(Boolean) || 'this record'}”?`)) return;
    setError('');
    try {
      await deleteDoc(doc(firestore, dataPath(module.id), row.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this record.');
    }
  };
  const moveLegacy = async () => {
    setBusy(true); setError('');
    try {
      const old = await getDocs(collection(firestore, legacyPath(module.id)));
      const batch = writeBatch(firestore);
      old.docs.forEach((item) => { batch.set(doc(firestore, dataPath(module.id), item.id), item.data(), { merge: true }); batch.delete(item.ref); });
      await batch.commit();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not move the old records.'); } finally { setBusy(false); }
  };
  const cellText = (row: ModuleRow, key: string) => (module.id === 'classrooms' && key === 'mountId' ? String(row.mountName || '—') : fieldText(row[key]));

  return (
    <>
      <PageHead title={module.title} subtitle={module.description}>
        <button className="btn" onClick={openNew}><Plus size={16} /> Add record</button>
      </PageHead>
      {module.integrationNote && <div className="notice">{module.integrationNote}</div>}
      {error && <div className="alert" role="alert">{error}</div>}
      {legacyCount > 0 && <div className="notice" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><span style={{ flex: 1 }}>{legacyCount} {module.title.toLowerCase()} record{legacyCount === 1 ? ' was' : 's were'} saved in the old location, so other pages cannot see {legacyCount === 1 ? 'it' : 'them'}.</span><button className="btn btn-sm" disabled={busy} onClick={() => void moveLegacy()}>{busy ? 'Moving…' : 'Move them here'}</button></div>}
      <section className="card">
        <div className="toolbar"><div className="search"><Search size={16} aria-hidden /><input className="input" aria-label={`Search ${module.title}`} placeholder={`Search ${module.title.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="cell-sub">{visible.length} records</span></div>
        {loading ? <Spinner /> : <div className="table-wrap"><table><thead><tr>{module.fields.map((field) => <th key={field.key}>{field.label}</th>)}<th>Actions</th></tr></thead><tbody>
          {visible.map((row) => <tr key={row.id}>{module.fields.map((field) => <td key={field.key} className={field.key === module.fields[0].key ? 'cell-title' : undefined} title={cellText(row, field.key)}>{cellText(row, field.key)}</td>)}<td><div className="actions"><button className="icon-btn" aria-label="Edit record" onClick={() => openEdit(row)}><Pencil size={14} /></button><button className="icon-btn danger" aria-label="Delete record" onClick={() => void remove(row)}><Trash2 size={14} /></button></div></td></tr>)}
          {!visible.length && <tr><td className="empty" colSpan={module.fields.length + 1}>{rows.length ? 'No records match your search.' : `No ${module.title.toLowerCase()} records yet.`}</td></tr>}
        </tbody></table></div>}
      </section>
      {editing && <Modal title={editing === 'new' ? `Add ${singular(module.title)}` : `Edit ${singular(module.title)}`} onClose={() => setEditing(null)} footer={<><button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button></>}>
        <div className="form-grid">{module.fields.map((field) => <label key={field.key} className={`field${field.type === 'textarea' ? ' full' : ''}`}><span>{field.label}{field.required ? ' *' : ''}</span>{field.type === 'textarea' ? <textarea className="input" value={String(values[field.key] ?? '')} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} /> : module.id === 'classrooms' && field.key === 'mountId' ? <select className="input" value={String(values[field.key] ?? '')} onChange={(event) => setValues((current) => ({ ...current, mountId: event.target.value }))}><option value="">No mount phone</option>{mounts.map((user) => <option key={user.uid} value={user.uid}>{user.displayName || user.email}</option>)}</select> : field.type === 'select' ? <select className="input" value={String(values[field.key] ?? '')} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}><option value="">Select</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select> : field.type === 'checkbox' ? <input type="checkbox" checked={Boolean(values[field.key])} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.checked }))} /> : <input className="input" type={field.type ?? 'text'} value={String(values[field.key] ?? '')} onChange={(event) => setValues((current) => ({ ...current, [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value }))} />}</label>)}</div>
      </Modal>}
    </>
  );
}
