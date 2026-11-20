import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LoadingView } from '@/components/common/LoadingView';
import { Card, Chip, EmptyState, FilterChips, StudentHeader, studentStyles as s } from '@/components/student/StudentUi';
import { sColors } from '@/constants/studentTheme';
import { useStudentEnrollment } from '@/hooks/useStudent';
import { subscribeBatchAssessments, subscribeMyMarks, subscribeMySubmissions, type StudentAssessment, type StudentMark, type Submission } from '@/services/student.service';

type Filter = '' | 'pending' | 'submitted' | 'marked';

/** Tests & quizzes (type=test) or assignments (type=assignment) for the student's batch. */
export default function StudentAssessmentsScreen() {
  const { type: initialType } = useLocalSearchParams<{ type?: 'test' | 'assignment' }>();
  const [picked, setType] = useState<{ type: 'test' | 'assignment'; from: string | undefined } | null>(null);
  // A new route param (e.g. the Home "Assignments" shortcut) wins over the last manual switch.
  const type: 'test' | 'assignment' = picked && picked.from === initialType ? picked.type : initialType === 'assignment' ? 'assignment' : 'test';
  const { user, current, loading } = useStudentEnrollment();
  const [rows, setRows] = useState<StudentAssessment[] | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [marks, setMarks] = useState<StudentMark[]>([]);
  const [filter, setFilter] = useState<Filter>('');
  const batchId = current?.batchId ?? '';

  useEffect(() => {
    const stops = [subscribeMySubmissions(user.uid, setSubmissions, () => undefined), subscribeMyMarks(user.uid, setMarks, () => undefined)];
    if (batchId) stops.push(subscribeBatchAssessments(batchId, setRows, () => setRows([])));
    return () => stops.forEach((stop) => stop());
  }, [user.uid, batchId]);

  const isTest = type !== 'assignment';
  const title = isTest ? 'Tests & Quizzes' : 'Assignments';
  const list = useMemo(() => (rows ?? []).filter((a) => a.type === (isTest ? 'test' : 'assignment')), [rows, isTest]);
  const stateOf = (a: StudentAssessment) => (marks.some((m) => m.assessmentId === a.id && m.marks !== null) ? 'marked' : submissions.some((x) => x.assessmentId === a.id) ? 'submitted' : 'pending');
  const shown = list.filter((a) => !filter || stateOf(a) === filter);

  if (loading) return <LoadingView />;
  return (
    <View style={s.screen}>
      <StudentHeader title={title} />
      <ScrollView contentContainerStyle={s.content}>
        {!current ? <EmptyState icon="school-outline" title="Not enrolled yet" text="Tests and assignments appear once you are enrolled in a batch." /> : (
          <>
            <FilterChips<'test' | 'assignment'> options={[['test', 'Tests & Quizzes'], ['assignment', 'Assignments']]} value={type} onChange={(next) => { setType({ type: next, from: initialType }); setFilter(''); }} />
            <FilterChips<Filter> options={[['', `All (${list.length})`], ['pending', 'To do'], ['submitted', 'Submitted'], ['marked', 'Marked']]} value={filter} onChange={setFilter} />
            {rows === null ? <LoadingView /> : shown.map((a) => {
              const state = stateOf(a);
              const mark = marks.find((m) => m.assessmentId === a.id);
              const overdue = state === 'pending' && a.date && a.date < new Date().toLocaleDateString('en-CA');
              return (
                <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/student/assessment/[id]', params: { id: a.id } })}>
                  <Card>
                    <View style={[s.row, { justifyContent: 'space-between' }]}>
                      <Chip tone={isTest ? 'blue' : 'green'} icon={a.questionCount ? 'list' : 'document-text'} label={a.questionCount ? `Quiz · ${a.questionCount} MCQs` : isTest ? 'Written test' : 'Assignment'} />
                      {state === 'marked' ? <Chip tone="green" icon="ribbon" label={`${mark?.marks}/${mark?.maxMarks}`} /> : state === 'submitted' ? <Chip tone="blue" icon="checkmark" label="Submitted" /> : <Chip tone={overdue ? 'red' : 'amber'} icon="time" label={overdue ? 'Overdue' : 'To do'} />}
                    </View>
                    <Text style={s.title}>{a.title}</Text>
                    <Text style={s.meta}>{[a.subjectName, a.date ? `${isTest ? '' : 'Due '}${new Date(`${a.date}T12:00:00`).toLocaleDateString()}` : '', a.durationMinutes ? `${a.durationMinutes} min` : '', `${a.maxMarks} marks`].filter(Boolean).join(' · ')}</Text>
                    <View style={[s.row, { justifyContent: 'flex-end' }]}><Text style={{ color: sColors.primary, fontWeight: '700', fontSize: 13 }}>{state === 'pending' ? (a.questionCount ? 'Start quiz' : 'Open & submit') : 'View'}</Text><Ionicons name="chevron-forward" size={16} color={sColors.primary} /></View>
                  </Card>
                </Pressable>
              );
            })}
            {rows !== null && !shown.length && <EmptyState icon={isTest ? 'help-circle-outline' : 'document-attach-outline'} title={`No ${isTest ? 'tests' : 'assignments'} here`} text="New ones appear when your instructor publishes them for your batch." />}
          </>
        )}
      </ScrollView>
    </View>
  );
}
