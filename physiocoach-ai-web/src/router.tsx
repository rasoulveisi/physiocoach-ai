import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { useAuth } from './context/AuthContext';
import { AdminPage } from './pages/AdminPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { LandingPage } from './pages/LandingPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PlanPage } from './pages/PlanPage';
import { SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';
import { ImportPage } from './pages/ImportPage';

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 font-bold text-white">
      <span className="animate-pulse">Loading PhysioCoach…</span>
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
}

export function PublicRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/auth', element: <AuthPage /> },
    ],
  },
  { path: '/oauth-callback', element: <OAuthCallbackPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <App />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          { path: '/assessment', element: <AssessmentPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/exercises', element: <ExercisesPage /> },
          { path: '/plan', element: <PlanPage /> },
          { path: '/session', element: <SessionPage /> },
          { path: '/import', element: <ImportPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/admin', element: <AdminPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
