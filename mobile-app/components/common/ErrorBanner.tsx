import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/constants/theme';

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Ionicons name="alert-circle" size={20} color={colors.red} />
      <Text style={styles.text}>{message}</Text>
      {onRetry && (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.redSoft,
  },
  text: { flex: 1, fontSize: 14, color: '#9B1C1C' },
  retry: { fontSize: 14, fontWeight: '700', color: colors.red },
});
