import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { SplashBrand } from '@/components/layout/SplashBrand';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

const MIN_SPLASH_MS = 900;

/** Splash screen, then redirect based on sign-in state and role. */
export default function Index() {
  const { status, user, error, signOut } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'loading' || !minElapsed) return <SplashBrand />;
  if (status === 'signedOut') return <Redirect href="/login" />;

  if (status === 'unauthorized') {
    return (
      <View style={styles.center}>
        <Text accessibilityRole="header" style={styles.title}>
          Access not granted
        </Text>
        <Text style={styles.body}>{error}</Text>
        <AppButton title="Sign out" variant="outline" onPress={signOut} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (user?.role === 'faculty') return <Redirect href="/dashboard" />;
  if (user?.role === 'mount') return <Redirect href="/pair-device" />;
  if (user?.role === 'student') return <Redirect href="/portfolio" />;

  // Administrators use the web Admin CMS.
  return (
    <View style={styles.center}>
      <Text accessibilityRole="header" style={styles.title}>
        Administrator account
      </Text>
      <Text style={styles.body}>
        Recordings, faculty, classrooms and publishing are managed in the LMS Admin CMS on the web. Sign in there with this
        account.
      </Text>
      <AppButton title="Sign out" variant="outline" onPress={signOut} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: colors.surface },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
