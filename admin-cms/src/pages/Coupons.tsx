import { CalendarRange, CheckCircle2, Copy, Pencil, Plus, Power, Search, Shuffle, TicketPercent, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageHead } from '../components/Layout';
import { ConfirmDialog, Modal } from '../components/Modal';
import { Spinner } from '../components/ui';
import {
  couponState, deleteCoupon, discountLabel, generateCode, normalizeCode, saveCoupon, setCouponActive, subscribeCoupons, today,
  type Coupon, type CouponState, type DiscountType,
} from '../lib/coupons';
import { subscribeCourses, type Course } from '../lib/courses';

const STATE_LABEL: Record<CouponState, string> = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', 'used-up': 'Used up', inactive: 'Off' };
const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
const shortDate = (value: string) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filter, setFilter] = useState<CouponState | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [removing, setRemoving] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => subscribeCoupons(setCoupons, (cause) => setError(cause.message)), []);
  useEffect(() => subscribeCourses(setCourses, (cause) => setError(cause.message)), []);

  const rows = coupons ?? [];
  const counts = useMemo(() => rows.reduce<Record<string, number>>((map, c) => ({ ...map, [couponState(c)]: (map[couponState(c)] ?? 0) + 1 }), {}), [rows]);
  const visible = rows.filter((c) => (filter === 'all' || couponState(c) === filter) && (!search.trim() || `${c.code} ${c.description}`.toLowerCase().includes(search.trim().toLowerCase())));
  const courseName = (id: string) => courses.find((course) => course.id === id)?.title ?? 'Removed course';

  const copy = async (code: string) => { try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 1500); } catch { /* clipboard blocked */ } };
  const toggle = async (coupon: Coupon) => { setError(''); try { await setCouponActive(coupon, !coupon.active); } catch (cause) { setError(message(cause)); } };
  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try { await deleteCoupon(removing); setRemoving(null); } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Coupons" subtitle="Offer codes recorded on enrolments"><button className="btn" onClick={() => { setError(''); setEditing('new'); }}><Plus size={16} /> Create coupon</button></PageHead>
      {error && <div className="alert" role="alert">{error}</div>}

      <div className="lecture-stats">
        <div className="card"><TicketPercent size={20} aria-hidden /><strong>{rows.length}</strong><span>Coupons</span></div>
        <div className="card"><CheckCircle2 size={20} aria-hidden /><strong>{counts.active ?? 0}</strong><span>Active now</span></div>
        <div className="card"><CalendarRange size={20} aria-hidden /><strong>{(counts.expired ?? 0) + (counts['used-up'] ?? 0)}</strong><span>Expired or used up</span></div>
        <div className="card"><Users size={20} aria-hidden /><strong>{rows.reduce((sum, c) => sum + c.usedCount, 0)}</strong><span>Times redeemed</span></div>
      </div>

      <section className="card card-pad">
        <div className="lecture-filters">
          <div className="chips" role="tablist" aria-label="Coupon status">
            {(['all', 'active', 'scheduled', 'expired', 'used-up', 'inactive'] as const).map((key) => (
              <button key={key} role="tab" aria-selected={filter === key} className={`filter-chip${filter === key ? ' active' : ''}`} onClick={() => setFilter(key)}>{key === 'all' ? 'All' : STATE_LABEL[key]} <b>{key === 'all' ? rows.length : counts[key] ?? 0}</b></button>
            ))}
          </div>
          <div className="search" style={{ maxWidth: 360 }}><Search size={16} aria-hidden /><input className="input" aria-label="Search coupons" placeholder="Search code or description" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>

        {!coupons ? <Spinner /> : (
          <div className="coupon-grid">
            {visible.map((coupon) => {
              const state = couponState(coupon);
              const usedPct = coupon.usageLimit ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : 0;
              return (
                <article key={coupon.id} className={`coupon-card state-${state}`}>
                  <div className="coupon-left">
                    <span className="coupon-off">{discountLabel(coupon)}</span>
                    <span className={`coupon-state state-${state}`}>{STATE_LABEL[state]}</span>
                  </div>
                  <div className="coupon-body">
                    <div className="coupon-code-row">
                      <code className="coupon-code">{coupon.code}</code>
                      <button className="icon-btn" aria-label={`Copy ${coupon.code}`} title="Copy code" onClick={() => void copy(coupon.code)}>{copied === coupon.code ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button>
                    </div>
                    {coupon.description && <p className="coupon-desc">{coupon.description}</p>}
                    <div className="chips">{coupon.courseIds.length ? coupon.courseIds.map((id) => <span key={id} className="icon-chip">{courseName(id)}</span>) : <span className="icon-chip ok">All courses</span>}</div>
                    <div className="lecture-meta"><span><CalendarRange size={13} aria-hidden /> {coupon.startsAt || coupon.endsAt ? `${shortDate(coupon.startsAt) || 'Now'} → ${shortDate(coupon.endsAt) || 'No expiry'}` : 'No date limit'}</span></div>
                    <div className="coupon-usage">
                      <span>{coupon.usedCount} used{coupon.usageLimit ? ` of ${coupon.usageLimit}` : ' · unlimited'}</span>
                      {coupon.usageLimit > 0 && <div className="dashboard-meter"><span style={{ width: `${usedPct}%` }} /></div>}
                    </div>
                    <div className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => void toggle(coupon)}><Power size={13} /> {coupon.active ? 'Turn off' : 'Turn on'}</button>
                      <button className="icon-btn" aria-label={`Edit ${coupon.code}`} onClick={() => { setError(''); setEditing(coupon); }}><Pencil size={14} /></button>
                      <button className="icon-btn danger" aria-label={`Delete ${coupon.code}`} onClick={() => setRemoving(coupon)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              );
            })}
            <button className="tile tile-add" onClick={() => { setError(''); setEditing('new'); }}><Plus size={22} aria-hidden /><strong>Create coupon</strong></button>
          </div>
        )}
        {coupons && rows.length > 0 && !visible.length && <div className="empty">No coupons match.</div>}
      </section>

      {editing && <CouponModal coupon={editing === 'new' ? null : editing} courses={courses} onClose={() => setEditing(null)} />}
      {removing && <ConfirmDialog title="Delete coupon" message={<>Delete <strong>{removing.code}</strong>? Enrolments that already used it keep the code on record.</>} busy={busy} onConfirm={() => void remove()} onCancel={() => setRemoving(null)} />}
    </>
  );
}

