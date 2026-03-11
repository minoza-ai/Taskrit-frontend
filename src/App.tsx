import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MyPage from './pages/MyPage';
import ProfilePage from './pages/ProfilePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import WorkspacePage from './pages/WorkspacePage';
import MarketplacePage from './pages/MarketplacePage';
import MembershipPage from './pages/MembershipPage';
import MessagesPage from './pages/MessagesPage';
import AppLayout from './components/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    if (accessToken) fetchUser();
  }, [accessToken, fetchUser]);

  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/workspace/:id" element={<WorkspacePage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/membership" element={<MembershipPage />} />
        <Route path="/messages" element={<MessagesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
