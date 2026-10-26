import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AppHeader } from '@/components/layout/AppHeader';
import { RecordingTimer } from '@/components/recording/RecordingTimer';
import { UploadProgress } from '@/components/recording/UploadProgress';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useFacultyPairing } from '@/hooks/usePairing';
import { useRecording } from '@/hooks/useRecording';
import { assignSession, sendCommand } from '@/services/pairing.service';
import { discardReadySession } from '@/services/recording.service';
import { START_COMMAND_MAX_AGE_MS, type CommandType } from '@/types/pairing.types';
import { confirm } from '@/utils/confirm';
import { formatDateTime, formatDuration } from '@/utils/date';
import { formatBytes } from '@/utils/file-size';
import { goBack } from '@/utils/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];

function DetailRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
  );
}

export default function RecordingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { recording, loading, error } = useRecording(id);
  const { pairing, online } = useFacultyPairing(user.uid);
  const [sending, setSending] = useState<CommandType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <LoadingView />;
  if (!recording) {
    return (
      <View style={styles.screen}>
        <AppHeader title="Recording" left={{ icon: 'arrow-back', label: 'Back', onPress: () => goBack('/recordings') }} />
        <View style={{ padding: 16 }}>
          <ErrorBanner message={error ?? 'This recording no longer exists.'} />
        </View>
      </View>
    );
  }

  const isMine = true;
  const mount = isMine ? pairing?.mountStatus : null;
  const command = isMine && pairing?.command?.sessionId === recording.id ? pairing.command : null;
  const acked = !!command && mount?.ackCommandId === command.id;
  const awaitingAck = !!command && !acked && now - command.issuedAt < START_COMMAND_MAX_AGE_MS;
  const noResponse = !!command && !acked && !awaitingAck;
  const rejected = acked && mount?.ackResult === 'rejected' ? mount.ackMessage : null;
  const mountReady = true;
  const mountPaused = isMine && mount?.sessionId === recording.id && mount.state === 'paused';

  const send = async (type: CommandType) => {
    if (!pairing) return;
    if (type === 'retry_upload') {
      router.push({ pathname: '/faculty-upload' as any, params: { sessionId: recording.id } });
      return;
    }
    if (type === 'start') {
      router.push({ pathname: '/faculty-camera' as any, params: { sessionId: recording.id, autoStart: '1' } });
      return;
    }
    if (type === 'stop') {
      const ok = await confirm('Stop recording?', 'The mount phone will stop and save the lecture video.', 'Stop');
      if (!ok) return;
    }
    setSending(type);
    setActionError(null);
    try {
      await sendCommand(user, pairing.mountUid, type, recording.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not reach the mount phone.');
    } finally {
      setSending(null);
    }
  };

  const discard = async () => {
    const ok = await confirm('Discard this lecture?', 'Nothing has been recorded yet. The session will be removed.', 'Discard');
    if (!ok) return;
    try {
      if (pairing && pairing.session?.sessionId === recording.id) await assignSession(pairing.mountUid, null);
      await discardReadySession(recording.id);
      router.replace('/dashboard');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not discard the session.');
    }
  };

  const startedAtMs = recording.startedAt ? Date.parse(recording.startedAt) : null;

  return (
    <View style={styles.screen}>
      <AppHeader title="Recording" left={{ icon: 'arrow-back', label: 'Back', onPress: () => goBack('/recordings') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.topic}>{recording.topic}</Text>
          <View style={styles.badges}>
            <StatusBadge status={recording.status} progress={recording.uploadProgress} />
            {recording.publicationStatus === 'published' && <Text style={styles.published}>Published</Text>}
          </View>

          {recording.status === 'ready' && (
            <>
              <Text style={styles.help}>
                'Faculty camera is ready.'
              </Text>
              <AppButton
                title={awaitingAck ? 'Waiting for mount phone…' : 'Start Recording'}
                icon="radio-button-on"
                onPress={() => send('start')}
                loading={sending === 'start'}
                disabled={!mountReady || awaitingAck}
              />
              <AppButton title="Discard lecture" variant="ghost" onPress={discard} />
            </>
          )}

          {recording.status === 'recording' && (
            <>
              <View style={styles.timerWrap}>
                <RecordingTimer startedAt={startedAtMs} />
                {mountPaused && <Text style={styles.help}>Paused on the mount phone</Text>}
              </View>
              <AppButton
                title={awaitingAck ? 'Waiting for mount phone…' : 'Stop Recording'}
                icon="stop"
                variant="danger"
                onPress={() => send('stop')}
                loading={sending === 'stop'}
                disabled={awaitingAck || !isMine}
              />
            </>
          )}

          {recording.status === 'uploading' && (
            <UploadProgress
              fraction={recording.uploadProgress / 100}
              totalBytes={recording.fileSizeBytes}
              transferredBytes={(recording.fileSizeBytes * recording.uploadProgress) / 100}
            />
          )}

          {(recording.status === 'saved_locally' || recording.status === 'failed') && (
            <>
              {recording.errorMessage ? <ErrorBanner message={recording.errorMessage} /> : null}
              <Text style={styles.help}>The video is saved on this device and waiting to upload.</Text>
              <AppButton
                title="Retry Upload"
                icon="cloud-upload-outline"
                onPress={() => send('retry_upload')}
                loading={sending === 'retry_upload'}
                disabled={awaitingAck}
              />
            </>
          )}

          {(recording.status === 'uploaded' || recording.status === 'published') && (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={styles.successText}>Uploaded {formatDateTime(recording.uploadedAt)}</Text>
            </View>
          )}

          {rejected && <ErrorBanner message={`Mount phone: ${rejected}`} />}
          {noResponse && (
            <ErrorBanner message="The mount phone did not acknowledge the last command. Check that it is online, then try again." />
          )}
          {actionError && <ErrorBanner message={actionError} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <DetailRow icon="easel-outline" label="Classroom" value={recording.classroomName} />
          <DetailRow icon="people-outline" label="Class" value={recording.className} />
          {recording.subjectName ? <DetailRow icon="library-outline" label="Subject" value={recording.subjectName} /> : null}
          <DetailRow icon="book-outline" label="Chapter" value={recording.chapter} />
          <DetailRow icon="pricetag-outline" label="Topic" value={recording.topic} />
          <DetailRow icon="calendar-outline" label="Lecture date" value={formatDateTime(recording.recordedAt)} />
          <DetailRow
            icon="time-outline"
            label="Duration"
            value={recording.durationSeconds ? formatDuration(recording.durationSeconds) : ''}
          />
          <DetailRow icon="document-outline" label="File size" value={recording.fileSizeBytes ? formatBytes(recording.fileSizeBytes, 1) : ''} />
          <DetailRow icon="phone-portrait-outline" label="Recording device" value="Faculty device" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topic: { fontSize: 19, fontWeight: '800', color: colors.text },
  badges: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  published: { fontSize: 12, fontWeight: '600', color: colors.primaryDark },
  help: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  timerWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  success: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  successText: { fontSize: 14, color: colors.primaryDark, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  detailLabel: { width: 100, fontSize: 13, color: colors.textMuted },
  detailValue: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
});
