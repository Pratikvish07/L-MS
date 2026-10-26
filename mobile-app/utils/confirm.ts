import { Alert } from 'react-native';
import { Platform } from 'react-native';

/** Native confirmation dialog for destructive actions. Resolves true on confirm. */
export function confirm(title: string, message: string, confirmLabel = 'Confirm', destructive = true): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}\n\nSelect OK to ${confirmLabel.toLowerCase()}.`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
