import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';
import { config } from '@/constants/config';

interface ControlCodeCardProps {
  code: string | null;
  secondsLeft: number;
  compact?: boolean;
  /** Light card for the pairing screen; dark (default) over the camera preview. */
  light?: boolean;
}

/** Mount phone: the rotating 6-digit code faculty type to take control, shown as one box per digit. */
export function ControlCodeCard({ code, secondsLeft, compact, light }: ControlCodeCardProps) {
  const fraction = Math.min(1, secondsLeft / config.pairingCodeTtlSeconds);
  const urgent = secondsLeft <= 5;
  const box = compact ? 34 : 44;

  return (
    <View
      style={[styles.card, light ? styles.cardLight : styles.cardDark, compact && styles.compact]}
      accessible
      accessibilityLabel={code ? `Instructor control code ${code.split('').join(' ')}, changes in ${secondsLeft} seconds` : 'Generating code'}
    >
      <Text style={[styles.label, light && { color: colors.textMuted }]}>Instructor control code</Text>
      {code ? (
        <View style={styles.digits}>
          {code.split('').map((digit, index) => (
            <View key={index} style={[styles.digit, { width: box, height: box * 1.2 }, light ? styles.digitLight : styles.digitDark, index === 3 && { marginLeft: 8 }]}>
              <Text style={[styles.digitText, { fontSize: box * 0.62 }, light ? { color: colors.primaryDark } : { color: colors.white }]}>{digit}</Text>
            </View>
          ))}
        </View>
      ) : (
        <ActivityIndicator color={light ? colors.primary : colors.white} style={{ marginVertical: 12 }} />
      )}
      <View style={[styles.track, { backgroundColor: light ? colors.primarySoft : colors.darkBorder }]}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: urgent ? colors.amber : colors.primary }]} />
      </View>
      <Text style={[styles.hint, light && { color: colors.textMuted }, urgent && { color: colors.amber }]}>New code in {secondsLeft}s · enter it in the instructor app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 18, paddingHorizontal: 16, borderRadius: radius.lg, alignItems: 'center', gap: 12, borderWidth: 1 },
  cardDark: { backgroundColor: colors.darkSurface, borderColor: colors.darkBorder },
  cardLight: { backgroundColor: colors.surface, borderColor: colors.border },
  compact: { paddingVertical: 12, gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#A79BC7', textTransform: 'uppercase', letterSpacing: 1 },
  digits: { flexDirection: 'row', gap: 6 },
  digit: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  digitLight: { backgroundColor: colors.primarySoft, borderColor: '#C4B5FD' },
  digitDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.darkBorder },
  digitText: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { alignSelf: 'stretch', height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
  hint: { fontSize: 12, color: '#A79BC7' },
});