function CouponModal({ coupon, courses, onClose }: { coupon: Coupon | null; courses: Course[]; onClose: () => void }) {
  const [code, setCode] = useState(coupon?.code ?? '');
  const [description, setDescription] = useState(coupon?.description ?? '');
  const [discountType, setDiscountType] = useState<DiscountType>(coupon?.discountType ?? 'percentage');
  const [discountValue, setDiscountValue] = useState(coupon?.discountValue ?? 10);
  const [allCourses, setAllCourses] = useState(!coupon || !coupon.courseIds.length);
  const [courseIds, setCourseIds] = useState<string[]>(coupon?.courseIds ?? []);
  const [startsAt, setStartsAt] = useState(coupon?.startsAt ?? today());
  const [endsAt, setEndsAt] = useState(coupon?.endsAt ?? '');
  const [usageLimit, setUsageLimit] = useState(coupon?.usageLimit ?? 0);
  const [active, setActive] = useState(coupon?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const affected = allCourses ? courses : courses.filter((course) => courseIds.includes(course.id));
  const toggleCourse = (id: string) => setCourseIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const save = async () => {
    if (!allCourses && !courseIds.length) { setError('Choose at least one course, or apply it to all courses.'); return; }
    setBusy(true); setError('');
    try { await saveCoupon({ code, description: description.trim(), discountType, discountValue: Number(discountValue), courseIds: allCourses ? [] : courseIds, startsAt, endsAt, usageLimit: Number(usageLimit), active }, coupon ?? undefined); onClose(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  };

  return (
    <Modal wide title={coupon ? `Edit ${coupon.code}` : 'Create coupon'} onClose={onClose} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : coupon ? 'Save coupon' : 'Create coupon'}</button></>}>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="coupon-form">
        <div className="form-grid">
          <label className="field"><span>Coupon code *</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} disabled={Boolean(coupon)} placeholder="e.g. WELCOME20" value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} />
              {!coupon && <button className="btn btn-outline" type="button" title="Generate a code" onClick={() => setCode(generateCode())}><Shuffle size={14} /></button>}
            </div>
          </label>
          <label className="field"><span>Description</span><input className="input" placeholder="e.g. Early-bird offer" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <div className="field"><span>Discount type</span>
            <div className="seg" role="tablist">
              <button type="button" role="tab" aria-selected={discountType === 'percentage'} className={discountType === 'percentage' ? 'active' : ''} onClick={() => setDiscountType('percentage')}>Percentage %</button>
              <button type="button" role="tab" aria-selected={discountType === 'fixed'} className={discountType === 'fixed' ? 'active' : ''} onClick={() => setDiscountType('fixed')}>Fixed amount ₹</button>
            </div>
          </div>
          <label className="field"><span>{discountType === 'percentage' ? 'Discount (%) *' : 'Discount amount (₹) *'}</span><input className="input" type="number" min={0} max={discountType === 'percentage' ? 100 : undefined} value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} /></label>
          <label className="field"><span>Starts on</span><input className="input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <label className="field"><span>Expires on (empty = never)</span><input className="input" type="date" min={startsAt || undefined} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          <label className="field"><span>Usage limit (0 = unlimited)</span><input className="input" type="number" min={0} value={usageLimit} onChange={(e) => setUsageLimit(Number(e.target.value))} /></label>
          <label className="field checkbox" style={{ alignSelf: 'end' }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
          <div className="field full"><span>Applies to</span>
            <label className="checkbox"><input type="checkbox" checked={allCourses} onChange={(e) => setAllCourses(e.target.checked)} /> All courses</label>
            {!allCourses && <div className="picker"><div className="picker-list">
              {courses.map((course) => <label key={course.id} className="picker-item"><input type="checkbox" checked={courseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} /><span><strong>{course.title}</strong><small>{course.category || course.status || 'Course'}</small></span></label>)}
              {!courses.length && <span className="cell-sub" style={{ padding: 8 }}>No courses yet.</span>}
            </div></div>}
          </div>
        </div>

        <aside className="coupon-preview">
          <span className="cell-sub">Preview</span>
          <div className="coupon-card state-active" style={{ margin: '8px 0 12px' }}>
            <div className="coupon-left"><span className="coupon-off">{discountValue > 0 ? discountLabel({ discountType, discountValue }) : '—'}</span></div>
            <div className="coupon-body"><code className="coupon-code">{code || 'CODE'}</code>{description && <p className="coupon-desc">{description}</p>}</div>
          </div>
          <div className="cell-sub">{allCourses ? 'Applies to all courses' : `Applies to ${affected.length} course${affected.length === 1 ? '' : 's'}`}</div>
        </aside>
      </div>
    </Modal>
  );
}
