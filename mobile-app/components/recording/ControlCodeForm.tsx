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
export function ControlCodeForm({ faculty, title = 'Connect recorder', onClaimed }: ControlCodeFormProps) {
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
        Type the {PAIRING_CODE_LENGTH}-digit code shown on the classroom recorder phone. It changes every 30 seconds.
      </Text>
      <View style={styles.inputRow}>
        {/* Six boxes for display; one transparent input on top receives typing, paste and one-time-code autofill. */}
        <View style={styles.boxes} pointerEvents="none">
          {Array.from({ length: PAIRING_CODE_LENGTH }, (_, index) => (
            <View key={index} style={[styles.box, index === code.length && !busy && styles.boxActive, index < code.length && styles.boxFilled]}>
              <Text style={styles.boxText}>{code[index] ?? ''}</Text>
            </View>
          ))}
        </View>
        <TextInput
          accessibilityLabel={`${PAIRING_CODE_LENGTH}-digit control code`}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={PAIRING_CODE_LENGTH}
          caretHidden
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
          <Ionicons name="checkmark-circle" size={18} color={colors.green} />
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
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  box: { width: 44, height: 54, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  boxFilled: { borderColor: '#C4B5FD', backgroundColor: colors.primarySoft },
  boxText: { fontSize: 24, fontWeight: '800', color: colors.primaryDark, fontVariant: ['tabular-nums'] },
  // Invisible but focusable: covers the boxes so a tap anywhere opens the keyboard.
  input: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', fontSize: 1, opacity: 0.02 },
  spinner: { position: 'absolute', right: 16 },
  success: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText: { fontSize: 14, color: colors.green, fontWeight: '600' },
});
