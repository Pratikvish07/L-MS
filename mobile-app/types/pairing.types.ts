import type { LectureMetadata } from './recording.types';

export type CommandType = 'start' | 'stop' | 'retry_upload';

/** Written only by the paired faculty account. */
export interface DeviceCommand {
  id: string;
  type: CommandType;
  sessionId: string;
  issuedBy: string;
  issuedAt: number;
}

export type MountState = 'offline' | 'idle' | 'preview' | 'recording' | 'paused' | 'saving' | 'uploading';

/** Written only by the mount phone. */
export interface MountStatus {
  state: MountState;
  sessionId: string;
  lastSeen: number;
  freeBytes: number;
  ackCommandId: string;
  ackResult: 'ok' | 'rejected' | '';
  ackMessage: string;
  /** Classroom the tripod is locked to by the admin ('' if not locked). */
  classroomId: string;
  classroomName: string;
}

export interface ActiveSession {
  sessionId: string;
  metadata: LectureMetadata;
}

/** Mount ↔ faculty pairing, keyed by mountUid. */
export interface Pairing {
  mountUid: string;
  facultyUid: string;
  facultyName: string;
  deviceName: string;
  code: string;
  pairedAt: string;
  command: DeviceCommand | null;
  session: ActiveSession | null;
  mountStatus: MountStatus | null;
}

/** A mount's 6-digit control code. */
export interface PairingCode {
  code: string;
  mountUid: string;
  deviceName: string;
  expiresAt: number;
  used: boolean;
}

/** A mount is shown as connected if it reported in within this window. */
export const MOUNT_HEARTBEAT_MS = 60_000;
export const MOUNT_ONLINE_WINDOW_MS = 180_000;
/** Start commands older than this are ignored after a reconnect. */
export const START_COMMAND_MAX_AGE_MS = 45_000;
