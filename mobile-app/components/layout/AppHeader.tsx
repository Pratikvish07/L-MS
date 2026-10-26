import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { BrandMark } from './SplashBrand';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface HeaderAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

interface AppHeaderProps {
  title: string;
  left?: HeaderAction;
  right?: HeaderAction;
  dark?: boolean;
  /** Extra content shown after the title, e.g. a connection badge. */
  accessory?: ReactNode;
}

function IconButton({ action, color }: { action?: HeaderAction; color: string }) {
  if (!action) return <View style={styles.iconSlot} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      hitSlop={10}
      onPress={action.onPress}
      style={styles.iconSlot}
    >
      <Ionicons name={action.icon} size={24} color={color} />
    </Pressable>
  );
}

/** Green (or dark, on the mount phone) app bar used across screens. */
export function AppHeader({ title, left, right, dark, accessory }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const bg = dark ? colors.dark : colors.primary;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: bg }]}>
      <IconButton action={left} color={colors.white} />
      <View style={[styles.center, dark && { alignItems: 'flex-start' }]}>
        <BrandMark size={28} />
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {accessory}
      </View>
      <IconButton action={right} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  iconSlot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: colors.white },
});
