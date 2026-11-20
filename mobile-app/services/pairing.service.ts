import { collection, deleteDoc, doc, getDoc, onSnapshot, query, runTransaction, setDoc, updateDoc, where } from 'firebase/firestore';
import { config } from '@/constants/config';
import type { AppUser } from '@/types/auth.types';
import type { ActiveSession, CommandType, DeviceCommand, MountStatus, Pairing } from '@/types/pairing.types';
import { createPairingCode, createSessionId } from '@/utils/id';
import { firestore } from './firebase';

const TAKEOVER_SILENCE_MS = 2 * 60_000;

function mapPairing(id: string, value: Record<string, any>): Pairing {
  return {
    mountUid: String(value.mountUid ?? id),
    facultyUid: String(value.facultyUid ?? ''),
    facultyName: String(value.facultyName ?? ''),
    deviceName: String(value.deviceName ?? 'Mount device'),
    code: String(value.code ?? ''),
    pairedAt: String(value.pairedAt ?? ''),
    command: value.command ?? null,
    session: value.session ?? null,
    mountStatus: value.mountStatus ?? null,
  };
}

export async function createPairingCodeForMount(mount: AppUser, deviceName: string) {
  const code = createPairingCode();
  const expiresAt = Date.now() + config.pairingCodeTtlSeconds * 1000;
  await setDoc(doc(firestore, 'pairingCodes', code), { mountUid: mount.uid, deviceName, used: false, expiresAt });
  return { code, expiresAt };
}

export function deletePairingCode(code: string) {
  return deleteDoc(doc(firestore, 'pairingCodes', code)).catch(() => undefined);
}

export function subscribeToMountPairing(mountUid: string, onData: (pairing: Pairing | null, fromCache: boolean) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(firestore, 'pairings', mountUid), (snapshot) => {
    onData(snapshot.exists() ? mapPairing(snapshot.id, snapshot.data()) : null, snapshot.metadata.fromCache);
  }, onError);
}

export async function reportMountStatus(mountUid: string, status: MountStatus) {
  await updateDoc(doc(firestore, 'pairings', mountUid), { mountStatus: status });
}

export async function releaseSession(mountUid: string) {
  await updateDoc(doc(firestore, 'pairings', mountUid), { session: null });
}

export async function claimPairingCode(faculty: AppUser, code: string): Promise<Pairing> {
  const codeRef = doc(firestore, 'pairingCodes', code);
  const codeSnapshot = await getDoc(codeRef);
  if (!codeSnapshot.exists()) throw new Error('That control code is invalid or expired.');
  const codeRow = codeSnapshot.data();
  if (codeRow.used || Number(codeRow.expiresAt) <= Date.now()) throw new Error('That control code is invalid or expired.');

  const mountUid = String(codeRow.mountUid);
  const pairingRef = doc(firestore, 'pairings', mountUid);
  const currentSnapshot = await getDoc(pairingRef);
  const current = currentSnapshot.exists() ? currentSnapshot.data() : null;
  if (current && current.facultyUid !== faculty.uid) {
    const busy = ['recording', 'paused', 'saving'].includes(String(current.mountStatus?.state ?? ''));
    const silent = Date.now() - Number(current.mountStatus?.lastSeen ?? 0) > TAKEOVER_SILENCE_MS;
    if (busy && !silent) throw new Error(`Control was refused. The classroom phone is recording for ${current.facultyName || 'another faculty member'}.`);
  }

  const pairing: Pairing = {
    mountUid,
    facultyUid: faculty.uid,
    facultyName: faculty.displayName,
    deviceName: String(codeRow.deviceName ?? 'Mount device'),
    code,
    pairedAt: new Date().toISOString(),
    command: null,
    session: null,
    mountStatus: current?.mountStatus ?? null,
  };
  await runTransaction(firestore, async (transaction) => {
    const latestCode = await transaction.get(codeRef);
    if (!latestCode.exists() || latestCode.data().used || Number(latestCode.data().expiresAt) <= Date.now()) throw new Error('That control code is invalid or expired.');
    transaction.update(codeRef, { used: true, claimedBy: faculty.uid });
    transaction.set(pairingRef, pairing);
  });
  return pairing;
}

export function subscribeToFacultyPairings(facultyUid: string, onData: (pairings: Pairing[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(firestore, 'pairings'), where('facultyUid', '==', facultyUid)), (snapshot) => {
    onData(snapshot.docs.map((item) => mapPairing(item.id, item.data())));
  }, onError);
}

export function assignSession(mountUid: string, session: ActiveSession | null) {
  return updateDoc(doc(firestore, 'pairings', mountUid), { session });
}

export async function sendCommand(faculty: AppUser, mountUid: string, type: CommandType, sessionId: string): Promise<DeviceCommand> {
  const command: DeviceCommand = { id: createSessionId(), type, sessionId, issuedBy: faculty.uid, issuedAt: Date.now() };
  await updateDoc(doc(firestore, 'pairings', mountUid), { command });
  return command;
}

export function unpair(mountUid: string) {
  return deleteDoc(doc(firestore, 'pairings', mountUid));
}
