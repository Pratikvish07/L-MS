import { useEffect, useState } from 'react';

import { useCurrentUser } from '@/hooks/useAuth';
import { subscribeMyEnrollments, type StudentEnrollment } from '@/services/student.service';

/**
 * The signed-in student's enrolments. `current` is the course/batch on the profile
 * (set by the admin when enrolling), falling back to the newest enrolment.
 */
export function useStudentEnrollment() {
  const user = useCurrentUser();
  const [enrollments, setEnrollments] = useState<StudentEnrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeMyEnrollments(user.uid, setEnrollments, (cause) => setError(cause.message)), [user.uid]);

  const rows = enrollments ?? [];
  const current = rows.find((e) => e.courseId === user.courseId && e.batchId === user.batchId)
    ?? rows.sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))[0]
    ?? (user.courseId && user.batchId ? { id: '', courseId: user.courseId, courseName: user.courseName ?? '', batchId: user.batchId, batchName: user.batchName ?? '', year: user.year ?? 0, purchaseId: '', couponCode: '', enrolledAt: '', status: 'approved' } : null);

  return { user, enrollments: rows, current, loading: enrollments === null && !error, error };
}
