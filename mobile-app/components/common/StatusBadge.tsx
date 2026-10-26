import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { RecordingStatus } from '@/types/recording.types';

const STATUS: Record<RecordingStatus, { label: string; fg: string; bg: string }> = {
  ready: { label: 'Ready', fg: colors.textMuted, bg: '#F3F4F6' },
  recording: { label: 'Recording', fg: colors.red, bg: colors.redSoft },
  saved_locally: { label: 'Pending upload', fg: colors.amber, bg: colors.amberSoft },
  uploading: { label: 'Uploading', fg: colors.blue, bg: colors.blueSoft },
  uploaded: { label: 'Uploaded', fg: colors.primaryDark, bg: colors.primarySoft },
  published: { label: 'Published', fg: colors.primaryDark, bg: colors.primarySoft },
  failed: { label: 'Failed', fg: colors.red, bg: colors.redSoft },
};

export function StatusBadge({ status, progress }: { status: RecordingStatus; progress?: number }) {
  const s = STATUS[status] ?? STATUS.ready;
  const label = status === 'uploading' && progress ? `${s.label} ${progress}%` : s.label;
  return (
    <View accessibilityLabel={`Status: ${label}`} style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
