import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { colors, radius } from '@/constants/theme';
import { claimPairingCode } from '@/services/pairing.service';
import type { AppUser } from '@/types/auth.types';
import type { Pairing } from '@/types/pairing.types';
import { isValidPairingCode, normalizePairingCode, PAIRING_CODE_LENGTH } from '@/utils/validation';

interface ControlCodeFormProps {
  faculty: AppUser;
  title?: string;
  onClaimed?: (pairing: Pairing) => void;
}

/** Faculty phone: type the 6-digit code shown on the classroom phone to control it. */
export function ControlCodeForm({ faculty, title = 'Connect to classroom phone', onClaimed }: ControlCodeFormProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (value = code) => {
    if (!isValidPairingCode(value)) {
      setError(`Enter the ${PAIRING_CODE_LENGTH}-digit code shown on the classroom phone.`);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const pairing = await claimPairingCode(faculty, value);
      setCode('');
      setSuccess(`You now control ${pairing.deviceName}.`);
      onClaimed?.(pairing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onChange = (text: string) => {
    const next = normalizePairingCode(text);
    setCode(next);
    setError(null);
    // Codes change every 30 s, so submit as soon as all digits are in.
    if (next.length === PAIRING_CODE_LENGTH && !busy) submit(next);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="keypad-outline" size={22} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.help}>
        Type the {PAIRING_CODE_LENGTH}-digit code on the tripod phone. It changes every 30 seconds.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={`${PAIRING_CODE_LENGTH}-digit control code`}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={PAIRING_CODE_LENGTH}
          placeholder="••••••"
          placeholderTextColor="#D1D5DB"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          editable={!busy}
          style={styles.input}
        />
        {busy && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      </View>
      {error && <ErrorBanner message={error} />}
      {success && (
        <View style={styles.success} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}
      <AppButton title="Connect" icon="link-outline" onPress={() => submit()} loading={busy} disabled={code.length !== PAIRING_CODE_LENGTH} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  help: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  inputRow: { justifyContent: 'center' },
  input: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 14,
    textAlign: 'center',
    color: colors.text,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontVariant: ['tabular-nums'],
  },
  spinner: { position: 'absolute', right: 16 },
  success: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText: { fontSize: 14, color: colors.primaryDark, fontWeight: '600' },
});
