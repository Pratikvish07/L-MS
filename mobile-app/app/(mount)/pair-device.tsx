import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { ControlCodeCard } from '@/components/recording/ControlCodeCard';
import { colors } from '@/constants/theme';
import { useMount } from '@/context/MountContext';
import { useAuth, useCurrentUser } from '@/hooks/useAuth';
import { useControlCode } from '@/hooks/useControlCode';
import { confirm } from '@/utils/confirm';

/** Shown until the first faculty member takes control of this classroom phone. */
export default function PairDeviceScreen() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { pairing, loaded, deviceName } = useMount();
  const { code, secondsLeft, error, rotate } = useControlCode(user, deviceName, loaded && !pairing);

  if (!loaded) return <LoadingView dark message="Connecting…" />;
  if (pairing) return <Redirect href="/camera-preview" />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Ionicons name="keypad-outline" size={32} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {user.classroomName ? `${user.classroomName} recorder` : 'Classroom recorder'}
        </Text>
        {!user.classroomName && (
          <Text style={styles.body}>No room is locked to this tripod yet. An admin can set one in the CMS (Users).</Text>
        )}
        <Text style={styles.body}>
          Faculty: sign in on your phone and enter this code to control recording. The code changes every 30 seconds and
          works once.
        </Text>

        <ControlCodeCard code={code} secondsLeft={secondsLeft} />

        {error && <ErrorBanner message={error} onRetry={rotate} />}

        <AppButton title="Upload queue" variant="ghost" icon="cloud-upload-outline" onPress={() => router.push('/queue')} />
        <AppButton
          title="Sign out"
          variant="ghost"
          onPress={async () => {
            if (await confirm('Sign out?', 'This phone will stop acting as a classroom recorder.', 'Sign out')) await signOut();
          }}
        />
        <Text style={styles.device}>
          {deviceName} · {user.email}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark },
  content: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(14,159,110,0.15)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.white, textAlign: 'center' },
  body: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  device: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 8 },
});
