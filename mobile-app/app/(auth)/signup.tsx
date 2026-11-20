import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { AppInput } from '@/components/common/AppInput';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { BrandMark, CampusBanner } from '@/components/layout/SplashBrand';
import { colors } from '@/constants/theme';
import { friendlyAuthError, registerStudent } from '@/services/auth.service';
import { validateEmail, validatePassword } from '@/utils/validation';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    setError('');
    if (!name.trim()) return setError('Enter your full name.');
    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    setBusy(true);
    try {
      await registerStudent({ displayName: name, email, password });
      setSubmitted(true);
    } catch (cause) {
      setError(friendlyAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <CampusBanner height={170} />
          <View style={styles.content}>
            <View style={styles.brand}><BrandMark size={76} /></View>
            {submitted ? (
              <>
                <Text accessibilityRole="header" style={styles.title}>Registration received</Text>
                <Text style={styles.subtitle}>Sign-in will be enabled after an administrator approves your student account.</Text>
                <AppButton title="Back to sign in" onPress={() => router.replace('/login')} />
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.title}>Student registration</Text>
                <Text style={styles.subtitle}>Create a Firebase account and request access</Text>
                <View style={styles.form}>
                  {error ? <ErrorBanner message={error} /> : null}
                  <AppInput icon="person-outline" placeholder="Full name" accessibilityLabel="Full name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
                  <AppInput icon="mail-outline" placeholder="Email address" accessibilityLabel="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
                  <AppInput icon="lock-closed-outline" placeholder="Create password" accessibilityLabel="Create password" value={password} onChangeText={setPassword} secure autoComplete="new-password" textContentType="newPassword" />
                  <AppButton title="Request student access" onPress={submit} loading={busy} disabled={busy} />
                  <Link href="/login" asChild><Pressable accessibilityRole="link" style={styles.signupLink}><Text style={styles.signupText}>Already registered? Sign in</Text></Pressable></Link>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, padding: 24, paddingTop: 0, gap: 8 },
  brand: { alignSelf: 'center', marginTop: -38, marginBottom: 8, padding: 4, borderRadius: 999, backgroundColor: colors.surface },
  title: { fontSize: 25, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 16 },
  form: { gap: 14 },
  signupLink: { alignSelf: 'center', padding: 8 },
  signupText: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
});
