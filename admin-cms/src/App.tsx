import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AuthProvider, useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { StoreProvider } from './lib/store';
import { CatalogPage } from './pages/Catalog';
import { DashboardPage } from './pages/Dashboard';
import { PeoplePage } from './pages/Faculty';
import { LiveUploadsPage } from './pages/LiveUploads';
import { LoginPage } from './pages/Login';
import { RecordingDetailPage } from './pages/RecordingDetail';
import { RecordingsPage } from './pages/Recordings';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

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
          <Route path="recordings/:id" element={<RecordingDetailPage />} />
          <Route path="live" element={<LiveUploadsPage />} />
          <Route path="faculty" element={<PeoplePage mode="faculty" />} />
          <Route path="classrooms" element={<CatalogPage tab="classrooms" />} />
          <Route path="subjects" element={<CatalogPage tab="subjects" />} />
          <Route path="users" element={<PeoplePage mode="users" />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
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
