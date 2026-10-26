import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { Avatar } from '@/components/common/Avatar';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { ControlCodeForm } from '@/components/recording/ControlCodeForm';
import { MountStatusCard } from '@/components/recording/MountStatusCard';
import { RecordingCard } from '@/components/recording/RecordingCard';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useFacultyPairing } from '@/hooks/usePairing';
import { useRecordings } from '@/hooks/useRecordings';

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const user = useCurrentUser();
  const { recordings, today, loading, error } = useRecordings(user.uid);
  const { pairing, online } = useFacultyPairing(user.uid);

  const active = recordings.find((r) => ['ready', 'recording', 'uploading'].includes(r.status) && r.mountUid === pairing?.mountUid);

  return (
    <View style={styles.screen}>
      <AppHeader
        title="Rayat Bahra University"
        left={{ icon: 'menu', label: 'Open profile', onPress: () => router.push('/profile') }}
        right={{ icon: 'notifications-outline', label: 'Recent recordings', onPress: () => router.push('/recordings') }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <Avatar name={user.displayName} uri={user.photoURL} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.displayName}</Text>
            <Text style={styles.role}>Faculty{user.subject ? ` • ${user.subject}` : ''}</Text>
          </View>
        </View>

        {error && <ErrorBanner message={error} />}

        {active && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Active session: ${active.topic}. Open controls.`}
            onPress={() => router.push({ pathname: '/recording-details/[id]', params: { id: active.id } })}
            style={styles.activeBanner}
          >
            <Ionicons name={active.status === 'recording' ? 'radio-button-on' : 'time-outline'} size={20} color={colors.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>
                {active.status === 'recording' ? 'Recording in progress' : active.status === 'uploading' ? 'Uploading' : 'Ready to record'}
              </Text>
              <Text numberOfLines={1} style={styles.activeMeta}>
                {active.topic} · {active.classroomName}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Recordings</Text>
          {loading ? (
            <LoadingView />
          ) : (
            <View style={styles.stats}>
              <Stat value={today.uploaded} label="Uploaded" color={colors.primary} />
              <Stat value={today.uploading} label="Uploading" color={colors.blue} />
              <Stat value={today.pending} label="Pending" color={colors.red} />
            </View>
          )}
        </View>

        {!pairing && <ControlCodeForm faculty={user} />}

        <AppButton title="New Recording" icon="videocam" onPress={() => router.push('/new-recording')} />
        <AppButton title="View Recordings" icon="list" variant="secondary" onPress={() => router.push('/recordings')} />

        <MountStatusCard pairing={pairing} online={online} onPress={() => router.push('/devices')} />

        {today.items.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Today</Text>
            {today.items.slice(0, 5).map((r) => (
              <RecordingCard
                key={r.id}
                recording={r}
                onPress={() => router.push({ pathname: '/recording-details/[id]', params: { id: r.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  role: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  card: {
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textMuted },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.redSoft,
  },
  activeTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  activeMeta: { fontSize: 12, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
});
