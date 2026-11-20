import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';

import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { StoreProvider } from './lib/store';
import { CatalogPage } from './pages/Catalog';
import { DashboardPage } from './pages/Dashboard';
import { UsersPage, UsersRoute } from './pages/Users';
import { LecturesPage } from './pages/Lectures';
import { CouponsPage } from './pages/Coupons';
import { StudentDetailPage } from './pages/StudentDetail';
import { SubjectPage } from './pages/SubjectPage';
import { AssessmentDetailPage } from './pages/AssessmentDetail';
import { BatchMarksPage } from './pages/BatchMarks';
import { BatchLecturesPage } from './pages/BatchLectures';
import { LiveUploadsPage } from './pages/LiveUploads';
import { LoginPage } from './pages/Login';
import { RecordingDetailPage } from './pages/RecordingDetail';
import { RecordingsPage } from './pages/Recordings';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { AdminModulePage } from './pages/AdminModule';
import { AdminModulesIndexPage } from './pages/AdminModulesIndex';
import { BatchPage, CoursePage, CoursesPage } from './pages/Courses';
import { MediaManagerPage } from './pages/MediaManager';

function CourseRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/courses/${id}`} replace />;
}

function Gate() {
  const { status } = useAuth();
  if (status === 'loading') return <Spinner />;
  if (status !== 'admin') return <LoginPage />;

  return (
    <StoreProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="recordings" element={<RecordingsPage />} />
          <Route path="lectures" element={<LecturesPage />} />
          <Route path="coupons" element={<CouponsPage />} />
          <Route path="students/:uid" element={<StudentDetailPage />} />
          <Route path="modules/coupons" element={<Navigate to="/coupons" replace />} />
          <Route path="media" element={<MediaManagerPage />} />
          <Route path="recordings/:id" element={<RecordingDetailPage />} />
          <Route path="live" element={<LiveUploadsPage />} />
          <Route path="faculty" element={<UsersPage only="faculty" />} />
          <Route path="classrooms" element={<CatalogPage tab="classrooms" />} />
          <Route path="subjects" element={<CatalogPage tab="subjects" />} />
          <Route path="users" element={<UsersRoute />} />
          <Route path="modules/users" element={<Navigate to="/users" replace />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="modules" element={<AdminModulesIndexPage />} />
          <Route path="modules/:moduleId" element={<AdminModulePage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="courses/:courseId" element={<CoursePage />} />
          <Route path="courses/:courseId/batches/:batchId" element={<BatchPage />} />
          <Route path="courses/:courseId/batches/:batchId/lectures" element={<BatchLecturesPage />} />
          <Route path="courses/:courseId/batches/:batchId/marks" element={<BatchMarksPage />} />
          <Route path="courses/:courseId/subjects/:subjectId" element={<SubjectPage />} />
          <Route path="courses/:courseId/subjects/:subjectId/assessments/:assessmentId" element={<AssessmentDetailPage />} />
          {/* Old links: courses, batches and subjects are managed from the course pages now. */}
          <Route path="modules/courses" element={<Navigate to="/courses" replace />} />
          <Route path="modules/courses/:id" element={<CourseRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
