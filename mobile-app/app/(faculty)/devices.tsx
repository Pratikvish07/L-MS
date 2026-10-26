import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { ControlCodeForm } from '@/components/recording/ControlCodeForm';
import { MountStatusCard } from '@/components/recording/MountStatusCard';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useFacultyPairing } from '@/hooks/usePairing';
import { unpair } from '@/services/pairing.service';
import { confirm } from '@/utils/confirm';
import { formatDateTime } from '@/utils/date';

export default function DevicesScreen() {
  const user = useCurrentUser();
  const { pairing, online, loading } = useFacultyPairing(user.uid);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRelease = async () => {
    if (!pairing) return;
    const state = pairing.mountStatus?.state;
    if (state === 'recording' || state === 'paused' || state === 'saving') {
      setError('The classroom phone is recording. Stop the recording before releasing control.');
      return;
    }
    const ok = await confirm(
      'Release control?',
      `You will no longer control ${pairing.deviceName}. Another faculty member can connect with the next code.`,
      'Release',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await unpair(pairing.mountUid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not release control.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <View style={styles.screen}>
      <AppHeader title="Devices" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error && <ErrorBanner message={error} />}

        {pairing && (
          <>
            <MountStatusCard pairing={pairing} online={online} onPress={() => undefined} />
            <View style={styles.card}>
              <Text style={styles.row}>Connected {formatDateTime(pairing.pairedAt)}</Text>
              {pairing.mountStatus?.lastSeen ? (
                <Text style={styles.row}>Last seen {formatDateTime(new Date(pairing.mountStatus.lastSeen).toISOString())}</Text>
              ) : null}
              <Text style={styles.row}>Lecture assigned: {pairing.session ? pairing.session.metadata.topic : 'none'}</Text>
            </View>
            <AppButton title="Release control" icon="unlink-outline" variant="danger" onPress={handleRelease} loading={busy} />
          </>
        )}

        <ControlCodeForm
          faculty={user}
          title={pairing ? 'Switch to another classroom phone' : 'Connect to classroom phone'}
          onClaimed={() => setError(null)}
        />
        <Text style={styles.note}>
          Several faculty can share one classroom phone. Whoever enters the current code controls it, unless a lecture is
          being recorded.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { fontSize: 14, color: colors.text },
  note: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
