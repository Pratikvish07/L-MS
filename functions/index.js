// Server-side LMS operations that must not run in the browser.
// Deploy: `firebase deploy --only functions` from the repo root (needs the Blaze plan).
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import { setGlobalOptions } from 'firebase-functions/options';

initializeApp();
setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();
const now = () => new Date().toISOString();

async function requireAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const admin = await db.doc(`admins/${uid}`).get();
  if (!admin.exists || admin.get('role') !== 'admin' || admin.get('isActive') !== true) {
    throw new HttpsError('permission-denied', 'Only administrators can do this.');
  }
  return uid;
}

// Enrolment (creating logins, purchase IDs) runs in the admin CMS: admin-cms/src/lib/courses.ts.

/** Approve a self-registered student without enrolling them yet. */
export const setStudentApproval = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { uid, approved } = request.data ?? {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Student is required.');
  const ref = db.doc(`users/${uid}`);
  const profile = await ref.get();
  if (!profile.exists || profile.get('role') !== 'student') throw new HttpsError('not-found', 'Student not found.');
  await ref.update({ active: approved === true, approvalStatus: approved === true ? 'approved' : 'rejected', approvedBy: adminUid, approvedAt: now(), updatedAt: now() });
  await auth.updateUser(uid, { disabled: approved !== true });
  return { ok: true };
});

