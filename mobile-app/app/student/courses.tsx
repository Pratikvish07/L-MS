import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingView } from '@/components/common/LoadingView';
import { Card, Chip, EmptyState, StudentButton, StudentHeader, studentStyles as s } from '@/components/student/StudentUi';
import { STUDENT_HOME, sColors, sRadius } from '@/constants/studentTheme';
import { useStudentEnrollment } from '@/hooks/useStudent';
import {
  couponOffer, couponUsable, requestEnrollment, subscribeCoupons, subscribeLiveCourses, subscribeMyRequests,
  type EnrollmentRequest, type PublicCourse, type StudentCoupon,
} from '@/services/student.service';
import { goBack } from '@/utils/navigation';

/** All courses open for enrolment, with live coupons and a "Request enrolment" button. */
export default function LiveCoursesScreen() {
  const { user, enrollments } = useStudentEnrollment();
  const [courses, setCourses] = useState<PublicCourse[] | null>(null);
  const [coupons, setCoupons] = useState<StudentCoupon[]>([]);
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stops = [
      subscribeLiveCourses(setCourses, (cause) => setError(cause.message)),
      subscribeCoupons(setCoupons, () => setCoupons([])),
      subscribeMyRequests(user.uid, setRequests, () => setRequests([])),
    ];
    return () => stops.forEach((stop) => stop());
  }, [user.uid]);

  const request = async (course: PublicCourse) => {
    const code = (codes[course.id] ?? '').trim().toUpperCase();
    if (code && !coupons.some((c) => c.code === code && couponUsable(c, course.id))) { setError(`Coupon ${code} is not valid for ${course.title}.`); return; }
    setBusy(course.id); setError(null);
    try { await requestEnrollment(user, course, code); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send the request.'); } finally { setBusy(''); }
  };

  return (
    <View style={s.screen}>
      <StudentHeader title="Explore Courses" onBack={() => goBack(STUDENT_HOME)} />
      {!courses ? <LoadingView message="Loading courses…" /> : (
        <ScrollView contentContainerStyle={s.content}>
          {error && <ErrorBanner message={error} />}
          {courses.map((course) => {
            const live = coupons.filter((c) => couponUsable(c, course.id));
            const enrolled = enrollments.find((e) => e.courseId === course.id);
            const pending = requests.find((r) => r.courseId === course.id);
            return (
              <Card key={course.id}>
                {course.imageUrl ? <Image source={{ uri: course.imageUrl }} style={styles.image} accessibilityIgnoresInvertColors /> : null}
                <Text style={s.sectionTitle}>{course.title}</Text>
                {[course.category, course.level].some(Boolean) && <Text style={s.meta}>{[course.category, course.level].filter(Boolean).join(' · ')}</Text>}
                {course.description ? <Text style={styles.description}>{course.description}</Text> : null}
                {live.length > 0 && (
                  <View style={{ gap: 6 }}>
                    {live.map((c) => <Chip key={c.id} tone="green" icon="pricetag" label={`${c.code}: ${couponOffer(c)}`} />)}
                  </View>
                )}
                {enrolled ? <Chip tone="green" icon="checkmark-circle" label={`Enrolled · ${enrolled.batchName}`} />
                  : pending?.status === 'pending' ? <Chip tone="amber" icon="time" label="Request sent. Waiting for the admin." />
                  : pending?.status === 'rejected' ? <Chip tone="red" icon="close-circle" label={`Request declined${pending.note ? `: ${pending.note}` : ''}`} />
                  : (
                    <>
                      {live.length > 0 && <TextInput style={styles.code} placeholder="Coupon code (optional)" placeholderTextColor="#9CA3AF" autoCapitalize="characters" value={codes[course.id] ?? ''} onChangeText={(v) => setCodes((cur) => ({ ...cur, [course.id]: v }))} />}
                      <StudentButton title="Request enrolment" icon="paper-plane-outline" onPress={() => void request(course)} loading={busy === course.id} />
                    </>
                  )}
              </Card>
            );
          })}
          {!courses.length && <EmptyState icon="storefront-outline" title="No courses open right now" text="Check back later. New courses appear here when the university publishes them." />}
          <Text style={s.meta}>The administrator confirms your enrolment and batch, then the course appears in My Course.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: sRadius.md, backgroundColor: sColors.background },
  description: { color: sColors.text, fontSize: 13, lineHeight: 19 },
  code: { borderWidth: 1, borderColor: sColors.border, borderRadius: sRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: sColors.text, backgroundColor: sColors.surface },
});
