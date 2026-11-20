import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/AppButton';
import { AppInput } from '@/components/common/AppInput';
import { DateTimeField } from '@/components/common/DateTimeField';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { SelectField } from '@/components/common/SelectField';
import { AppHeader } from '@/components/layout/AppHeader';
import { colors } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/useAuth';
import { useCatalog } from '@/hooks/useCatalog';
import { useFacultyPairing } from '@/hooks/usePairing';
import { assignSession } from '@/services/pairing.service';
import { createRecordingSession } from '@/services/recording.service';
import type { Batch, Subject } from '@/types/catalog.types';
import { goBack } from '@/utils/navigation';

/** Who teaches `subject` in `batch`: the batch override, else the course default (older data: facultyUids). */
function teaches(uid: string, subject: Subject, batch: Batch) {
  const override = batch.subjectInstructors?.[subject.id];
  if (override) return override.uid === uid;
  if (subject.instructorUid) return subject.instructorUid === uid;
  return (subject.facultyUids ?? []).includes(uid);
}

type Errors = Partial<Record<'courseId' | 'batchId' | 'subjectId' | 'topic' | 'recordedAt', string>>;

export default function NewRecordingScreen() {
  const user = useCurrentUser();
  const insets = useSafeAreaInsets();
  const { subjects, batches, courses, loading, error: catalogError } = useCatalog();
  const { pairing } = useFacultyPairing(user.uid);

  const [chosenCourseId, setCourseId] = useState('');
  const [chosenBatchId, setBatchId] = useState('');
  const [chosenSubjectId, setSubjectId] = useState('');
  const [topic, setTopic] = useState('');
  const [lectureNumber, setLectureNumber] = useState('');
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString());
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Every (batch, subject) this instructor teaches. If nothing is assigned yet, everything is offered.
  const { pairs, assigned } = useMemo(() => {
    const all: { batch: Batch; subject: Subject }[] = [];
    for (const batch of batches.filter((item) => item.active !== false && item.courseId)) {
      for (const subject of subjects.filter((item) => item.courseId === batch.courseId)) all.push({ batch, subject });
    }
    const mine = all.filter(({ batch, subject }) => teaches(user.uid, subject, batch));
    return { pairs: mine.length ? mine : all, assigned: mine.length > 0 };
  }, [batches, subjects, user.uid]);

  // When there is only one choice it is selected automatically (derived, not stored).
  const only = (options: { value: string }[]) => (options.length === 1 ? options[0].value : '');
  const courseOptions = useMemo(() => {
    const ids = new Set(pairs.map(({ batch }) => batch.courseId));
    return courses.filter((course) => ids.has(course.id)).map((course) => ({ value: course.id, label: course.title }));
  }, [pairs, courses]);
  const courseId = chosenCourseId || only(courseOptions);
  const batchOptions = useMemo(() => {
    const seen = new Map<string, Batch>();
    pairs.filter(({ batch }) => batch.courseId === courseId).forEach(({ batch }) => seen.set(batch.id, batch));
    return [...seen.values()].map((batch) => ({ value: batch.id, label: batch.year ? `${batch.name} · Year ${batch.year}` : batch.name }));
  }, [pairs, courseId]);
  const batchId = (chosenBatchId && batchOptions.some((option) => option.value === chosenBatchId) ? chosenBatchId : '') || only(batchOptions);
  const subjectOptions = useMemo(
    () => pairs.filter(({ batch }) => batch.id === batchId).map(({ subject }) => ({ value: subject.id, label: subject.code ? `${subject.name} (${subject.code})` : subject.name })),
    [pairs, batchId],
  );
  const subjectId = (chosenSubjectId && subjectOptions.some((option) => option.value === chosenSubjectId) ? chosenSubjectId : '') || only(subjectOptions);

  const course = courses.find((item) => item.id === courseId);
  const batch = batches.find((item) => item.id === batchId);
  const subject = subjects.find((item) => item.id === subjectId);
  const lockedRoomId = pairing?.mountStatus?.classroomId || '';
  const lockedRoomName = pairing?.mountStatus?.classroomName || '';


  const handleNext = async () => {
    const next: Errors = {};
    if (!courseId) next.courseId = 'Select a course.';
    if (!batchId) next.batchId = 'Select a batch.';
    if (!subjectId) next.subjectId = 'Select a subject.';
    if (!topic.trim()) next.topic = 'Enter the lecture name.';
    else if (topic.trim().length > 120) next.topic = 'Keep the lecture name under 120 characters.';
    if (!recordedAt) next.recordedAt = 'Choose the lecture date.';
    setErrors(next);
    setSubmitError(null);
    if (Object.keys(next).length || !batch || !subject) return;
    if (pairing?.session) {
      setSubmitError('The classroom phone already has a lecture assigned. Open it from the dashboard, or finish it first.');
      return;
    }

    setSubmitting(true);
    try {
      const { sessionId, metadata } = await createRecordingSession(user, pairing?.mountUid ?? '', {
        classroomId: lockedRoomId || batch.classroomId || '',
        classroomName: lockedRoomName || batch.classroomName || '',
        degreeId: batch.degreeId ?? '', degreeName: '', streamId: batch.streamId ?? '', streamName: '',
        year: batch.year || subject.year || 0,
        batchId, batchName: batch.name,
        subjectId, subjectName: subject.name,
        courseId, courseName: course?.title ?? '',
        className: [course?.title, batch.name].filter(Boolean).join(' · '),
        chapter: '',
        topic: topic.trim(),
        lectureNumber: lectureNumber.trim(),
        recordedAt,
      });
      if (pairing?.mountUid) await assignSession(pairing.mountUid, { sessionId, metadata });
      router.replace({ pathname: '/recording-details/[id]', params: { id: sessionId } });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not create the lecture.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader title="New Lecture" left={{ icon: 'arrow-back', label: 'Back', onPress: () => goBack('/dashboard') }} />
      {loading ? (
        <LoadingView message="Loading your courses…" />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {catalogError && <ErrorBanner message={catalogError} />}
            {!pairs.length && <ErrorBanner message="No courses with batches and subjects yet. Ask the administrator to set them up in the Admin CMS." />}
            {pairs.length > 0 && !assigned && <Text style={styles.hint}>No subjects are assigned to you yet, so every course is listed.</Text>}

            <SelectField label="Course" icon="school-outline" value={courseId} onChange={(id) => { setCourseId(id); setBatchId(''); setSubjectId(''); }} options={courseOptions} placeholder="Select course" error={errors.courseId} />
            <SelectField label="Batch" icon="people-outline" value={batchId} onChange={(id) => { setBatchId(id); setSubjectId(''); }} options={batchOptions} placeholder={courseId ? 'Select batch' : 'Select a course first'} disabled={!courseId} error={errors.batchId} />
            <SelectField label="Subject" icon="library-outline" value={subjectId} onChange={setSubjectId} options={subjectOptions} placeholder={batchId ? 'Select subject' : 'Select a batch first'} disabled={!batchId} error={errors.subjectId} />

            <AppInput label="Lecture name" icon="create-outline" placeholder="e.g. Lecture 1: Introduction" value={topic} onChangeText={setTopic} error={errors.topic} />
            <AppInput label="Lecture number" icon="list-outline" placeholder="e.g. 1" value={lectureNumber} onChangeText={setLectureNumber} keyboardType="numeric" />
            <DateTimeField label="Lecture date" value={recordedAt} onChange={setRecordedAt} error={errors.recordedAt} />


            {submitError && <ErrorBanner message={submitError} />}
            <Text style={styles.hint}>Next opens the lecture, where you start and stop the recording.</Text>
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
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
