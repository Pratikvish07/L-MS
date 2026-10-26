import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { UploadProgress } from '@/components/recording/UploadProgress';
import { colors, radius } from '@/constants/theme';
import { useMount } from '@/context/MountContext';
import { useScreenAwake } from '@/hooks/useScreenAwake';
import { cleanupUploadedRecordings, getLocalRecording, getPlayableUri } from '@/services/local-recordings.service';
import { cancelActiveUpload, UploadCancelledError, uploadRecording, type UploadStep } from '@/services/storage.service';
import { isCompressionSupported } from '@/services/video-compress';
import type { LocalRecording } from '@/types/recording.types';
import { confirm } from '@/utils/confirm';
import { formatDuration } from '@/utils/date';
import { formatBytes } from '@/utils/file-size';

type Phase = 'loading' | 'missing' | 'uploading' | 'success' | 'failed' | 'cancelled';

const STEPS: { key: UploadStep; label: string }[] = [
  // Android compresses before uploading; browsers already record compressed.
  ...(isCompressionSupported ? [{ key: 'compressing' as const, label: 'Video compressed' }] : []),
  { key: 'uploading', label: 'Video file uploaded' },
  { key: 'saving', label: 'Saving lecture details' },
  { key: 'finalizing', label: 'Finalizing…' },
];
const STEP_ORDER: UploadStep[] = ['compressing', 'uploading', 'saving', 'finalizing', 'done'];

function StepRow({ label, state }: { label: string; state: 'done' | 'active' | 'todo' }) {
  return (
    <View style={styles.stepRow} accessible accessibilityLabel={`${label}: ${state === 'done' ? 'complete' : state === 'active' ? 'in progress' : 'pending'}`}>
      <Ionicons
        name={state === 'done' ? 'checkmark-circle' : state === 'active' ? 'ellipse-outline' : 'ellipse-outline'}
        size={22}
        color={state === 'done' ? colors.primary : state === 'active' ? colors.primary : '#D1D5DB'}
      />
      <Text style={[styles.stepText, state === 'todo' && { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function LocalVideoModal({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => p.play());
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={28} color={colors.white} />
        </Pressable>
        <VideoView player={player} style={{ flex: 1 }} nativeControls contentFit="contain" />
      </SafeAreaView>
    </Modal>
  );
}

export default function UploadScreen() {
  useScreenAwake();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { setLocalState } = useMount();
  const [entry, setEntry] = useState<LocalRecording | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [step, setStep] = useState<UploadStep>('uploading');
  const [progress, setProgress] = useState({ fraction: 0, transferred: 0, total: 0 });
  const [compressFraction, setCompressFraction] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playUri, setPlayUri] = useState<string | null>(null);
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;

  const start = useCallback(async (item: LocalRecording) => {
    setPhase('uploading');
    setError(null);
    setStep(isCompressionSupported && !item.compressed ? 'compressing' : 'uploading');
    setCompressFraction(0);
    setProgress({ fraction: 0, transferred: 0, total: item.fileSizeBytes });
    setLocalState('uploading', item.sessionId);
    try {
      await uploadRecording(item, {
        onProgress: (fraction, transferred, total) => setProgress({ fraction, transferred, total }),
        onStep: setStep,
        onCompressProgress: setCompressFraction,
      });
      // Show the final (compressed) size in the summary.
      const saved = await getLocalRecording(item.sessionId).catch(() => undefined);
      if (saved) setEntry(saved);
      setPhase('success');
    } catch (e) {
      if (e instanceof UploadCancelledError) {
        setPhase('cancelled');
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('failed');
      }
    } finally {
      setLocalState('idle', '');
    }
  }, [setLocalState]);

  useEffect(() => {
    if (!sessionId) return;
    getLocalRecording(sessionId).then((item) => {
      if (!item) {
        setPhase('missing');
        return;
      }
      setEntry(item);
      if (item.uploaded) setPhase('success');
      else start(item);
    });
  }, [sessionId, start]);

  // Leaving the success screen removes the verified local copy.
  useEffect(() => () => void cleanupUploadedRecordings().catch(() => undefined), []);

  const cancel = async () => {
    const ok = await confirm(
      'Cancel upload?',
      'The video stays saved on this phone. You can upload it later from the upload queue.',
      'Cancel upload',
    );
    if (ok) cancelActiveUpload();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phaseRef.current === 'uploading') {
        cancel();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'loading') return <LoadingView message="Preparing upload…" />;

  if (phase === 'missing') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <ErrorBanner message="This recording is not on this phone. It may already have been uploaded and cleaned up." />
          <AppButton title="Back to camera" onPress={() => router.replace('/camera-preview')} />
        </View>
      </SafeAreaView>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  if (phase === 'success' && entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={56} color={colors.white} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Upload Successful
          </Text>
          <Text style={styles.subtitle}>Your lecture has been uploaded successfully.</Text>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{entry.metadata.topic}</Text>
            <Text style={styles.summaryMeta}>
              {entry.metadata.className} · {entry.metadata.classroomName} · {formatDuration(entry.durationSeconds)} ·{' '}
              {formatBytes(entry.fileSizeBytes, 1)}
            </Text>
          </View>
          <AppButton
            title="View Recording"
            onPress={() =>
              getPlayableUri(entry)
                .then(setPlayUri)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
            }
          />
          {error && <ErrorBanner message={error} />}
          <AppButton title="Add New Recording" variant="outline" onPress={() => router.replace('/camera-preview')} />
        </View>
        {playUri && <LocalVideoModal uri={playUri} onClose={() => setPlayUri(null)} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.cloudIcon}>
          <Ionicons name={phase === 'failed' ? 'cloud-offline' : 'cloud-upload'} size={48} color={phase === 'failed' ? colors.red : colors.blue} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {phase === 'failed'
            ? 'Upload Failed'
            : phase === 'cancelled'
              ? 'Upload Paused'
              : step === 'compressing'
                ? 'Compressing Video'
                : 'Uploading to Cloud'}
        </Text>
        <Text style={styles.subtitle}>
          {phase === 'uploading'
            ? 'Please keep the app open'
            : 'The video is safe on this phone. You can retry now or later from the upload queue.'}
        </Text>

        {phase === 'uploading' &&
          (step === 'compressing' ? (
            <UploadProgress fraction={compressFraction} label="Compressing video before upload…" />
          ) : (
            <UploadProgress fraction={progress.fraction} transferredBytes={progress.transferred} totalBytes={progress.total} />
          ))}

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <StepRow
              key={s.key}
              label={s.label}
              state={phase !== 'uploading' ? 'todo' : i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo'}
            />
          ))}
        </View>

        {error && <ErrorBanner message={error} />}

        {phase === 'uploading' ? (
          // Compression cannot be interrupted from here; Cancel applies to the upload.
          step !== 'compressing' && <AppButton title="Cancel Upload" variant="danger" onPress={cancel} />
        ) : (
          <>
            <AppButton title="Retry Upload" icon="refresh" onPress={() => entry && start(entry)} />
            <AppButton title="Back to camera" variant="outline" onPress={() => router.replace('/camera-preview')} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  cloudIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.blueSoft,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 14,
    borderColor: colors.primarySoft,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  steps: { gap: 12, paddingVertical: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepText: { fontSize: 15, color: colors.text },
  summary: { padding: 14, borderRadius: radius.md, backgroundColor: colors.background, gap: 4 },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  summaryMeta: { fontSize: 13, color: colors.textMuted },
  close: { position: 'absolute', top: 48, right: 16, zIndex: 2, padding: 8 },
});
