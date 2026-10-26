import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatBytes } from '@/utils/file-size';

interface UploadProgressProps {
  /** 0–1 */
  fraction: number;
  transferredBytes?: number;
  totalBytes?: number;
  label?: string;
}

export function UploadProgress({ fraction, transferredBytes, totalBytes, label = 'Uploading video…' }: UploadProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      accessibilityLabel={label}
      style={{ gap: 8 }}
    >
      <View style={styles.row}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      {totalBytes ? (
        <Text style={styles.bytes}>
          {formatBytes(transferredBytes ?? 0)} of {formatBytes(totalBytes)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.primary },
  percent: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  bytes: { fontSize: 13, color: colors.textMuted },
});
