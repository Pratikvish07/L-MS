import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { Card, Chip, EmptyState, FilterChips, IconCircle, LecturePlayer, ProgressBar, StudentButton, studentStyles as s, type IconName } from '@/components/student/StudentUi';
import { accents, sColors, sRadius } from '@/constants/studentTheme';
import { useStudentEnrollment } from '@/hooks/useStudent';
import { subscribeToClassRecordings } from '@/services/recording.service';
import { markLectureViewed, subscribeCourseSubjects, subscribeMyViews, type LectureViewRow, type StudentSubject } from '@/services/student.service';
import type { Recording } from '@/types/recording.types';
import { formatDuration } from '@/utils/date';

type Filter = 'all' | 'progress' | 'done';
const SUBJECT_ICONS: IconName[] = ['calculator', 'flask', 'code-slash', 'briefcase', 'chatbubbles', 'globe', 'library', 'bulb'];

/** My Courses: subjects of my course+batch with progress; open a subject for its lectures and notes. */
export default function MyCourseScreen() {
  const insets = useSafeAreaInsets();
  const { user, current, loading } = useStudentEnrollment();
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [views, setViews] = useState<LectureViewRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseId = current?.courseId ?? '';
  const batchId = current?.batchId ?? '';
  useEffect(() => {
    const stops = [subscribeMyViews(user.uid, setViews, () => undefined)];
    if (courseId && batchId) {
      stops.push(subscribeCourseSubjects(courseId, setSubjects, () => setSubjects([])));
      stops.push(subscribeToClassRecordings(courseId, batchId, setRecordings, (cause) => setError(cause.message)));
    }
    return () => stops.forEach((stop) => stop());
  }, [user.uid, courseId, batchId]);

  const viewed = useMemo(() => new Set(views.map((v) => v.recordingId)), [views]);
  const cards = useMemo(() => subjects.map((subject, index) => {
    const lectures = (recordings ?? []).filter((r) => r.subjectId === subject.id).sort((a, b) => (Number(a.lectureNumber) || 1e9) - (Number(b.lectureNumber) || 1e9) || a.recordedAt.localeCompare(b.recordedAt));
    const done = lectures.filter((r) => viewed.has(r.id)).length;
    return { subject, lectures, done, percent: lectures.length ? (done / lectures.length) * 100 : 0, accent: accents[index % accents.length], icon: SUBJECT_ICONS[index % SUBJECT_ICONS.length] };
  }), [subjects, recordings, viewed]);
  const shown = cards.filter((c) => filter === 'all' || (filter === 'done' ? c.lectures.length > 0 && c.percent >= 100 : c.percent < 100));
  const selected = cards.find((c) => c.subject.id === openSubject);

  const play = (r: Recording) => {
    if (!r.partFileIds[0]?.startsWith('http')) { setError('This lecture video is not available yet.'); return; }
    setPlaying(r);
    void markLectureViewed(user, { id: r.id, courseId: r.courseId, batchId: r.batchId, subjectId: r.subjectId }).catch(() => undefined);
  };

  if (loading) return <LoadingView />;

  const header = (title: string, onBack?: () => void) => (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><Ionicons name="chevron-back" size={22} color={sColors.text} /></Pressable> : null}
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Explore courses" onPress={() => router.push('/student/courses')} style={styles.back}><Ionicons name="storefront-outline" size={20} color={sColors.text} /></Pressable>
    </View>
  );

  if (!current) {
    return (
      <View style={s.screen}>
        {header('My Courses')}
        <View style={s.content}><EmptyState icon="school-outline" title="Not enrolled yet" text="Request a course from Explore. It appears here once the administrator enrols you in a batch."><StudentButton title="Explore courses" icon="storefront-outline" onPress={() => router.push('/student/courses')} /></EmptyState></View>
      </View>
    );
  }

  // Subject detail: its lectures with watched state, play and notes.
  if (selected) {
    return (
      <View style={s.screen}>
        {header(selected.subject.name, () => setOpenSubject(null))}
        <ScrollView contentContainerStyle={s.content}>
          <Card style={{ backgroundColor: selected.accent.bg }}>
            <View style={s.row}>
              <IconCircle icon={selected.icon} bg={sColors.surface} fg={selected.accent.fg} />
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{selected.subject.name}</Text>
                <Text style={s.meta}>{selected.subject.instructorName ? `By ${selected.subject.instructorName}` : current.courseName}</Text>
              </View>
              <Text style={[styles.pct, { color: selected.accent.fg }]}>{Math.round(selected.percent)}%</Text>
            </View>
            <ProgressBar percent={selected.percent} color={selected.accent.fg} />
            <Text style={s.meta}>{selected.done} of {selected.lectures.length} lectures watched</Text>
          </Card>
          {error && <ErrorBanner message={error} />}
          {selected.lectures.map((r) => {
            const seen = viewed.has(r.id);
            return (
              <Card key={r.id}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Play ${r.topic}${seen ? ', watched' : ''}`} onPress={() => play(r)} style={s.row}>
                  <View style={[styles.lectureNo, seen && { backgroundColor: sColors.greenSoft }]}>
                    {seen ? <Ionicons name="checkmark" size={20} color={sColors.green} /> : <Text style={styles.lectureNoText}>{r.lectureNumber ? `L${r.lectureNumber}` : '▶'}</Text>}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.title} numberOfLines={2}>{r.topic}</Text>
                    <Text style={s.meta}>{[r.recordedAt ? new Date(r.recordedAt).toLocaleDateString() : '', r.durationSeconds ? formatDuration(r.durationSeconds) : '', seen ? 'Watched' : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Ionicons name="play-circle" size={34} color={sColors.primary} />
                </Pressable>
              </Card>
            );
          })}
          {!selected.lectures.length && <EmptyState icon="videocam-outline" title="No lectures yet" text="Lectures appear here as soon as your instructor's recording is uploaded." />}
        </ScrollView>
        {playing && <LecturePlayer uri={playing.partFileIds[0]} title={playing.topic} onClose={() => setPlaying(null)} />}
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {header('My Courses')}
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.row}>
          <Chip tone="purple" icon="school" label={current.courseName} />
          <Chip tone="blue" icon="people" label={current.batchName} />
        </View>
        <FilterChips<Filter> options={[['all', 'All Subjects'], ['progress', 'In Progress'], ['done', 'Completed']]} value={filter} onChange={setFilter} />
        {error && <ErrorBanner message={error} />}
        {recordings === null ? <LoadingView message="Loading your subjects…" /> : shown.map((c) => (
          <Pressable key={c.subject.id} accessibilityRole="button" accessibilityLabel={`${c.subject.name}, ${Math.round(c.percent)} percent`} onPress={() => setOpenSubject(c.subject.id)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={[styles.subjectArt, { backgroundColor: c.accent.bg }]}><Ionicons name={c.icon} size={30} color={c.accent.fg} /></View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={s.title} numberOfLines={1}>{c.subject.name}</Text>
                <Text style={s.meta} numberOfLines={1}>{c.subject.instructorName ? `By ${c.subject.instructorName}` : c.subject.code || 'Subject'}</Text>
                <View style={s.row}>
                  <View style={{ flex: 1 }}><ProgressBar percent={c.percent} color={c.accent.fg} /></View>
                  <Text style={[styles.pctSmall, { color: c.accent.fg }]}>{Math.round(c.percent)}%</Text>
                </View>
                <Text style={s.meta}>{c.done}/{c.lectures.length} lectures</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={sColors.muted} />
            </Card>
          </Pressable>
        ))}
        {recordings !== null && !shown.length && <EmptyState icon="library-outline" title={filter === 'done' ? 'No completed subjects yet' : 'No subjects here'} text={filter === 'done' ? 'Finish all lectures of a subject to see it here.' : 'Subjects appear once the administrator adds them to your course.'} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 10, backgroundColor: sColors.background },
  headerTitle: { flex: 1, color: sColors.text, fontSize: 22, fontWeight: '800' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: sColors.surface, alignItems: 'center', justifyContent: 'center' },
  subjectArt: { width: 64, height: 64, borderRadius: sRadius.md, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 22, fontWeight: '800' },
  pctSmall: { fontSize: 12, fontWeight: '800', minWidth: 34, textAlign: 'right' },
  lectureNo: { width: 46, height: 46, borderRadius: sRadius.sm, backgroundColor: sColors.soft, alignItems: 'center', justifyContent: 'center' },
  lectureNoText: { color: sColors.primary, fontWeight: '800', fontSize: 13 },
});
