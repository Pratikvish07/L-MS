import { config } from '@/constants/config';
import type { AppUser } from '@/types/auth.types';
import type { ActiveSession, CommandType, DeviceCommand, MountStatus, Pairing } from '@/types/pairing.types';
import { createSessionId } from '@/utils/id';

// Firebase Realtime Database REST transport. Video upload remains on the existing API.
const root = `${config.firebaseDatabaseUrl}/lmsControl`;
const path = (value: string) => encodeURIComponent(value);
const url = (value: string) => `${root}/${value}.json?key=${encodeURIComponent(config.firebaseApiKey)}`;
async function read<T>(key: string): Promise<T | null> { const response = await fetch(url(key)); if (!response.ok) throw new Error(`Firebase read failed (${response.status}).`); return response.json(); }
async function write<T>(key: string, value: T): Promise<T> { const response = await fetch(url(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); if (!response.ok) throw new Error(`Firebase write failed (${response.status}).`); return response.json(); }
const pairingKey = (uid: string) => uid === 'faculty-pratik' ? 'mount-tripod101' : uid;
const normalize = (value: Pairing | null) => value ? { ...value, mountStatus: value.mountStatus ?? null, command: value.command ?? null, session: value.session ?? null } : null;

export async function createPairingCodeForMount(mount: AppUser, deviceName: string) { const code = String(Math.floor(100000 + Math.random() * 900000)); const expiresAt = Date.now() + config.pairingCodeTtlSeconds * 1000; await write(`codes/${path(code)}`, { mountUid: mount.uid, deviceName, expiresAt, used: false }); return { code, expiresAt }; }
export function deletePairingCode(code: string) { return write(`codes/${path(code)}`, null); }
export function subscribeToMountPairing(mountUid: string, onData: (p: Pairing | null, fromCache: boolean) => void, onError: (e: Error) => void) { const key = pairingKey(mountUid); let stopped = false; const poll = async () => { try { if (!stopped) onData(normalize(await read<Pairing>(`pairings/${path(key)}`)), false); } catch (e) { if (!stopped) onError(e instanceof Error ? e : new Error('Firebase pairing read failed.')); } }; void poll(); const timer = setInterval(poll, 1500); return () => { stopped = true; clearInterval(timer); }; }
export async function reportMountStatus(mountUid: string, status: MountStatus) { const key = pairingKey(mountUid); const current = await read<Pairing>(`pairings/${path(key)}`); if (current) await write(`pairings/${path(key)}/mountStatus`, status); }
export async function releaseSession(mountUid: string) { await write(`pairings/${path(pairingKey(mountUid))}/session`, null); }
export async function claimPairingCode(faculty: AppUser, code: string): Promise<Pairing> { const row = await read<{ mountUid: string; deviceName: string; expiresAt: number; used: boolean }>(`codes/${path(code)}`); if (!row || row.used || row.expiresAt <= Date.now()) throw new Error('That control code is invalid or expired.'); const pairing: Pairing = { mountUid: row.mountUid, facultyUid: faculty.uid, facultyName: faculty.displayName, deviceName: row.deviceName, code, pairedAt: new Date().toISOString(), command: null, session: null, mountStatus: { state: 'preview', sessionId: '', lastSeen: Date.now(), freeBytes: 0, ackCommandId: '', ackResult: '', ackMessage: '', classroomId: 'classroom-101', classroomName: row.deviceName } }; await write(`codes/${path(code)}/used`, true); await write(`pairings/${path(row.mountUid)}`, pairing); return pairing; }
export function subscribeToFacultyPairings(facultyUid: string, onData: (p: Pairing[]) => void, onError: (e: Error) => void) { let stopped = false; const poll = async () => { try { const value = await read<Record<string, Pairing>>('pairings'); if (!stopped) onData(Object.values(value ?? {}).filter((item) => item.facultyUid === facultyUid).map(normalize).filter(Boolean) as Pairing[]); } catch (e) { if (!stopped) onError(e instanceof Error ? e : new Error('Firebase pairing read failed.')); } }; void poll(); const timer = setInterval(poll, 1500); return () => { stopped = true; clearInterval(timer); }; }
export async function assignSession(mountUid: string, session: ActiveSession | null) { await write(`pairings/${path(pairingKey(mountUid))}/session`, session); }
export async function sendCommand(faculty: AppUser, mountUid: string, type: CommandType, sessionId: string): Promise<DeviceCommand> { const command: DeviceCommand = { id: createSessionId(), type, sessionId, issuedBy: faculty.uid, issuedAt: Date.now() }; await write(`pairings/${path(pairingKey(mountUid))}/command`, command); return command; }
export async function unpair(mountUid: string) { await write(`pairings/${path(pairingKey(mountUid))}`, null); }
