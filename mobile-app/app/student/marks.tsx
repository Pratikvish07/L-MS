import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LoadingView } from '@/components/common/LoadingView';
import { Card, Chip, EmptyState, StudentHeader, studentStyles as s } from '@/components/student/StudentUi';
import { sColors, sRadius } from '@/constants/studentTheme';
import { useCurrentUser } from '@/hooks/useAuth';
import { subscribeMyMarks, type StudentMark } from '@/services/student.service';

const pct = (got: number, max: number) => (max ? Math.round((got / max) * 100) : 0);
const grade = (p: number) => (p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : p >= 40 ? 'E' : 'F');

/** All marks released to the student, grouped by subject, with an overall percentage and grade. */
export default function StudentMarksScreen() {
  const user = useCurrentUser();
  const [marks, setMarks] = useState<StudentMark[] | null>(null);
  useEffect(() => subscribeMyMarks(user.uid, setMarks, () => setMarks([])), [user.uid]);

  const marked = useMemo(() => (marks ?? []).filter((m) => m.marks !== null), [marks]);
  const got = marked.reduce((sum, m) => sum + (m.marks ?? 0), 0);
  const max = marked.reduce((sum, m) => sum + m.maxMarks, 0);
  const overall = pct(got, max);
  const bySubject = useMemo(() => {
    const map = new Map<string, StudentMark[]>();
    marked.forEach((m) => map.set(m.subjectName || 'Subject', [...(map.get(m.subjectName || 'Subject') ?? []), m]));
    return [...map.entries()];
  }, [marked]);

  return (
    <View style={s.screen}>
      <StudentHeader title="My Marks" />
      {marks === null ? <LoadingView /> : (
        <ScrollView contentContainerStyle={s.content}>
          {max > 0 && (
            <Card style={{ backgroundColor: sColors.primaryDark, borderColor: sColors.primaryDark }}>
              <Text style={{ color: '#DDD6FE', fontSize: 11, fontWeight: '800' }}>OVERALL</Text>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: sColors.white, fontSize: 28, fontWeight: '800' }}>{overall}%</Text>
                <Text style={styles.gradeBig}>{grade(overall)}</Text>
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: 12 }}>{got} of {max} marks across {marked.length} test{marked.length === 1 ? '' : 's'} and assignment{marked.length === 1 ? '' : 's'}</Text>
              <View style={styles.track}><View style={[styles.fill, { width: `${overall}%` }]} /></View>
            </Card>
          )}
          {bySubject.map(([subject, rows]) => {
            const sg = rows.reduce((n, m) => n + (m.marks ?? 0), 0);
            const sm = rows.reduce((n, m) => n + m.maxMarks, 0);
            return (
              <Card key={subject}>
                <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.sectionTitle}>{subject}</Text><Chip tone={pct(sg, sm) < 40 ? 'red' : 'green'} label={`${pct(sg, sm)}% · ${grade(pct(sg, sm))}`} /></View>
                {rows.map((m) => (
                  <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/student/assessment/[id]', params: { id: m.assessmentId } })} style={styles.markRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.title} numberOfLines={1}>{m.assessmentTitle}</Text>
                      <Text style={s.meta}>{m.assessmentType === 'test' ? 'Test' : 'Assignment'}{m.remarks ? ` · ${m.remarks}` : ''}</Text>
                    </View>
                    <Text style={[styles.markValue, pct(m.marks ?? 0, m.maxMarks) < 40 && { color: sColors.red }]}>{m.marks}/{m.maxMarks}</Text>
                  </Pressable>
                ))}
              </Card>
            );
          })}
          {!marked.length && <EmptyState icon="stats-chart-outline" title="No marks yet" text="Marks appear here once your instructor enters them for your tests and assignments." />}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gradeBig: { color: sColors.primaryDark, backgroundColor: '#DDD6FE', fontWeight: '800', fontSize: 18, paddingHorizontal: 12, paddingVertical: 4, borderRadius: sRadius.md, overflow: 'hidden' },
  track: { height: 8, borderRadius: 4, backgroundColor: sColors.primaryLight, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', backgroundColor: sColors.primary },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: sColors.border },
  markValue: { fontSize: 16, fontWeight: '800', color: sColors.primaryDark },
});
