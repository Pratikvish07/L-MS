import { config } from '@/constants/config';
import type { AppUser } from '@/types/auth.types';
import type { ActiveSession, CommandType, DeviceCommand, MountStatus, Pairing } from '@/types/pairing.types';
import { createSessionId } from '@/utils/id';

// Static demo pairing. The video file itself is still uploaded to the live API.
const pairings = new Map<string, Pairing>();
const codeMap = new Map<string, { mountUid: string; deviceName: string; expiresAt: number; used: boolean }>();
const watchers = new Map<string, Set<(pairing: Pairing | null, fromCache: boolean) => void>>();
const STORAGE_KEY = 'lms-static-pairings-v1';
function storage() { return typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null; }
function loadPairings() {
  try { const raw = storage()?.getItem(STORAGE_KEY); if (raw) (JSON.parse(raw) as Pairing[]).forEach((pairing) => pairings.set(pairing.mountUid, pairing)); } catch { /* ignore invalid local demo data */ }
}
function savePairings() { try { storage()?.setItem(STORAGE_KEY, JSON.stringify([...pairings.values()])); } catch { /* native fallback remains in memory */ } }
const emit = (mountUid: string) => { savePairings(); watchers.get(mountUid)?.forEach((listener) => listener(pairings.get(mountUid) ?? null, false)); };
loadPairings();
const pairingKey = (uid: string) => uid === 'faculty-pratik' ? 'mount-tripod101' : uid;

export async function createPairingCodeForMount(mount: AppUser, deviceName: string) {
  const code = '101010';
  const expiresAt = Date.now() + config.pairingCodeTtlSeconds * 1000;
  codeMap.set(code, { mountUid: mount.uid, deviceName, expiresAt, used: false });
  return { code, expiresAt };
}
export function deletePairingCode(code: string) { codeMap.delete(code); return Promise.resolve(); }
export function subscribeToMountPairing(mountUid: string, onData: (p: Pairing | null, fromCache: boolean) => void, _onError: (e: Error) => void) {
  const key = pairingKey(mountUid); const set = watchers.get(key) ?? new Set(); set.add(onData); watchers.set(key, set); onData(pairings.get(key) ?? null, false);
  const timer = setInterval(() => { loadPairings(); onData(pairings.get(key) ?? null, false); }, 1000);
  return () => { set.delete(onData); clearInterval(timer); };
}
export async function reportMountStatus(mountUid: string, status: MountStatus) {
  const current = pairings.get(mountUid); if (!current) return;
  pairings.set(mountUid, { ...current, mountStatus: status }); emit(mountUid);
}
export async function releaseSession(mountUid: string) { const current = pairings.get(mountUid); if (current) { pairings.set(mountUid, { ...current, session: null }); emit(mountUid); } }
export async function claimPairingCode(faculty: AppUser, code: string): Promise<Pairing> {
  // Static demo mode must validate across separate browser/device runtimes;
  // an in-memory code map cannot be shared between the tripod and faculty.
  const row = code === '101010'
    ? (codeMap.get(code) ?? { mountUid: 'mount-tripod101', deviceName: 'Tripod Classroom 101', expiresAt: Date.now() + 60_000, used: false })
    : codeMap.get(code);
  if (!row || row.expiresAt <= Date.now()) throw new Error('That control code is invalid or expired.');
  row.used = true;
  const pairing: Pairing = { mountUid: row.mountUid, facultyUid: faculty.uid, facultyName: faculty.displayName, deviceName: row.deviceName, code, pairedAt: new Date().toISOString(), command: null, session: null, mountStatus: { state: 'preview', sessionId: '', lastSeen: Date.now(), freeBytes: 0, ackCommandId: '', ackResult: '', ackMessage: '', classroomId: 'classroom-101', classroomName: 'Tripod Classroom 101' } };
  pairings.set(row.mountUid, pairing); emit(row.mountUid); return pairing;
}
export function subscribeToFacultyPairings(facultyUid: string, onData: (p: Pairing[]) => void, _onError: (e: Error) => void) {
  const update = () => {
    loadPairings();
    // Keep the static demo usable after a page reload, when the in-memory
    // pairing map has been cleared.
    if (facultyUid === 'faculty-pratik' && ![...pairings.values()].some((p) => p.facultyUid === facultyUid)) {
      pairings.set('mount-tripod101', { mountUid: 'mount-tripod101', facultyUid, facultyName: 'Pratik Vish', deviceName: 'Tripod Classroom 101', code: '101010', pairedAt: new Date().toISOString(), command: null, session: null, mountStatus: { state: 'preview', sessionId: '', lastSeen: Date.now(), freeBytes: 0, ackCommandId: '', ackResult: '', ackMessage: '', classroomId: 'classroom-101', classroomName: 'Tripod Classroom 101' } });
      savePairings();
    }
    onData([...pairings.values()].filter((p) => p.facultyUid === facultyUid));
  };
  update(); const timer = setInterval(update, 1000); return () => clearInterval(timer);
}
export async function assignSession(mountUid: string, session: ActiveSession | null) {
  const current = pairings.get(mountUid);
  if (current) {
    pairings.set(mountUid, {
      ...current,
      session,
      mountStatus: current.mountStatus ? { ...current.mountStatus, sessionId: session?.sessionId ?? '', state: session ? 'preview' : 'idle', lastSeen: Date.now() } : current.mountStatus,
    });
    emit(mountUid);
  }
}
export async function sendCommand(faculty: AppUser, mountUid: string, type: CommandType, sessionId: string): Promise<DeviceCommand> {
  const command = { id: createSessionId(), type, sessionId, issuedBy: faculty.uid, issuedAt: Date.now() } as DeviceCommand;
  const current = pairings.get(mountUid);
  if (current) {
    const status = current.mountStatus ?? { state: 'preview', sessionId: '', lastSeen: Date.now(), freeBytes: 0, ackCommandId: '', ackResult: '', ackMessage: '', classroomId: 'classroom-101', classroomName: 'Tripod Classroom 101' };
    pairings.set(mountUid, {
      ...current,
      command,
      mountStatus: {
        ...status,
        state: type === 'start' ? 'recording' : type === 'stop' ? 'uploading' : status.state,
        sessionId,
        lastSeen: Date.now(),
        ackCommandId: command.id,
        ackResult: 'ok',
        ackMessage: '',
      },
    });
    emit(mountUid);
  }
  return command;
}
export async function unpair(mountUid: string) { pairings.delete(mountUid); emit(mountUid); }
