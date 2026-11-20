import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { GradientCard } from '@/components/common/Visuals';
import { ControlCodeCard } from '@/components/recording/ControlCodeCard';
import { colors, radius } from '@/constants/theme';
import { useMount } from '@/context/MountContext';
import { useAuth, useCurrentUser } from '@/hooks/useAuth';
import { useControlCode } from '@/hooks/useControlCode';
import { confirm } from '@/utils/confirm';

const STEPS = [
  'Instructor opens the Finetution instructor app',
  'Taps “Connect recorder” and types this code',
  'This phone switches to the camera, ready to record',
];

/** Recorder app: shown until an instructor takes control of this classroom phone with the 6-digit code. */
export default function PairDeviceScreen() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { pairing, loaded, deviceName } = useMount();
  const { code, secondsLeft, error, rotate } = useControlCode(user, deviceName, loaded && !pairing);

  if (!loaded) return <LoadingView dark message="Connecting…" />;
  if (pairing) return <Redirect href="/camera-preview" />;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <GradientCard style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="phone-portrait" size={34} color={colors.white} /></View>
          <Text style={styles.heroEyebrow}>FINETUTION RECORDER</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>Pair Your Device</Text>
          <Text style={styles.heroBody}>{user.classroomName ? `${user.classroomName} · classroom recorder` : 'Classroom recorder'}</Text>
        </GradientCard>

        {!user.classroomName && (
          <Text style={styles.warn}>No classroom is locked to this phone yet. An admin can set one in the Admin CMS → User Manager.</Text>
        )}

        <ControlCodeCard code={code} secondsLeft={secondsLeft} light />
        {error && <ErrorBanner message={error} onRetry={rotate} />}

        <View style={styles.status}>
          <View style={styles.pulse} />
          <Text style={styles.statusText}>Waiting for an instructor to connect…</Text>
        </View>

        <View style={styles.card}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={styles.stepNo}><Text style={styles.stepNoText}>{index + 1}</Text></View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.device]}>
          <Ionicons name="hardware-chip-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.deviceName}>{deviceName}</Text>
            <Text style={styles.deviceMeta}>{user.email}</Text>
          </View>
        </View>

        <AppButton title="Upload queue" variant="secondary" icon="cloud-upload-outline" onPress={() => router.push('/queue')} />
        <AppButton
          title="Sign out"
          variant="ghost"
          onPress={async () => {
            if (await confirm('Sign out?', 'This phone will stop acting as a classroom recorder.', 'Sign out')) await signOut();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 26 },
  heroIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  heroEyebrow: { color: '#DDD6FE', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800' },
  heroBody: { color: '#E9E3FF', fontSize: 13 },
  warn: { color: colors.amber, backgroundColor: colors.amberSoft, padding: 12, borderRadius: radius.md, fontSize: 13, lineHeight: 19 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primarySoft },
  pulse: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  statusText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  card: { padding: 16, gap: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNo: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNoText: { color: colors.primary, fontWeight: '800' },
  stepText: { flex: 1, color: colors.text, fontSize: 14 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  deviceMeta: { color: colors.textMuted, fontSize: 12 },
});
