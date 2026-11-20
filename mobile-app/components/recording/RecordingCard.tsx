import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/common/StatusBadge';
import { colors, radius } from '@/constants/theme';
import { UPLOADED_STATUSES, type Recording } from '@/types/recording.types';
import { formatDateTime, formatDuration } from '@/utils/date';

export function RecordingCard({ recording, onPress }: { recording: Recording; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recording.topic}, ${recording.subjectName}, ${UPLOADED_STATUSES.includes(recording.status) ? 'uploaded' : 'not uploaded'}`}
      accessibilityHint="Opens recording details"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumb}>
        <Ionicons name="videocam" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={styles.title}>
          {recording.lectureNumber ? `${recording.lectureNumber}. ` : ''}{recording.topic}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[recording.courseName, recording.batchName, recording.subjectName].filter(Boolean).join(' · ') || recording.className}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.meta}>{formatDateTime(recording.recordedAt)}</Text>
          {recording.durationSeconds > 0 && <Text style={styles.meta}>· {formatDuration(recording.durationSeconds)}</Text>}
        </View>
        <StatusBadge status={recording.status} progress={recording.uploadProgress} />
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  footer: { flexDirection: 'row', gap: 4 },
});
