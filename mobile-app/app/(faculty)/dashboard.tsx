import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/common/AppButton';
import { Avatar } from '@/components/common/Avatar';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { GradientCard } from '@/components/common/Visuals';
import { AppHeader } from '@/components/layout/AppHeader';
import { ControlCodeForm } from '@/components/recording/ControlCodeForm';
import { MountStatusCard } from '@/components/recording/MountStatusCard';
import { RecordingCard } from '@/components/recording/RecordingCard';
import { colors, radius } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useFacultyPairing } from '@/hooks/usePairing';
import { useRecordings } from '@/hooks/useRecordings';

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

type IconName = ComponentProps<typeof Ionicons>['name'];
const QUICK: { icon: IconName; label: string; href: Href; bg: string; fg: string }[] = [
  { icon: 'videocam', label: 'Lectures', href: '/recordings', bg: '#EDE9FE', fg: '#6D28D9' },
  { icon: 'library', label: 'Subjects', href: '/subjects', bg: '#DBEAFE', fg: '#2563EB' },
  { icon: 'phone-portrait', label: 'Recorder', href: '/devices', bg: '#DCFCE7', fg: '#16A34A' },
  { icon: 'person', label: 'Profile', href: '/profile', bg: '#FEF3C7', fg: '#D97706' },
];

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
        <GradientCard style={{ gap: 16 }}>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatar}><Avatar name={user.displayName} uri={user.photoURL} size={50} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>INSTRUCTOR DASHBOARD</Text>
              <Text style={styles.heroName} numberOfLines={1}>{user.displayName}</Text>
              <Text style={styles.heroMeta}>{user.facultyId ? `ID ${user.facultyId}` : 'Faculty'}{pairing ? ' · Recorder connected' : ''}</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <HeroStat value={recordings.length} label="Lectures" />
            <HeroStat value={today.items.length} label="Today" />
            <HeroStat value={today.uploaded} label="Uploaded" />
            <HeroStat value={today.pending} label="Pending" />
          </View>
        </GradientCard>

        <View style={styles.quick}>
          {QUICK.map((q) => (
            <Pressable key={q.label} accessibilityRole="button" onPress={() => router.push(q.href)} style={styles.quickItem}>
              <View style={[styles.quickIcon, { backgroundColor: q.bg }]}><Ionicons name={q.icon} size={24} color={q.fg} /></View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </Pressable>
          ))}
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

        {loading && <LoadingView />}

        {!pairing && <ControlCodeForm faculty={user} />}

        <AppButton title="New Lecture" icon="add-circle" onPress={() => router.push('/new-recording')} />

        <MountStatusCard pairing={pairing} online={online} onPress={() => router.push('/devices')} />

        {today.items.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Today’s lectures</Text>
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
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAvatar: { padding: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroEyebrow: { color: '#DDD6FE', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  heroName: { color: colors.white, fontSize: 20, fontWeight: '800' },
  heroMeta: { color: '#E9E3FF', fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroStat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroStatValue: { color: colors.white, fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: '#E9E3FF', fontSize: 11, fontWeight: '600' },
  quick: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '600', color: colors.text },
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
