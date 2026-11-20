import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initials } from '@/components/common/Avatar';
import { Card, Chip, GradientCard, IconCircle, LecturePlayer, ProgressBar, ProgressRing, SectionHeader, StudentButton, studentStyles as s, type IconName } from '@/components/student/StudentUi';
import { accents, sColors, sRadius, sShadow } from '@/constants/studentTheme';
import { useAuth } from '@/hooks/useAuth';
import { useStudentEnrollment } from '@/hooks/useStudent';
import { subscribeToClassRecordings } from '@/services/recording.service';
import {
  markLectureViewed, subscribeBatchAssessments, subscribeMyMarks, subscribeMySubmissions, subscribeMyViews,
  type LectureViewRow, type StudentAssessment, type StudentMark, type Submission,
} from '@/services/student.service';
import type { Recording } from '@/types/recording.types';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; };
const todayKey = () => new Date().toLocaleDateString('en-CA');

export default function StudentHome() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user, current } = useStudentEnrollment();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [views, setViews] = useState<LectureViewRow[]>([]);
  const [playing, setPlaying] = useState<Recording | null>(null);

  const courseId = current?.courseId ?? '';
  const batchId = current?.batchId ?? '';
  useEffect(() => {
    const stops = [subscribeMySubmissions(user.uid, setSubmissions, () => undefined), subscribeMyMarks(user.uid, setMarks, () => undefined), subscribeMyViews(user.uid, setViews, () => undefined)];
    if (courseId && batchId) {
      stops.push(subscribeToClassRecordings(courseId, batchId, setRecordings, () => undefined));
      stops.push(subscribeBatchAssessments(batchId, setAssessments, () => undefined));
    }
    return () => stops.forEach((stop) => stop());
  }, [user.uid, courseId, batchId]);

  const viewed = useMemo(() => new Set(views.map((v) => v.recordingId)), [views]);
  const watched = recordings.filter((r) => viewed.has(r.id)).length;
  const progress = recordings.length ? (watched / recordings.length) * 100 : 0;
  const notes = recordings.reduce((n, r) => n + r.lectureNotes.length, 0);
  const submitted = new Set(submissions.map((x) => x.assessmentId));
  const upcoming = assessments.filter((a) => !submitted.has(a.id) && (!a.date || a.date >= todayKey())).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')).slice(0, 3);
  const marked = marks.filter((m) => m.marks !== null);
  const score = marked.reduce((n, m) => n + m.maxMarks, 0) ? Math.round((marked.reduce((n, m) => n + (m.marks ?? 0), 0) / marked.reduce((n, m) => n + m.maxMarks, 0)) * 100) : null;

  // Continue learning: the next lecture not yet watched (in lecture order), else the latest one.
  const ordered = [...recordings].sort((a, b) => a.subjectName.localeCompare(b.subjectName) || (Number(a.lectureNumber) || 1e9) - (Number(b.lectureNumber) || 1e9));
  const next = ordered.find((r) => !viewed.has(r.id)) ?? recordings[0];
  const subjectPct = (subjectId: string) => { const rows = recordings.filter((r) => r.subjectId === subjectId); return rows.length ? (rows.filter((r) => viewed.has(r.id)).length / rows.length) * 100 : 0; };

  const play = (r: Recording) => {
    if (!r.partFileIds[0]?.startsWith('http')) return;
    setPlaying(r);
    void markLectureViewed(user, { id: r.id, courseId: r.courseId, batchId: r.batchId, subjectId: r.subjectId }).catch(() => undefined);
  };
  const go = (href: Href) => router.push(href);
  const actions: { icon: IconName; label: string; href: Href }[] = [
    { icon: 'book', label: 'My Course', href: '/student/my-course' },
    { icon: 'storefront', label: 'Explore', href: '/student/courses' },
    { icon: 'reader', label: 'Tests', href: '/student/assessments' },
    { icon: 'document-attach', label: 'Assignments', href: { pathname: '/student/assessments', params: { type: 'assignment' } } },
  ];

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{greeting()},</Text>
            <Text style={styles.name} numberOfLines={1}>{user.displayName.split(' ')[0]} 👋</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={signOut} style={styles.iconBtn}><Ionicons name="log-out-outline" size={21} color={sColors.text} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => go('/student/profile')} style={styles.avatar}><Text style={styles.avatarText}>{initials(user.displayName)}</Text></Pressable>
        </View>

        <GradientCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.heroTitle}>Keep Learning,{'\n'}Keep Growing!</Text>
              <Text style={styles.heroMeta}>{current ? `${recordings.length} Lectures • ${assessments.length} Tests • ${notes} Notes` : 'Explore courses to get started'}</Text>
              <Pressable accessibilityRole="button" onPress={() => (next ? play(next) : go(current ? '/student/my-course' : '/student/courses'))} style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>{current ? (next ? 'Continue learning' : 'Open my course') : 'Explore courses'}</Text>
                <Ionicons name="arrow-forward" size={15} color={sColors.primary} />
              </Pressable>
            </View>
            <View style={styles.heroArt}><Ionicons name="school" size={52} color={sColors.white} /></View>
          </View>
        </GradientCard>

        <View style={styles.actions}>
          {actions.map((a, i) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={() => go(a.href)} style={styles.action}>
              <IconCircle icon={a.icon} bg={accents[i].bg} fg={accents[i].fg} size={54} />
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {current ? (
          <>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ProgressRing percent={progress} label="of lectures watched" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.title}>Your Learning Progress</Text>
                <Text style={s.meta}>{watched} of {recordings.length} lectures watched</Text>
                <Text style={s.meta}>{current.courseName} · {current.batchName}</Text>
                {score !== null && <Chip tone="purple" icon="ribbon" label={`Score ${score}%`} />}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="View my course" onPress={() => go('/student/my-course')} hitSlop={8}><Ionicons name="chevron-forward" size={22} color={sColors.primary} /></Pressable>
            </Card>

            {next && (
              <>
                <SectionHeader title="Continue Learning" action="View all" onAction={() => go('/student/my-course')} />
                <Pressable accessibilityRole="button" accessibilityLabel={`Play ${next.topic}`} onPress={() => play(next)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.thumb}><Ionicons name="play" size={24} color={sColors.white} /></View>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={s.title} numberOfLines={1}>{next.lectureNumber ? `L${next.lectureNumber} · ` : ''}{next.topic}</Text>
                      <Text style={s.meta} numberOfLines={1}>{[next.subjectName, next.facultyName].filter(Boolean).join(' · ')}</Text>
                      <ProgressBar percent={subjectPct(next.subjectId)} />
                      <Text style={s.meta}>{Math.round(subjectPct(next.subjectId))}% of {next.subjectName || 'subject'}</Text>
                    </View>
                  </Card>
                </Pressable>
              </>
            )}

            <SectionHeader title="Upcoming Tests & Assignments" action={upcoming.length ? 'View all' : undefined} onAction={() => go('/student/assessments')} />
            {upcoming.map((a) => {
              const d = a.date ? new Date(`${a.date}T12:00:00`) : null;
              return (
                <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateDay}>{d ? d.getDate() : '—'}</Text>
                    <Text style={styles.dateMonth}>{d ? d.toLocaleDateString(undefined, { month: 'short' }) : 'Open'}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={s.title} numberOfLines={1}>{a.title}</Text>
                    <Text style={s.meta} numberOfLines={1}>{a.subjectName} · {a.type === 'test' ? (a.questionCount ? 'Quiz' : 'Test') : 'Assignment'} · {a.maxMarks} marks</Text>
                  </View>
                  <StudentButton small title={a.questionCount ? 'Start' : 'Open'} onPress={() => go({ pathname: '/student/assessment/[id]', params: { id: a.id } })} />
                </Card>
              );
            })}
            {!upcoming.length && <Card><Text style={s.meta}>Nothing due. You are all caught up 🎉</Text></Card>}
          </>
        ) : (
          <Card style={{ alignItems: 'center', gap: 12 }}>
            <IconCircle icon="school-outline" size={56} />
            <Text style={[s.title, { textAlign: 'center' }]}>You are not enrolled yet</Text>
            <Text style={[s.meta, { textAlign: 'center' }]}>Browse the live courses and request enrolment. Your batch, lectures and tests appear here once the admin enrols you.</Text>
            <StudentButton title="Explore courses" icon="storefront-outline" onPress={() => go('/student/courses')} />
          </Card>
        )}
      </ScrollView>
      {playing && <LecturePlayer uri={playing.partFileIds[0]} title={playing.topic} onClose={() => setPlaying(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { color: sColors.muted, fontSize: 14 },
  name: { color: sColors.text, fontSize: 24, fontWeight: '800' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: sColors.surface, alignItems: 'center', justifyContent: 'center', ...sShadow },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: sColors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: sColors.soft },
  avatarText: { color: sColors.white, fontWeight: '800', fontSize: 16 },
  heroTitle: { color: sColors.white, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  heroMeta: { color: '#E9E3FF', fontSize: 12 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, backgroundColor: sColors.white, paddingHorizontal: 14, paddingVertical: 9, borderRadius: sRadius.pill },
  heroBtnText: { color: sColors.primary, fontWeight: '800', fontSize: 13 },
  heroArt: { width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { alignItems: 'center', gap: 6, flex: 1 },
  actionLabel: { color: sColors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  thumb: { width: 64, height: 64, borderRadius: sRadius.md, backgroundColor: sColors.primary, alignItems: 'center', justifyContent: 'center' },
  dateBox: { width: 54, paddingVertical: 8, borderRadius: sRadius.md, backgroundColor: sColors.soft, alignItems: 'center' },
  dateDay: { color: sColors.primary, fontSize: 20, fontWeight: '800' },
  dateMonth: { color: sColors.primary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
});
