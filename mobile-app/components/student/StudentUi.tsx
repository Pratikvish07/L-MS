import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sColors, sRadius, sShadow } from '@/constants/studentTheme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { GradientCard, ProgressRing } from '@/components/common/Visuals';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ percent, color = sColors.primary, height = 6 }: { percent: number; color?: string; height?: number }) {
  return <View style={[styles.track, { height, borderRadius: height / 2 }]}><View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} /></View>;
}

export function IconCircle({ icon, bg = sColors.soft, fg = sColors.primary, size = 46 }: { icon: IconName; bg?: string; fg?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={size * 0.5} color={fg} /></View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={studentStyles.sectionTitle}>{title}</Text>
      {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'outline' | 'ghost';
export function StudentButton({ title, icon, onPress, loading, disabled, variant = 'primary', small }: { title: string; icon?: IconName; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: ButtonVariant; small?: boolean }) {
  const palette = { primary: [sColors.primary, sColors.white, sColors.primary], soft: [sColors.soft, sColors.primary, sColors.soft], outline: [sColors.surface, sColors.text, sColors.border], ghost: ['transparent', sColors.primary, 'transparent'] }[variant];
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: palette[0], borderColor: palette[2] }, (disabled || pressed) && { opacity: disabled ? 0.5 : 0.85 }]}>
      {loading ? <ActivityIndicator color={palette[1]} /> : <>{icon && <Ionicons name={icon} size={small ? 15 : 18} color={palette[1]} />}<Text style={[styles.buttonText, small && { fontSize: 13 }, { color: palette[1] }]}>{title}</Text></>}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <IconCircle icon={icon} size={56} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {children}
    </View>
  );
}

export function Chip({ label, tone = 'gray', icon }: { label: string; tone?: 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple'; icon?: IconName }) {
  const palette = { green: [sColors.greenSoft, sColors.green], blue: [sColors.blueSoft, sColors.blue], amber: [sColors.amberSoft, sColors.amber], red: [sColors.redSoft, sColors.red], gray: [sColors.background, sColors.muted], purple: [sColors.soft, sColors.primary] }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: palette[0] }]}>
      {icon && <Ionicons name={icon} size={12} color={palette[1]} />}
      <Text style={[styles.chipText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

/** Pill tabs, like "All Courses / In Progress / Completed". */
export function FilterChips<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.filters}>
      {options.map(([key, label]) => (
        <Pressable key={key || 'all'} accessibilityRole="tab" accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={[styles.filter, value === key && styles.filterActive]}>
          <Text style={[styles.filterText, value === key && styles.filterTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function LecturePlayer({ uri, title, onClose }: { uri: string; title: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (videoPlayer) => videoPlayer.play());
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.playerScreen}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={28} color={sColors.white} /></Pressable>
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        <Text style={styles.playerTitle}>{title}</Text>
      </View>
    </Modal>
  );
}

export const studentStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sColors.background },
  content: { padding: 18, gap: 16, paddingBottom: 40 },
  sectionTitle: { color: sColors.text, fontSize: 17, fontWeight: '800' },
  title: { color: sColors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: sColors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

const styles = StyleSheet.create({
  card: { padding: 16, gap: 10, backgroundColor: sColors.surface, borderRadius: sRadius.lg, ...sShadow },
  track: { width: '100%', backgroundColor: sColors.soft, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionAction: { color: sColors.primary, fontSize: 13, fontWeight: '700' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, paddingHorizontal: 18, borderRadius: sRadius.md, borderWidth: 1 },
  buttonSmall: { minHeight: 36, paddingHorizontal: 12, borderRadius: sRadius.sm },
  buttonText: { fontSize: 15, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, padding: 28, borderRadius: sRadius.lg, backgroundColor: sColors.surface, ...sShadow },
  emptyTitle: { color: sColors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: sColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: sRadius.pill },
  chipText: { fontSize: 11, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: sRadius.pill, backgroundColor: sColors.soft },
  filter: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: sRadius.pill },
  filterActive: { backgroundColor: sColors.primary },
  filterText: { fontSize: 13, color: sColors.primary, fontWeight: '700' },
  filterTextActive: { color: sColors.white },
  playerScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  closeButton: { position: 'absolute', top: 48, right: 18, zIndex: 2, padding: 8 },
  playerTitle: { color: sColors.white, fontSize: 16, fontWeight: '700', padding: 18 },
});

/** Light page header for student screens (title, optional back and right action). */
export function StudentHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: { icon: IconName; label: string; onPress: () => void } }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[headerStyles.header, { paddingTop: insets.top + 10 }]}>
      {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={headerStyles.btn}><Ionicons name="chevron-back" size={22} color={sColors.text} /></Pressable>}
      <Text accessibilityRole="header" style={headerStyles.title} numberOfLines={1}>{title}</Text>
      {right && <Pressable accessibilityRole="button" accessibilityLabel={right.label} onPress={right.onPress} style={headerStyles.btn}><Ionicons name={right.icon} size={20} color={sColors.text} /></Pressable>}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 10, backgroundColor: sColors.background },
  title: { flex: 1, color: sColors.text, fontSize: 22, fontWeight: '800' },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: sColors.surface, alignItems: 'center', justifyContent: 'center' },
});
