import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { AppHeader } from '@/components/layout/AppHeader';
import { colors, radius } from '@/constants/theme';
import { useMount } from '@/context/MountContext';
import { useAuth } from '@/hooks/useAuth';
import { availableBytes, listLocalRecordings, removeLocalRecording } from '@/services/local-recordings.service';
import { markFailed } from '@/services/recording.service';
import type { LocalRecording } from '@/types/recording.types';
import { confirm } from '@/utils/confirm';
import { formatDateTime, formatDuration } from '@/utils/date';
import { formatBytes } from '@/utils/file-size';
import { goBack } from '@/utils/navigation';

/** Mount phone settings: pending uploads, storage, pairing and sign-out. */
export default function QueueScreen() {
  const { signOut } = useAuth();
  const { pairing, deviceName, unpairDevice } = useMount();
  const [items, setItems] = useState<LocalRecording[]>([]);

  const refresh = useCallback(() => {
    listLocalRecordings().then((all) => setItems(all.filter((e) => !e.uploaded)));
  }, []);
  useFocusEffect(refresh);

  const deleteLocal = async (item: LocalRecording) => {
    const ok = await confirm(
      'Delete this video?',
      `"${item.metadata.topic}" has NOT been uploaded. Deleting it from this phone loses the lecture permanently.`,
      'Delete permanently',
    );
    if (!ok) return;
    await removeLocalRecording(item.sessionId);
    markFailed(item.sessionId, 'Local video deleted on the mount phone before upload.').catch(() => undefined);
    refresh();
  };

  const handleUnpair = async () => {
    if (await confirm('Unpair this phone?', 'The faculty phone will no longer be able to control it.', 'Unpair')) {
      await unpairDevice();
      router.replace('/pair-device');
    }
  };

  const handleSignOut = async () => {
    const warning = items.length
      ? `${items.length} recording(s) are still waiting to upload. They stay on this phone and upload after the mount account signs in again.`
      : 'This phone will stop acting as a mount device.';
    if (await confirm('Sign out?', warning, 'Sign out')) await signOut();
  };

  return (
    <View style={styles.screen}>
      <AppHeader dark title="Upload Queue" left={{ icon: 'arrow-back', label: 'Back', onPress: () => goBack('/camera-preview') }} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.sessionId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{deviceName}</Text>
            <Text style={styles.meta}>
              {pairing ? `Controlled by ${pairing.facultyName}` : 'No faculty connected'}
              {Platform.OS !== 'web' && ` · ${formatBytes(availableBytes(), 1)} free`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={44} color={colors.primary} />
            <Text style={styles.emptyText}>
              {Platform.OS === 'web'
                ? 'Recordings are kept on the Android tripod phone. Open this screen there to see pending uploads.'
                : 'All recordings are uploaded.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.metadata.topic}</Text>
            <Text style={styles.meta}>
              {item.metadata.className} · {item.metadata.classroomName} · {formatDuration(item.durationSeconds)} ·{' '}
              {formatBytes(item.fileSizeBytes, 1)}
            </Text>
            <Text style={styles.meta}>Saved {formatDateTime(item.savedAt)}</Text>
            {item.lastError ? <Text style={styles.error}>Last error: {item.lastError}</Text> : null}
            <View style={styles.actions}>
              <AppButton
                title="Upload"
                icon="cloud-upload-outline"
                onPress={() => router.push({ pathname: '/upload', params: { sessionId: item.sessionId } })}
                style={{ flex: 1 }}
              />
              <AppButton title="Delete" variant="danger" onPress={() => deleteLocal(item)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 10, marginTop: 12 }}>
            {pairing && <AppButton title="Unpair device" variant="dark" icon="unlink-outline" onPress={handleUnpair} />}
            <AppButton title="Sign out" variant="dark" icon="log-out-outline" onPress={handleSignOut} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { padding: 16, gap: 12 },
  card: { padding: 14, gap: 6, borderRadius: radius.lg, backgroundColor: colors.darkSurface },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  meta: { fontSize: 13, color: '#9CA3AF' },
  error: { fontSize: 13, color: '#F87171' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyText: { fontSize: 14, color: '#D1D5DB' },
});
