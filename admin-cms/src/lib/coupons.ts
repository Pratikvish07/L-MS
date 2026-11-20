// Coupons: coupons/{CODE}. Offer codes chosen when an admin enrols students into a batch
// (lib/courses.ts enrollStudents); the code is recorded on the enrolment and its usage counted.
import { collection, deleteDoc, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { firestore } from './firebase';

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  /** Empty = every course. */
  courseIds: string[];
  /** yyyy-mm-dd, inclusive. Empty = no limit. */
  startsAt: string;
  endsAt: string;
  /** 0 = unlimited. */
  usageLimit: number;
  usedCount: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const now = () => new Date().toISOString();
export const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time
export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

/** Firestore data → Coupon with safe defaults for missing fields. */
export function toCoupon(id: string, data: Record<string, unknown>): Coupon {
  return {
    id, code: String(data.code ?? id), description: String(data.description ?? ''),
    discountType: data.discountType === 'fixed' ? 'fixed' : 'percentage', discountValue: Number(data.discountValue ?? 0),
    courseIds: Array.isArray(data.courseIds) ? data.courseIds.map(String) : [],
    startsAt: String(data.startsAt ?? ''), endsAt: String(data.endsAt ?? ''),
    usageLimit: Number(data.usageLimit ?? 0), usedCount: Number(data.usedCount ?? 0), active: data.active !== false,
    createdAt: String(data.createdAt ?? ''), updatedAt: String(data.updatedAt ?? ''),
  };
}

export function subscribeCoupons(onData: (rows: Coupon[]) => void, onError: (error: Error) => void) {
  return onSnapshot(collection(firestore, 'coupons'), (snapshot) => {
    onData(snapshot.docs.map((item) => toCoupon(item.id, item.data())).sort((a, b) => a.code.localeCompare(b.code)));
  }, onError);
}

/** Creates (code must be new) or updates a coupon. The code is the document ID, so codes stay unique. */
export async function saveCoupon(input: Omit<Coupon, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'>, existing?: Coupon) {
  const code = normalizeCode(input.code);
  if (!code) throw new Error('Enter a coupon code (letters, numbers, - or _).');
  if (input.discountValue <= 0) throw new Error('Discount must be more than 0.');
  if (input.discountType === 'percentage' && input.discountValue > 100) throw new Error('A percentage discount cannot be more than 100%.');
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) throw new Error('Expiry date must be on or after the start date.');
  const fields = { ...input, code, discountValue: Number(input.discountValue), usageLimit: Math.max(0, Math.round(Number(input.usageLimit) || 0)), updatedAt: now() };
  if (existing) {
    if (existing.id !== code) throw new Error('The code of an existing coupon cannot be changed. Create a new coupon instead.');
    await updateDoc(doc(firestore, 'coupons', code), fields);
    return;
  }
  const ref = doc(firestore, 'coupons', code);
  if ((await getDoc(ref)).exists()) throw new Error(`Coupon ${code} already exists.`);
  await setDoc(ref, { ...fields, usedCount: 0, createdAt: now() });
}

export const setCouponActive = (coupon: Coupon, active: boolean) => updateDoc(doc(firestore, 'coupons', coupon.id), { active, updatedAt: now() });
export const deleteCoupon = (coupon: Coupon) => deleteDoc(doc(firestore, 'coupons', coupon.id));

export type CouponState = 'active' | 'scheduled' | 'expired' | 'used-up' | 'inactive';
export function couponState(coupon: Coupon, on = today()): CouponState {
  if (!coupon.active) return 'inactive';
  if (coupon.endsAt && on > coupon.endsAt) return 'expired';
  if (coupon.startsAt && on < coupon.startsAt) return 'scheduled';
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return 'used-up';
  return 'active';
}
export const appliesTo = (coupon: Coupon, courseId: string) => !coupon.courseIds.length || coupon.courseIds.includes(courseId);

/** Why a coupon cannot be used for this course today, or null if it can. */
export function couponProblem(coupon: Coupon, courseId: string): string | null {
  const state = couponState(coupon);
  if (state === 'inactive') return `Coupon ${coupon.code} is turned off.`;
  if (state === 'expired') return `Coupon ${coupon.code} expired on ${coupon.endsAt}.`;
  if (state === 'scheduled') return `Coupon ${coupon.code} starts on ${coupon.startsAt}.`;
  if (state === 'used-up') return `Coupon ${coupon.code} has reached its usage limit.`;
  if (!appliesTo(coupon, courseId)) return `Coupon ${coupon.code} does not apply to this course.`;
  return null;
}


export const discountLabel = (coupon: Pick<Coupon, 'discountType' | 'discountValue'>, currency = 'INR') =>
  coupon.discountType === 'percentage' ? `${coupon.discountValue}% OFF` : `${money(coupon.discountValue, currency)} OFF`;

export function money(amount: number, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount}`; }
}

/** Readable random code, e.g. RBU-7KQ2M. */
export function generateCode(prefix = 'RBU') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `${prefix}-${[...crypto.getRandomValues(new Uint32Array(5))].map((value) => chars[value % chars.length]).join('')}`;
}
