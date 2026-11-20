import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { PageHead } from '../components/Layout';
import { friendlyError, subscribeBatchAssessments, type Assessment } from '../lib/assessments';
import { subscribeBatch, subscribeCourse, subscribeCourseEnrollments, type Course, type CourseBatch, type Enrollment } from '../lib/courses';
import { MarksMatrix } from './MarksMatrix';

/** Every test and assignment of a batch (all subjects) against every student. */
export function BatchMarksPage() {
  const { courseId = '', batchId = '' } = useParams<{ courseId: string; batchId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [batch, setBatch] = useState<CourseBatch | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const onError = (cause: Error) => setError(friendlyError(cause));
    const stops = [subscribeCourse(courseId, setCourse, onError), subscribeBatch(batchId, setBatch, onError), subscribeBatchAssessments(batchId, setAssessments, onError), subscribeCourseEnrollments(courseId, setEnrollments, onError)];
    return () => stops.forEach((stop) => stop());
  }, [courseId, batchId]);

  return (
    <>
      <PageHead title={`Marks · ${batch?.name ?? 'Batch'}`} subtitle={`${course?.title ?? ''} · all subjects`}>
        <button className="btn btn-outline" onClick={() => navigate(`/courses/${courseId}/batches/${batchId}`)}><ArrowLeft size={16} /> {batch?.name ?? 'Batch'}</button>
      </PageHead>
      {error && <div className="alert" role="alert">{error}</div>}
      <MarksMatrix assessments={assessments} batches={batch ? [batch] : []} enrollments={enrollments} fixedBatchId={batchId} />
    </>
  );
}
