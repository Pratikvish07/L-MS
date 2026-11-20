import { useState } from 'react';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { AppInput } from '@/components/common/AppInput';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { GradientCard } from '@/components/common/Visuals';
import { BrandMark, INSTITUTION_NAME } from '@/components/layout/SplashBrand';
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
          <GradientCard style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.brand}><BrandMark size={44} /></View>
              <Text style={styles.brandName}>Finetution</Text>
            </View>
            <Text style={styles.heroTitle}>Learn, teach and record in one app</Text>
            <View style={styles.roles}>
              {([['school', 'Students'], ['easel', 'Instructors'], ['videocam', 'Recorders']] as const).map(([icon, label]) => (
                <View key={label} style={styles.role}><Ionicons name={icon} size={14} color={colors.white} /><Text style={styles.roleText}>{label}</Text></View>
              ))}
            </View>
          </GradientCard>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>
              Welcome Back 👋
            </Text>
            <Text style={styles.subtitle}>Sign in to continue. Your role opens the right app automatically.</Text>

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
              <Link href="/signup" asChild>
                <Pressable accessibilityRole="link" style={styles.signupLink}>
                  <Text style={styles.signupText}>Register as a student</Text>
                </Pressable>
              </Link>
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
  hero: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: 56, paddingBottom: 28, gap: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { padding: 3, borderRadius: 999, backgroundColor: colors.white },
  brandName: { color: colors.white, fontSize: 22, fontWeight: '800' },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', lineHeight: 31 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  roleText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  content: { flex: 1, padding: 24, gap: 6 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 18, lineHeight: 20 },
  form: { gap: 14 },
  signupLink: { alignSelf: 'center', padding: 8 },
  signupText: { color: colors.primaryDark, fontSize: 14, fontWeight: '600' },
  footnote: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
});
