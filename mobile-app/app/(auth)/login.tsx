import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { AppInput } from '@/components/common/AppInput';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { BrandMark, CampusBanner, INSTITUTION_NAME } from '@/components/layout/SplashBrand';
import { colors } from '@/constants/theme';
import { friendlyAuthError, signInWithEmail } from '@/services/auth.service';
import { validateEmail, validatePassword } from '@/utils/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'email' | null>(null);

  const handleSignIn = async () => {
    const nextErrors = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(nextErrors);
    setFormError(null);
    if (nextErrors.email || nextErrors.password) return;

    setBusy('email');
    try {
      await signInWithEmail(email, password);
      // AuthContext picks up the session and the router redirects by role.
    } catch (error) {
      setFormError(friendlyAuthError(error));
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <CampusBanner height={190} />
          <View style={styles.content}>
            <View style={styles.brand}>
              <BrandMark size={84} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              Welcome Back
            </Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.form}>
              {formError && <ErrorBanner message={formError} />}
              <AppInput
                icon="mail-outline"
                placeholder="Email address"
                accessibilityLabel="Email address"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
              <AppInput
                icon="lock-closed-outline"
                placeholder="Password"
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secure
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSignIn}
              />
              <AppButton title="Sign In" onPress={handleSignIn} loading={busy === 'email'} disabled={!!busy} />
            </View>

            <Text style={styles.footnote}>{INSTITUTION_NAME}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, padding: 24, paddingTop: 0, gap: 6 },
  brand: {
    alignItems: 'center',
    marginTop: -42,
    marginBottom: 8,
    alignSelf: 'center',
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  form: { gap: 14 },
  footnote: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
});
