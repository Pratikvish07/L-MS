import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { AppButton } from '@/components/common/AppButton';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { AppHeader } from '@/components/layout/AppHeader';
import { colors, radius } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getVideosFromApi, type ApiVideo } from '@/services/video-upload.service';
import type { Recording } from '@/types/recording.types';
import { formatBytes } from '@/utils/file-size';
import { formatDuration } from '@/utils/date';

function LecturePlayer({ uri, title, onClose }: { uri: string; title: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (videoPlayer) => videoPlayer.play());
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.playerScreen}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={28} color={colors.white} /></Pressable>
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        <Text style={styles.playerTitle}>{title}</Text>
      </View>
    </Modal>
  );
}

export default function StudentPortfolioScreen() {
  const { status, user, signOut } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Recording | null>(null);

  useEffect(() => {
    if (status !== 'signedIn' || user?.role !== 'student') return;
    let cancelled = false;
    getVideosFromApi().then((videos) => {
      if (cancelled) return;
      setRecordings(videos.map((video: ApiVideo) => ({ id: String(video.id), sessionId: String(video.id), topic: video.title, subjectName: '', chapter: '', facultyName: '', recordedAt: video.created_at ?? '', durationSeconds: Number(video.duration ?? 0), fileSizeBytes: Number(video.file_size ?? 0) || 0, partFileIds: [video.video_url ?? video.video_path ?? ''], status: 'published', publicationStatus: 'published', degreeId: user.degreeId ?? '', streamId: user.streamId ?? '', year: user.year ?? 0 } as Recording)));
      setLoading(false);
      setError('');
    }).catch((cause: unknown) => { if (!cancelled) { setError(cause instanceof Error ? cause.message : String(cause)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [status, user]);

  if (status === 'loading') return <LoadingView />;
  if (status !== 'signedIn' || user?.role !== 'student') return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <AppHeader title="Student Portfolio" right={{ icon: 'log-out-outline', label: 'Sign out', onPress: signOut }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.welcome}>
          <View style={styles.welcomeIcon}><Ionicons name="school-outline" size={25} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>LEARNING LIBRARY</Text>
            <Text style={styles.welcomeTitle}>Hello, {user.displayName.split(' ')[0]}</Text>
            <Text style={styles.welcomeMeta}>{[user.degreeId, user.streamId, user.year ? `Year ${user.year}` : ''].filter(Boolean).join(' · ') || 'Published lectures'}</Text>
          </View>
          <Text style={styles.count}>{recordings.length}</Text>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Published lectures</Text>
          <Text style={styles.sectionCount}>{recordings.length} available</Text>
        </View>
        {loading ? <LoadingView message="Loading your lecture library…" /> : (!user.degreeId || !user.streamId || !user.year) ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={32} color={colors.amber} />
            <Text style={styles.emptyTitle}>Academic profile awaiting approval</Text>
            <Text style={styles.emptyText}>An administrator needs to assign your degree, stream, and year before your lecture library is available.</Text>
          </View>
        ) : recordings.length ? recordings.map((recording) => (
          <Pressable key={recording.id} accessibilityRole="button" onPress={() => setSelected(recording)} style={styles.lecture}>
            <View style={styles.playIcon}><Ionicons name="play" size={18} color={colors.primaryDark} /></View>
            <View style={styles.lectureBody}>
              <Text style={styles.lectureTitle} numberOfLines={2}>{recording.topic || recording.subjectName}</Text>
              <Text style={styles.lectureMeta} numberOfLines={1}>{[recording.subjectName, recording.chapter, recording.facultyName].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.lectureFoot}>{recording.recordedAt ? new Date(recording.recordedAt).toLocaleDateString() : 'Date unavailable'} · {formatDuration(recording.durationSeconds)} · {formatBytes(recording.fileSizeBytes, 1)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
          </Pressable>
        )) : (
          <View style={styles.empty}>
            <Ionicons name="library-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No published lectures yet</Text>
            <Text style={styles.emptyText}>New lectures will appear here once your faculty publishes them.</Text>
          </View>
        )}
        <AppButton title="Sign out" icon="log-out-outline" variant="outline" onPress={signOut} />
      </ScrollView>
      {selected && (selected.partFileIds[0]?.startsWith('http') ? <LecturePlayer uri={selected.partFileIds[0]} title={selected.topic} onClose={() => setSelected(null)} /> : <UnavailableVideo onClose={() => setSelected(null)} />)}
    </View>
  );
}

function UnavailableVideo({ onClose }: { onClose: () => void }) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><View style={styles.unavailableBackdrop}><View style={styles.unavailable}><Text style={styles.emptyTitle}>Video unavailable</Text><Text style={styles.emptyText}>This lecture does not have a video API URL.</Text><AppButton title="Close" onPress={onClose} /></View></View></Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  welcome: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18, backgroundColor: colors.dark, borderRadius: radius.md },
  welcomeIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: '#A7F3D0', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  welcomeTitle: { color: colors.white, fontSize: 20, fontWeight: '800' },
  welcomeMeta: { color: '#D1D5DB', fontSize: 12, marginTop: 3 },
  count: { color: colors.white, fontSize: 20, fontWeight: '800', paddingHorizontal: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionCount: { color: colors.textMuted, fontSize: 12 },
  lecture: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  playIcon: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  lectureBody: { flex: 1, gap: 4 },
  lectureTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lectureMeta: { color: colors.textMuted, fontSize: 12 },
  lectureFoot: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  empty: { alignItems: 'center', gap: 9, padding: 30, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  playerScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', aspectRatio: 16 / 9 },
  closeButton: { position: 'absolute', top: 48, right: 18, zIndex: 2, padding: 8 },
  playerTitle: { color: colors.white, fontSize: 16, fontWeight: '700', padding: 18 },
  unavailableBackdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  unavailable: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 22, gap: 14 },
});
