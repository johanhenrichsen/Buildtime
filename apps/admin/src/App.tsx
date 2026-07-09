import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getUser } from './lib/auth';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import WorkersPage from './pages/WorkersPage';
import EnrollmentPage from './pages/EnrollmentPage';
import DtrPage from './pages/DtrPage';
import FlaggedPage from './pages/FlaggedPage';
import AuditPage from './pages/AuditPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/workers" replace />} />
          <Route path="workers"    element={<WorkersPage />} />
          <Route path="enrollment" element={<EnrollmentPage />} />
          <Route path="dtr"        element={<DtrPage />} />
          <Route path="flagged"    element={<FlaggedPage />} />
          <Route path="audit"      element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
