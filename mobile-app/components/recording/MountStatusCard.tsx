import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import type { MountState, Pairing } from '@/types/pairing.types';
import { formatBytes } from '@/utils/file-size';

const STATE_LABEL: Record<MountState, string> = {
  offline: 'Offline',
  idle: 'Connected',
  preview: 'Camera ready',
  recording: 'Recording',
  paused: 'Paused',
  saving: 'Saving video',
  uploading: 'Uploading',
};

interface MountStatusCardProps {
  pairing: Pairing | null;
  online: boolean;
  onPress: () => void;
}

export function MountStatusCard({ pairing, online, onPress }: MountStatusCardProps) {
  const state: MountState = online ? (pairing?.mountStatus?.state ?? 'idle') : 'offline';
  const label = pairing ? STATE_LABEL[state] : 'Not connected';
  const dotColor = !pairing ? colors.textMuted : online ? colors.primary : colors.red;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mount device: ${pairing?.deviceName ?? 'none'}, ${label}`}
      accessibilityHint={pairing ? 'Opens device settings' : 'Connect with the classroom phone code'}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.icon}>
        <Ionicons name="phone-portrait-outline" size={26} color={colors.text} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.title}>
          {pairing?.mountStatus?.classroomName ? `${pairing.mountStatus.classroomName} · ` : ''}
          {pairing?.deviceName ?? 'Classroom phone'}
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.status}>{label}</Text>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        </View>
        {online && pairing?.mountStatus?.freeBytes ? (
          <Text style={styles.status}>{formatBytes(pairing.mountStatus.freeBytes)} free</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  status: { fontSize: 13, color: colors.textMuted },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
