import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export function initials(name: string) {
  return name
    .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({ name, uri, size = 52 }: { name: string; uri?: string; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image accessibilityIgnoresInvertColors source={{ uri }} style={style} />;
  return (
    <View accessible={false} style={[styles.fallback, style]}>
      <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  text: { fontWeight: '700', color: colors.primaryDark },
});
