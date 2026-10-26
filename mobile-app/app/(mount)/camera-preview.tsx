import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions, useMicrophonePermissions, type CameraType } from 'expo-camera';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { CameraSurface } from '@/components/recording/CameraSurface';
import { ControlCodeCard } from '@/components/recording/ControlCodeCard';
import { elapsedSeconds, RecordingTimer } from '@/components/recording/RecordingTimer';
import { recording as recordingSettings } from '@/constants/recording';
import { colors, radius } from '@/constants/theme';
import { useMount, type CommandHandler, type CommandResult } from '@/context/MountContext';
import { useCurrentUser } from '@/hooks/useAuth';
import { useControlCode } from '@/hooks/useControlCode';
import { useScreenAwake } from '@/hooks/useScreenAwake';
import { availableBytes, persistRecording, persistThumbnail } from '@/services/local-recordings.service';
import { markRecordingAborted, markRecordingStarted, markSavedLocally } from '@/services/recording.service';
import type { ActiveSession } from '@/types/pairing.types';
import { estimateRecordingMinutes, formatBytes } from '@/utils/file-size';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Phase = 'preview' | 'recording' | 'saving';

const IS_WEB = Platform.OS === 'web';

/** Refuse to start below this, so a lecture cannot fill the disk mid-recording. */
const MIN_FREE_BYTES = 1024 * 1024 * 1024;

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.roundWrap, disabled && { opacity: 0.4 }]}
    >
      <View style={[styles.round, active && { backgroundColor: colors.amber }]}>
        <Ionicons name={icon} size={24} color={colors.white} />
      </View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export default function CameraPreviewScreen() {
  useScreenAwake();
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const { autoStart } = useLocalSearchParams<{ autoStart?: string }>();
  const { pairing, connected, deviceName, setLocalState, registerCommandHandler, releaseSession } = useMount();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const cameraRef = useRef<CameraSurface>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>('preview');
  // Rotating code so another faculty member can take control between lectures.
  // Faculty records directly on this screen; control-code rotation belongs
  // only to the dedicated mount device.
  const isMount = user.role === 'mount';
  const control = useControlCode(user, deviceName, isMount && phase === 'preview' && !!pairing, pairing?.code);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [pausedMs, setPausedMs] = useState(0);
  const [pausedSince, setPausedSince] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeBytes, setFreeBytes] = useState(availableBytes());

  // Request device permissions once when the mount camera screen opens. After
  // this first approval, the faculty controls recording remotely; the mount
  // operator does not need to press an access button for every lecture.
  useEffect(() => {
    if (!cameraPermission || !micPermission) return;
    if (!cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission().catch(() => undefined);
    }
    if (!micPermission.granted && micPermission.canAskAgain) {
      requestMicPermission().catch(() => undefined);
    }
  }, [cameraPermission?.granted, micPermission?.granted, cameraPermission?.canAskAgain, micPermission?.canAskAgain]);

  // Values the async recording callbacks need without stale closures.
  const phaseRef = useRef<Phase>('preview');
  const activeRef = useRef<{ session: ActiveSession; facultyUid: string } | null>(null);
  const timingRef = useRef({ startedAt: 0, pausedMs: 0, pausedSince: null as number | null });
  const thumbnailRef = useRef<string | null>(null);

  const session = pairing?.session ?? null;
  const shownSession = activeRef.current?.session ?? session;
  const canPause = cameraReady && !!cameraRef.current?.getSupportedFeatures?.().toggleRecordingAsyncAvailable;

  const setPhaseBoth = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  // Tell the faculty phone whether the camera is ready for this lecture.
  useEffect(() => {
    if (phase !== 'preview') return;
    setLocalState(cameraReady && session ? 'preview' : 'idle', session?.sessionId ?? '');
  }, [phase, cameraReady, session?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => setFreeBytes(availableBytes()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Block the Android back button while recording or saving.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => phaseRef.current !== 'preview');
    return () => sub.remove();
  }, []);

  const finishRecording = async (uri: string | undefined) => {
    const active = activeRef.current;
    if (!active) return;
    const { sessionId, metadata } = active.session;
    const t = timingRef.current;
    const durationSeconds = Math.round(elapsedSeconds(t.startedAt, t.pausedMs, t.pausedSince));
    setPhaseBoth('saving');
    setLocalState('saving', sessionId);
    setTorch(false);

    try {
      if (!uri) throw new Error('The camera did not produce a video file.');
      const thumbnailUri = thumbnailRef.current ? await persistThumbnail(thumbnailRef.current, sessionId) : undefined;
      const saved = await persistRecording(uri, {
        sessionId,
        facultyUid: active.facultyUid,
        durationSeconds,
        thumbnailUri,
        metadata,
      });
      // Never block on status writes once the file is safe; the upload updates the record again.
      markSavedLocally(sessionId, durationSeconds, saved.fileSizeBytes).catch(() => undefined);
      releaseSession().catch(() => undefined);
      activeRef.current = null;
      setLocalState('idle', '');
      router.replace({ pathname: (user.role === 'faculty' ? '/faculty-upload' : '/upload') as any, params: { sessionId } });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`Recording could not be saved: ${message}`);
      markRecordingAborted(sessionId, message).catch(() => undefined);
      activeRef.current = null;
      setPhaseBoth('preview');
    } finally {
      setStartedAt(null);
      setPausedSince(null);
      setPausedMs(0);
      thumbnailRef.current = null;
    }
  };

  const startRecording = async (): Promise<CommandResult> => {
    if (phaseRef.current !== 'preview') return { ok: false, message: 'Already recording.' };
    if (!cameraReady || !cameraRef.current) return { ok: false, message: 'Camera is not ready yet.' };
    if (!session || !pairing) return { ok: false, message: 'No lecture details received from the faculty phone.' };
    if (!micPermission?.granted) return { ok: false, message: 'Microphone permission is not granted on the mount phone.' };
    const free = availableBytes();
    if (free < MIN_FREE_BYTES) {
      return { ok: false, message: `Not enough storage on the mount phone (${formatBytes(free)} free).` };
    }

    setError(null);
    activeRef.current = { session, facultyUid: pairing.facultyUid };
    const now = Date.now();
    timingRef.current = { startedAt: now, pausedMs: 0, pausedSince: null };
    setStartedAt(now);
    setPhaseBoth('recording');
    setLocalState('recording', session.sessionId);
    markRecordingStarted(session.sessionId).catch(() => undefined);

    cameraRef.current
      .recordAsync()
      .then((result) => finishRecording(result?.uri))
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (activeRef.current) {
          markRecordingAborted(activeRef.current.session.sessionId, message).catch(() => undefined);
          activeRef.current = null;
        }
        setError(`Recording failed: ${message}`);
        setStartedAt(null);
        setPhaseBoth('preview');
      });
    // Best-effort thumbnail a few seconds in; some devices cannot capture stills while recording.
    setTimeout(() => {
      if (phaseRef.current !== 'recording' || thumbnailRef.current) return;
      cameraRef.current
        ?.takePictureAsync({ quality: 0.4, shutterSound: false })
        .then((photo) => {
          thumbnailRef.current = photo.uri;
        })
        .catch(() => undefined);
    }, 3000);

    return { ok: true };
  };

  useEffect(() => {
    if (autoStart !== '1' || !cameraReady || !session || phaseRef.current !== 'preview') return;
    void startRecording();
  }, [autoStart, cameraReady, session?.sessionId]);

  const stopRecording = (): CommandResult => {
    if (phaseRef.current !== 'recording') return { ok: false, message: 'Not recording.' };
    cameraRef.current?.stopRecording();
    return { ok: true };
  };

  const togglePause = async () => {
    if (!cameraRef.current || phaseRef.current !== 'recording') return;
    try {
      await cameraRef.current.toggleRecordingAsync();
      const t = timingRef.current;
      if (t.pausedSince) {
        t.pausedMs += Date.now() - t.pausedSince;
        t.pausedSince = null;
        setLocalState('recording');
      } else {
        t.pausedSince = Date.now();
        setLocalState('paused');
      }
      setPausedMs(t.pausedMs);
      setPausedSince(t.pausedSince);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pause is not supported on this device.');
    }
  };

  const takeSnapshot = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5, shutterSound: false });
      if (photo) {
        thumbnailRef.current = photo.uri;
        setError(null);
      }
    } catch {
      setError('This device cannot take a photo while recording video.');
    }
  };

  // Latest implementations behind a stable handler registered with the controller.
  const implRef = useRef<CommandHandler>(async () => ({ ok: false, message: 'Camera not ready.' }));
  implRef.current = async (command) => {
    if (command.type === 'start') {
      if (command.sessionId !== session?.sessionId) {
        return { ok: false, message: 'That lecture is not the one assigned to this mount phone.' };
      }
      return startRecording();
    }
    if (command.type === 'stop') {
      if (command.sessionId !== activeRef.current?.session.sessionId) {
        // Nothing is recording here (the app or page was reloaded or closed mid-lecture),
        // so the lecture is stuck in "recording". Reset it so it can be started again.
        await markRecordingAborted(command.sessionId, 'Recording was interrupted on the tripod. Start it again.').catch(
          () => undefined,
        );
        return {
          ok: false,
          message: 'Nothing was recording on the tripod (it was reloaded or closed), so the lecture was reset. Start it again.',
        };
      }
      return stopRecording();
    }
    return { ok: false, message: 'Unsupported command.' };
  };
  useEffect(() => {
    registerCommandHandler((command) => implRef.current(command));
    return () => registerCommandHandler(null);
  }, [registerCommandHandler]);

  // Unpaired while idle: go back to pairing. While recording, finish safely first.
  if (isMount && !pairing && phase === 'preview') return <Redirect href="/pair-device" />;

  if (!cameraPermission || !micPermission) return <LoadingView dark />;

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="videocam-off-outline" size={48} color="#9CA3AF" />
        <Text style={styles.permTitle}>Camera and microphone needed</Text>
        <Text style={styles.permBody}>The mount phone records the lecture video with the classroom audio.</Text>
        <Text style={styles.permBody}>Preparing the mount camera. Faculty will control Start and Stop remotely.</Text>
        {(!cameraPermission.canAskAgain || !micPermission.canAskAgain) && (
          <Text style={styles.permBody}>If no prompt appears, enable the permissions in Android Settings → Apps.</Text>
        )}
      </View>
    );
  }

  const recording = phase === 'recording';

  return (
    <View style={styles.screen}>
      <AppHeader
        dark
        title={user.classroomName || 'Mount Device'}
        accessory={
          <View style={[styles.badge, { backgroundColor: connected ? 'rgba(14,159,110,0.2)' : 'rgba(224,36,36,0.2)' }]}>
            <View style={[styles.badgeDot, { backgroundColor: connected ? colors.primary : colors.red }]} />
            <Text style={[styles.badgeText, { color: connected ? '#34D399' : '#F87171' }]}>
              {connected ? 'Connected' : 'Offline'}
            </Text>
          </View>
        }
        right={
          phase === 'preview'
            ? { icon: 'settings-outline', label: 'Device settings and upload queue', onPress: () => router.push('/queue') }
            : undefined
        }
      />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]} scrollEnabled={!recording}>
        <View style={styles.cameraWrap}>
          <CameraSurface
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            videoQuality={recordingSettings.quality}
            videoBitrate={recordingSettings.videoBitsPerSecond}
            enableTorch={torch}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(e) => setError(`Camera error: ${e.message}`)}
          />
          <View style={styles.qualityBadge}>
            <Text style={styles.qualityText}>{IS_WEB ? recordingSettings.web.label : recordingSettings.quality}</Text>
          </View>
          {startedAt && (
            <View style={styles.timerOverlay}>
              <RecordingTimer startedAt={startedAt} pausedMs={pausedMs} pausedSince={pausedSince} />
            </View>
          )}
          {phase === 'saving' && (
            <View style={styles.savingOverlay}>
              <LoadingView dark message="Saving video to this phone…" />
            </View>
          )}
        </View>

        {IS_WEB && (
          <View style={styles.webNotice}>
            <Text style={styles.webNoticeText}>
              Browser recording: keep this tab open and in front until the upload has finished.
            </Text>
          </View>
        )}
        {error && <ErrorBanner message={error} />}

        {recording ? (
          <View style={styles.controls}>
            <RoundButton
              icon={pausedSince ? 'play' : 'pause'}
              label={pausedSince ? 'Resume' : 'Pause'}
              onPress={togglePause}
              disabled
              active={!!pausedSince}
            />
            <View style={styles.recordOuter} accessibilityLabel="Recording controlled by faculty">
              <View style={styles.stopInner} />
            </View>
            <RoundButton icon="camera-outline" label="Snapshot" onPress={takeSnapshot} />
          </View>
        ) : (
          <>
            <View style={styles.controls}>
              <RoundButton
                icon={torch ? 'flash' : 'flash-off'}
                label="Flash"
                onPress={() => setTorch((t) => !t)}
                disabled={facing === 'front'}
                active={torch}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start recording controlled by faculty"
                accessibilityState={{ disabled: true }}
                disabled
                style={[styles.recordOuter, (!session || !cameraReady) && { opacity: 0.4 }]}
              >
                <View style={styles.recordInner} />
              </Pressable>
              <RoundButton
                icon="camera-reverse-outline"
                label="Flip"
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              />
            </View>
            <Text style={styles.hint}>
              {session
                ? 'Only the faculty phone can start and stop recording'
                : `Waiting for lecture details from ${pairing?.facultyName || 'the faculty phone'}…`}
            </Text>
          </>
        )}

          {isMount && phase === 'preview' && pairing && (
          <View style={{ gap: 8 }}>
            <Text style={styles.controlledBy}>
              Controlled by <Text style={{ color: colors.white, fontWeight: '700' }}>{pairing.facultyName || 'faculty'}</Text>
            </Text>
            <ControlCodeCard code={control.code} secondsLeft={control.secondsLeft} compact />
            {control.error && <ErrorBanner message={control.error} onRetry={control.rotate} />}
          </View>
        )}

        {shownSession && (
          <View style={styles.metaPanel}>
            <MetaRow label="Classroom" value={shownSession.metadata.classroomName} />
            <MetaRow label="Class" value={shownSession.metadata.className} />
            {shownSession.metadata.subjectName ? <MetaRow label="Subject" value={shownSession.metadata.subjectName} /> : null}
            <MetaRow label="Chapter" value={shownSession.metadata.chapter} />
            <MetaRow label="Topic" value={shownSession.metadata.topic} />
          </View>
        )}

        {freeBytes > 0 && (
          <Text style={styles.storage}>
            {formatBytes(freeBytes, 1)} free · about {estimateRecordingMinutes(freeBytes)} min of {IS_WEB ? recordingSettings.web.label : recordingSettings.quality} video
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  permTitle: { fontSize: 20, fontWeight: '700', color: colors.white, textAlign: 'center' },
  permBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  content: { padding: 16, gap: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cameraWrap: {
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  qualityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  qualityText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  timerOverlay: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center' },
  savingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  roundWrap: { alignItems: 'center', gap: 6, width: 72 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.darkSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundLabel: { fontSize: 12, color: '#D1D5DB' },
  recordOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.red },
  stopInner: { width: 32, height: 32, borderRadius: 6, backgroundColor: colors.red },
  hint: { fontSize: 14, color: '#D1D5DB', textAlign: 'center' },
  metaPanel: {
    padding: 14,
    gap: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.darkSurface,
  },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaLabel: { width: 90, fontSize: 13, color: '#9CA3AF' },
  metaValue: { flex: 1, fontSize: 13, color: colors.white, fontWeight: '500' },
  storage: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  webNotice: { padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(217,119,6,0.15)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.4)' },
  webNoticeText: { fontSize: 13, color: '#FCD34D', textAlign: 'center', lineHeight: 19 },
  controlledBy: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
