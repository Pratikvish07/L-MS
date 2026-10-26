import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export function LoadingView({ message, dark }: { message?: string; dark?: boolean }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
      style={[styles.container, dark && { backgroundColor: colors.dark }]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message && <Text style={[styles.text, dark && { color: '#D1D5DB' }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.background,
  },
  text: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
});
