import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { config } from '@/constants/config';

interface ControlCodeCardProps {
  code: string | null;
  secondsLeft: number;
  compact?: boolean;
}

/** Mount phone: the rotating 6-digit code faculty type to take control. */
export function ControlCodeCard({ code, secondsLeft, compact }: ControlCodeCardProps) {
  const fraction = Math.min(1, secondsLeft / config.pairingCodeTtlSeconds);

  return (
    <View
      style={[styles.card, compact && styles.compact]}
      accessible
      accessibilityLabel={code ? `Faculty control code ${code.split('').join(' ')}, changes in ${secondsLeft} seconds` : 'Generating code'}
    >
      <Text style={styles.label}>Faculty control code</Text>
      {code ? (
        <Text style={[styles.code, compact && { fontSize: 32 }]}>
          {code.slice(0, 3)} {code.slice(3)}
        </Text>
      ) : (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
      )}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: secondsLeft <= 5 ? colors.amber : colors.primary }]} />
      </View>
      <Text style={styles.hint}>New code in {secondsLeft}s · enter it on the faculty phone</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.darkSurface,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    alignItems: 'center',
    gap: 8,
  },
  compact: { paddingVertical: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 44, fontWeight: '800', color: colors.white, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  track: { alignSelf: 'stretch', height: 4, borderRadius: 2, backgroundColor: colors.darkBorder, overflow: 'hidden' },
  fill: { height: '100%' },
  hint: { fontSize: 12, color: '#9CA3AF' },
});
