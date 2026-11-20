import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { Card, Chip, StudentButton, StudentHeader, studentStyles as s } from '@/components/student/StudentUi';
import { STUDENT_HOME, sColors, sRadius } from '@/constants/studentTheme';
import { useStudentEnrollment } from '@/hooks/useStudent';
import { notePreviewUrl } from '@/services/notes.service';
import {
  getPaper, submitAssessment, subscribeAssessment, subscribeMyMarks, subscribeMySubmission, uploadSubmissionFile,
  type AssessmentFile, type PaperQuestion, type StudentAssessment, type StudentMark, type Submission,
} from '@/services/student.service';
import { confirm } from '@/utils/confirm';
import { formatBytes } from '@/utils/file-size';
import { goBack } from '@/utils/navigation';

const FILE_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];

/** One test or assignment: instructions, files, MCQ attempt and/or file submission, and the result. */
export default function StudentAssessmentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const { user, current } = useStudentEnrollment();
  const [assessment, setAssessment] = useState<StudentAssessment | null | undefined>(undefined);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [mark, setMark] = useState<StudentMark | null>(null);
  const [paper, setPaper] = useState<PaperQuestion[] | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stops = [
      subscribeAssessment(id, setAssessment, (cause) => setError(cause.message)),
      subscribeMySubmission(id, user.uid, setSubmission, (cause) => setError(cause.message)),
      subscribeMyMarks(user.uid, (rows) => setMark(rows.find((m) => m.assessmentId === id) ?? null), () => undefined),
    ];
    return () => stops.forEach((stop) => stop());
  }, [id, user.uid]);

  const back = { icon: 'arrow-back' as const, label: 'Back', onPress: () => goBack(STUDENT_HOME) };
  if (assessment === undefined) return <LoadingView />;
  if (!assessment) return <View style={s.screen}><StudentHeader title="Not found" onBack={back.onPress} /><View style={s.content}><ErrorBanner message={error ?? 'This test or assignment is no longer available.'} /></View></View>;

  const isQuiz = assessment.questionCount > 0;
  const submitted = Boolean(submission);
  const quizDone = Boolean(submission?.answers);
  const batchId = current?.batchId ?? '';

  const startQuiz = async () => {
    setError(null); setBusy(true);
    try {
      const questions = await getPaper(assessment.id);
      if (!questions.length) throw new Error('The quiz questions are not available yet. Ask your instructor.');
      setPaper(questions); setAnswers(questions.map(() => -1)); setQuizOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the quiz.'); } finally { setBusy(false); }
  };
  const finishQuiz = async () => {
    const skipped = answers.filter((a) => a < 0).length;
    if (!(await confirm('Submit quiz?', skipped ? `${skipped} question${skipped === 1 ? '' : 's'} not answered. You cannot change answers after submitting.` : 'You cannot change answers after submitting.', 'Submit'))) return;
    setBusy(true); setError(null);
    try { await submitAssessment(user, assessment, batchId, { answers }); setQuizOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit.'); } finally { setBusy(false); }
  };
  const uploadFile = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: FILE_TYPES, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setProgress(0);
      const saved = await uploadSubmissionFile(assessment, user.uid, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 0 }, setProgress);
      await submitAssessment(user, assessment, batchId, { files: [...(submission?.files ?? []), saved] });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload the file.'); } finally { setProgress(null); }
  };
  const open = (file: AssessmentFile) => Linking.openURL(notePreviewUrl(file)).catch(() => setError('Could not open the file.'));

  if (quizOpen && paper) {
    const answered = answers.filter((a) => a >= 0).length;
    return (
      <View style={s.screen}>
        <StudentHeader title={assessment.title} onBack={() => setQuizOpen(false)} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.meta}>{answered}/{paper.length} answered{assessment.durationMinutes ? ` · suggested time ${assessment.durationMinutes} min` : ''}</Text>
          {paper.map((q, qi) => (
            <Card key={qi}>
              <Text style={s.title}>{qi + 1}. {q.text}</Text>
              <Text style={s.meta}>{q.marks} mark{q.marks === 1 ? '' : 's'}</Text>
              {q.options.map((option, oi) => (
                <Pressable key={oi} accessibilityRole="radio" accessibilityState={{ checked: answers[qi] === oi }} onPress={() => setAnswers((cur) => cur.map((v, i) => (i === qi ? oi : v)))} style={[styles.option, answers[qi] === oi && styles.optionOn]}>
                  <View style={[styles.radio, answers[qi] === oi && styles.radioOn]}>{answers[qi] === oi && <View style={styles.radioDot} />}</View>
                  <Text style={styles.optionText}>{String.fromCharCode(65 + oi)}. {option}</Text>
                </Pressable>
              ))}
            </Card>
          ))}
          {error && <ErrorBanner message={error} />}
          <StudentButton title={`Submit quiz (${answered}/${paper.length})`} icon="checkmark-done" onPress={() => void finishQuiz()} loading={busy} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StudentHeader title={assessment.type === 'test' ? 'Test' : 'Assignment'} onBack={back.onPress} />
      <ScrollView contentContainerStyle={s.content}>
        <Card>
          <Text style={s.sectionTitle}>{assessment.title}</Text>
          <Text style={s.meta}>{[assessment.subjectName, assessment.date ? `${assessment.type === 'assignment' ? 'Due ' : ''}${new Date(`${assessment.date}T12:00:00`).toLocaleDateString()}` : '', assessment.durationMinutes ? `${assessment.durationMinutes} min` : '', `${assessment.maxMarks} marks`].filter(Boolean).join(' · ')}</Text>
          {assessment.lectureTitle ? <Chip tone="blue" icon="videocam" label={`Based on ${assessment.lectureTitle}`} /> : null}
          {assessment.instructions ? <Text style={styles.instructions}>{assessment.instructions}</Text> : null}
        </Card>

        {mark && mark.marks !== null && (
          <Card style={{ backgroundColor: sColors.soft, borderColor: sColors.soft }}>
            <Text style={s.meta}>Your result</Text>
            <Text style={styles.score}>{mark.marks} / {mark.maxMarks}  ·  {Math.round(((mark.marks ?? 0) / (mark.maxMarks || 1)) * 100)}%</Text>
            {mark.remarks ? <Text style={s.meta}>Remarks: {mark.remarks}</Text> : null}
          </Card>
        )}

        {assessment.files.length > 0 && (
          <Card>
            <Text style={s.title}>{assessment.type === 'test' ? 'Question paper' : 'Assignment files'}</Text>
            {assessment.files.map((file) => (
              <Pressable key={file.path} accessibilityRole="button" onPress={() => void open(file)} style={styles.file}>
                <Ionicons name="document-text-outline" size={18} color={sColors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={styles.fileOpen}>Open</Text>
              </Pressable>
            ))}
          </Card>
        )}

        {isQuiz && (
          <Card>
            <Text style={s.title}>Online quiz · {assessment.questionCount} questions</Text>
            {quizDone ? <Chip tone="green" icon="checkmark-done" label={`Submitted ${submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ''}`} />
              : <StudentButton title="Start quiz" icon="play" onPress={() => void startQuiz()} loading={busy} />}
            {quizDone && !(mark && mark.marks !== null) && <Text style={s.meta}>Your answers are saved. Marks appear after your instructor releases them.</Text>}
          </Card>
        )}

        {!isQuiz && (
          <Card>
            <Text style={s.title}>{assessment.type === 'test' ? 'Upload your answer sheet' : 'Your submission'}</Text>
            {(submission?.files ?? []).map((file) => (
              <Pressable key={file.path} accessibilityRole="button" onPress={() => void open(file)} style={styles.file}>
                <Ionicons name="checkmark-circle" size={18} color={sColors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                <Text style={s.meta}>{formatBytes(file.size)}</Text>
              </Pressable>
            ))}
            {progress !== null && <Text style={s.meta}>Uploading… {Math.round(progress * 100)}%</Text>}
            {mark && mark.marks !== null ? <Text style={s.meta}>Marked. Submissions are closed.</Text>
              : <StudentButton title={submitted ? 'Add another file' : 'Upload file (PDF, Word or photo)'} icon="cloud-upload-outline" variant={submitted ? 'soft' : 'primary'} onPress={() => void uploadFile()} loading={progress !== null} />}
            {submitted && <Text style={s.meta}>Submitted {submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ''}</Text>}
          </Card>
        )}
        {error && <ErrorBanner message={error} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  instructions: { color: sColors.text, fontSize: 13, lineHeight: 19 },
  score: { color: sColors.primaryDark, fontSize: 24, fontWeight: '800' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: sRadius.md, backgroundColor: sColors.background },
  fileName: { flex: 1, color: sColors.text, fontSize: 13 },
  fileOpen: { color: sColors.primary, fontSize: 13, fontWeight: '700' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: sRadius.md, borderWidth: 1, borderColor: sColors.border },
  optionOn: { borderColor: sColors.primary, backgroundColor: sColors.soft },
  optionText: { flex: 1, color: sColors.text, fontSize: 14 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: sColors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: sColors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: sColors.primary },
});
