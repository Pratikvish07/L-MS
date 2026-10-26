import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { DateTimeField } from '@/components/common/DateTimeField';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { SelectField } from '@/components/common/SelectField';
import { AppHeader } from '@/components/layout/AppHeader';
import { ControlCodeForm } from '@/components/recording/ControlCodeForm';
import { colors } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCatalog } from '@/hooks/useCatalog';
import { useChapters } from '@/hooks/useChapters';
import { useFacultyPairing } from '@/hooks/usePairing';
import { rememberChapterAndTopic } from '@/services/chapters.service';
import { assignSession } from '@/services/pairing.service';
import { createRecordingSession } from '@/services/recording.service';
import { academicLabel, yearLabel } from '@/utils/academics';
import { validateLecture, type LectureFormErrors } from '@/utils/validation';
import { goBack } from '@/utils/navigation';

const unique = <T,>(items: T[]) => [...new Set(items)];

export default function NewRecordingScreen() {
  const user = useCurrentUser();
  const insets = useSafeAreaInsets();
  const { classrooms, degrees, streams, subjects, loading, error: catalogError } = useCatalog();
  const { pairing, online } = useFacultyPairing(user.uid);

  const [classroomId, setClassroomId] = useState('');
  const [degreeId, setDegreeId] = useState('');
  const [streamId, setStreamId] = useState('');
  const [year, setYear] = useState(0);
  const [subjectId, setSubjectId] = useState('');
  const [chapter, setChapter] = useState('');
  const [topic, setTopic] = useState('');
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString());
  const [errors, setErrors] = useState<LectureFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Faculty see only the subjects assigned to them; if none are assigned yet, all subjects.
  const mySubjects = useMemo(() => subjects.filter((s) => s.facultyUids.includes(user.uid)), [subjects, user.uid]);
  const pool = mySubjects.length ? mySubjects : subjects;

  const degreeOptions = useMemo(() => {
    const ids = unique(pool.map((s) => s.degreeId));
    return degrees.filter((d) => ids.includes(d.id)).map((d) => ({ value: d.id, label: `${d.name} (${d.durationYears} years)` }));
  }, [degrees, pool]);

  const streamOptions = useMemo(() => {
    const ids = unique(pool.filter((s) => s.degreeId === degreeId).map((s) => s.streamId));
    return streams.filter((s) => ids.includes(s.id)).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }));
  }, [streams, pool, degreeId]);

  const yearOptions = useMemo(() => {
    const years = unique(pool.filter((s) => s.degreeId === degreeId && s.streamId === streamId).map((s) => s.year)).sort();
    return years.map((y) => ({ value: String(y), label: yearLabel(y) }));
  }, [pool, degreeId, streamId]);

  const subjectOptions = useMemo(
    () =>
      pool
        .filter((s) => s.degreeId === degreeId && s.streamId === streamId && s.year === year)
        .map((s) => ({ value: s.id, label: s.code ? `${s.name} (${s.code})` : s.name })),
    [pool, degreeId, streamId, year],
  );

  const subject = subjects.find((s) => s.id === subjectId);
  const { chapters } = useChapters(subjectId || undefined);
  // Chapters added by faculty, plus any listed on older subjects.
  const chapterOptions = unique([...chapters.map((c) => c.name), ...(subject?.chapters ?? [])]).map((c) => ({ value: c, label: c }));
  const topicOptions = (chapters.find((c) => c.name.toLowerCase() === chapter.trim().toLowerCase())?.topics ?? []).map((t) => ({
    value: t,
    label: t,
  }));
  const degree = degrees.find((d) => d.id === degreeId);
  const stream = streams.find((s) => s.id === streamId);
  const classroom = classrooms.find((c) => c.id === classroomId);
  // A tripod locked to a room by the admin fixes the classroom for its lectures.
  const lockedRoomId = pairing?.mountStatus?.classroomId || '';
  const lockedRoomName = pairing?.mountStatus?.classroomName || '';
  useEffect(() => {
    if (lockedRoomId) setClassroomId(lockedRoomId);
  }, [lockedRoomId]);

  // Changing a level clears everything below it.
  const chooseDegree = (id: string) => {
    setDegreeId(id);
    setStreamId('');
    setYear(0);
    setSubjectId('');
    setChapter('');
    setTopic('');
  };
  const chooseStream = (id: string) => {
    setStreamId(id);
    setYear(0);
    setSubjectId('');
    setChapter('');
    setTopic('');
  };
  const chooseYear = (value: string) => {
    setYear(Number(value));
    setSubjectId('');
    setChapter('');
    setTopic('');
  };
  const chooseSubject = (id: string) => {
    setSubjectId(id);
    setChapter('');
    setTopic('');
  };
  const chooseChapter = (name: string) => {
    setChapter(name);
    setTopic('');
  };

  const handleNext = async () => {
    const nextErrors = validateLecture({ classroomId, degreeId, streamId, year, subjectId, chapter, topic, recordedAt });
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length) return;
    if (pairing?.session) {
      setSubmitError('The classroom phone already has a lecture assigned. Open it from the dashboard, or finish it first.');
      return;
    }

    setSubmitting(true);
    try {
      const { sessionId, metadata } = await createRecordingSession(user, pairing?.mountUid ?? 'mount-tripod101', {
        classroomId,
        classroomName: lockedRoomId ? lockedRoomName : classroom ? `Room ${classroom.roomNo}` : classroomId,
        degreeId,
        degreeName: degree?.name ?? '',
        streamId,
        streamName: stream?.name ?? '',
        year,
        subjectId,
        subjectName: subject?.name ?? '',
        className: academicLabel(degree?.name ?? '', stream?.code ?? '', year),
        chapter: chapter.trim(),
        topic: topic.trim(),
        recordedAt,
      });
      await assignSession(pairing?.mountUid ?? 'mount-tripod101', { sessionId, metadata });
      // Save a newly typed chapter/topic to the subject for next time (needs assignment).
      if (subject?.facultyUids.includes(user.uid)) {
        rememberChapterAndTopic(subjectId, chapters, chapter, topic, user).catch(() => undefined);
      }
      router.replace({ pathname: '/recording-details/[id]', params: { id: sessionId } });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not create the recording session.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="New Recording" left={{ icon: 'arrow-back', label: 'Back', onPress: () => goBack('/dashboard') }} />
      {loading ? (
        <LoadingView message="Loading degrees and subjects…" />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {catalogError && <ErrorBanner message={catalogError} />}
            <Text style={styles.facultyRecordingNote}>Recording will use this faculty device camera and microphone.</Text>
            {!subjects.length && (
              <ErrorBanner message="No subjects have been set up yet. Ask the administrator to add degrees, streams and subjects in the Admin CMS." />
            )}
            {subjects.length > 0 && !mySubjects.length && (
              <Text style={styles.hint}>No subjects are assigned to you yet, so all subjects are listed.</Text>
            )}

            <SelectField
              label={lockedRoomId ? 'Classroom (locked to this tripod)' : 'Classroom'}
              icon={lockedRoomId ? 'lock-closed-outline' : 'easel-outline'}
              value={classroomId}
              onChange={setClassroomId}
              options={
                lockedRoomId
                  ? [{ value: lockedRoomId, label: lockedRoomName }]
                  : classrooms.map((c) => ({ value: c.id, label: `Room ${c.roomNo}` }))
              }
              placeholder="Select classroom"
              error={errors.classroomId}
              disabled={!!lockedRoomId}
            />
            <SelectField
              label="Degree"
              icon="school-outline"
              value={degreeId}
              onChange={chooseDegree}
              options={degreeOptions}
              placeholder="e.g. B.Tech"
              error={errors.degreeId}
            />
            <SelectField
              label="Stream"
              icon="git-branch-outline"
              value={streamId}
              onChange={chooseStream}
              options={streamOptions}
              placeholder={degreeId ? 'Select stream' : 'Select a degree first'}
              disabled={!degreeId}
              error={errors.streamId}
            />
            <SelectField
              label="Year"
              icon="layers-outline"
              value={year ? String(year) : ''}
              onChange={chooseYear}
              options={yearOptions}
              placeholder={streamId ? 'Select year' : 'Select a stream first'}
              disabled={!streamId}
              error={errors.year}
            />
            <SelectField
              label="Subject"
              icon="library-outline"
              value={subjectId}
              onChange={chooseSubject}
              options={subjectOptions}
              placeholder={year ? 'Select subject' : 'Select the year first'}
              disabled={!year}
              error={errors.subjectId}
            />
            <SelectField
              label="Chapter"
              icon="book-outline"
              value={chapter}
              onChange={chooseChapter}
              options={chapterOptions}
              placeholder={subjectId ? 'Select or type a new chapter' : 'Select a subject first'}
              disabled={!subjectId}
              error={errors.chapter}
              allowCustom
            />
            <SelectField
              label="Topic"
              icon="pricetag-outline"
              value={topic}
              onChange={setTopic}
              options={topicOptions}
              placeholder={chapter ? 'Select or type a new topic' : 'Select a chapter first'}
              disabled={!chapter}
              error={errors.topic}
              allowCustom
            />
            <DateTimeField label="Lecture Date" value={recordedAt} onChange={setRecordedAt} error={errors.recordedAt} />

            {submitError && <ErrorBanner message={submitError} />}
            <Text style={styles.hint}>
              Next opens the faculty camera and starts the lecture recording on this device.
            </Text>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <AppButton title="Next" iconRight="arrow-forward" onPress={handleNext} loading={submitting} />
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 16, gap: 16 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  facultyRecordingNote: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
