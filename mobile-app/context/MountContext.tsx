import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useCurrentUser } from '@/hooks/useAuth';
import { availableBytes, cleanupUploadedRecordings } from '@/services/local-recordings.service';
import { releaseSession, reportMountStatus, subscribeToMountPairing, unpair } from '@/services/pairing.service';
import {
  MOUNT_HEARTBEAT_MS,
  START_COMMAND_MAX_AGE_MS,
  type DeviceCommand,
  type MountState,
  type MountStatus,
  type Pairing,
} from '@/types/pairing.types';

export type CommandResult = { ok: true } | { ok: false; message: string };
export type CommandHandler = (command: DeviceCommand) => Promise<CommandResult>;

interface MountContextValue {
  pairing: Pairing | null;
  loaded: boolean;
  /** False until the pairing has been loaded. */
  connected: boolean;
  error: string | null;
  deviceName: string;
  setLocalState: (state: MountState, sessionId?: string) => void;
  /** The camera screen registers itself to execute start/stop commands. */
  registerCommandHandler: (handler: CommandHandler | null) => void;
  releaseSession: () => Promise<void>;
  unpairDevice: () => Promise<void>;
}

const MountContext = createContext<MountContextValue | null>(null);

export function useMount() {
  const ctx = useContext(MountContext);
  if (!ctx) throw new Error('useMount must be used inside <MountProvider>.');
  return ctx;
}

export function MountProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const deviceName = Constants.deviceName ? `${Constants.deviceName}` : 'Mount device';

  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pairingRef = useRef<Pairing | null>(null);
  const handlerRef = useRef<CommandHandler | null>(null);
  const handledCommandRef = useRef<string | null>(null);
  const statusRef = useRef<Omit<MountStatus, 'lastSeen' | 'freeBytes'>>({
    state: 'idle',
    sessionId: '',
    ackCommandId: '',
    ackResult: '',
    ackMessage: '',
    classroomId: user.classroomId ?? '',
    classroomName: user.classroomName ?? '',
  });
  // Keep the reported room in step with the admin's assignment.
  statusRef.current.classroomId = user.classroomId ?? '';
  statusRef.current.classroomName = user.classroomName ?? '';

  const pushStatus = useCallback(() => {
    const current = pairingRef.current;
    if (!current) return;
    reportMountStatus(user.uid, { ...statusRef.current, lastSeen: Date.now(), freeBytes: availableBytes() }).catch(
      (e: Error) => setError(e.message),
    );
  }, [user.uid]);

  // Remove videos whose upload was verified in an earlier run.
  useEffect(() => {
    cleanupUploadedRecordings().catch(() => undefined);
  }, []);

  useEffect(() => {
    return subscribeToMountPairing(
      user.uid,
      (next, fromCache) => {
        const wasPaired = !!pairingRef.current;
        pairingRef.current = next;
        setPairing(next);
        setConnected(!fromCache);
        setLoaded(true);
        setError(null);
        if (next && handledCommandRef.current === null) {
          // Resume from the last acknowledged command so nothing runs twice after a restart.
          handledCommandRef.current = next.mountStatus?.ackCommandId ?? '';
          statusRef.current.ackCommandId = handledCommandRef.current;
        }
        if (next && !wasPaired) pushStatus();
        if (!next) handledCommandRef.current = null;
      },
      (e) => {
        setError(e.message);
        setLoaded(true);
      },
    );
  }, [user.uid, pushStatus]);

  // Heartbeat so the faculty phone can show "Connected".
  useEffect(() => {
    if (!pairing) return;
    const timer = setInterval(pushStatus, MOUNT_HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') pushStatus();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [pairing ? pairing.mountUid : null, pushStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledge = useCallback(
    (commandId: string, result: CommandResult) => {
      statusRef.current = {
        ...statusRef.current,
        ackCommandId: commandId,
        ackResult: result.ok ? 'ok' : 'rejected',
        ackMessage: result.ok ? '' : result.message,
      };
      pushStatus();
    },
    [pushStatus],
  );

  // Execute each new command exactly once.
  const command = pairing?.command ?? null;
  useEffect(() => {
    const current = pairingRef.current;
    if (!command || !current) return;
    if (command.id === handledCommandRef.current) return;
    handledCommandRef.current = command.id;

    (async (): Promise<CommandResult> => {
      if (command.issuedBy !== current.facultyUid) return { ok: false, message: 'Command not from the paired faculty.' };
      if (command.type === 'start' && Date.now() - command.issuedAt > START_COMMAND_MAX_AGE_MS) {
        return { ok: false, message: 'Start command expired before it reached the mount phone. Send it again.' };
      }
      if (command.type === 'retry_upload') {
        if (['recording', 'paused', 'saving', 'uploading'].includes(statusRef.current.state)) {
          return { ok: false, message: 'Mount phone is busy. Try again when it is idle.' };
        }
        router.push({ pathname: '/upload', params: { sessionId: command.sessionId } });
        return { ok: true };
      }
      if (!handlerRef.current) return { ok: false, message: 'The camera is not open on the mount phone.' };
      return handlerRef.current(command);
    })()
      .catch((e: unknown): CommandResult => ({ ok: false, message: e instanceof Error ? e.message : String(e) }))
      .then((result) => acknowledge(command.id, result));
  }, [command, acknowledge]);

  const value = useMemo<MountContextValue>(
    () => ({
      pairing,
      loaded,
      connected,
      error,
      deviceName,
      setLocalState: (state, sessionId) => {
        statusRef.current = { ...statusRef.current, state, sessionId: sessionId ?? statusRef.current.sessionId };
        pushStatus();
      },
      registerCommandHandler: (handler) => {
        handlerRef.current = handler;
      },
      releaseSession: async () => {
        if (pairingRef.current?.session) await releaseSession(user.uid);
      },
      unpairDevice: async () => {
        await unpair(user.uid);
      },
    }),
    [pairing, loaded, connected, error, deviceName, pushStatus, user.uid],
  );

  return <MountContext.Provider value={value}>{children}</MountContext.Provider>;
}
