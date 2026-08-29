import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { PageLoadingFallback } from './components/ui/PageLoadingFallback';
import { useAuth } from './context/AuthContext';

// Route-based dynamic lazy imports
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const AssessmentPage = lazy(() => import('./pages/AssessmentPage').then((m) => ({ default: m.AssessmentPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const CalculatorPage = lazy(() => import('./pages/CalculatorPage').then((m) => ({ default: m.CalculatorPage })));
const CoachDashboardPage = lazy(() =>
  import('./pages/CoachDashboardPage').then((m) => ({ default: m.CoachDashboardPage })),
);
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ExerciseAlternativesPage = lazy(() =>
  import('./pages/ExerciseAlternativesPage').then((m) => ({ default: m.ExerciseAlternativesPage })),
);
const ExercisesPage = lazy(() => import('./pages/ExercisesPage').then((m) => ({ default: m.ExercisesPage })));
const ExplorePlansPage = lazy(() => import('./pages/ExplorePlansPage').then((m) => ({ default: m.ExplorePlansPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const OAuthCallbackPage = lazy(() =>
  import('./pages/OAuthCallbackPage').then((m) => ({ default: m.OAuthCallbackPage })),
);
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const PlanBuilderPage = lazy(() => import('./pages/PlanBuilderPage').then((m) => ({ default: m.PlanBuilderPage })));
const PlanPage = lazy(() => import('./pages/PlanPage').then((m) => ({ default: m.PlanPage })));
const SessionPage = lazy(() => import('./pages/SessionPage').then((m) => ({ default: m.SessionPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export { PageLoadingFallback };

function withSuspense(Component: ComponentType): ReactNode {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Component />
    </Suspense>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <PageLoadingFallback />;
  return isAuthenticated ? (
    <Suspense fallback={<PageLoadingFallback />}>
      <Outlet />
    </Suspense>
  ) : (
    <Navigate to="/auth" replace />
  );
}

export function PublicRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <PageLoadingFallback />;
  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Suspense fallback={<PageLoadingFallback />}>
      <Outlet />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/', element: withSuspense(LandingPage) },
      { path: '/auth', element: withSuspense(AuthPage) },
    ],
  },
  { path: '/oauth-callback', element: withSuspense(OAuthCallbackPage) },
  {
    element: <App />,
    children: [
      { path: '/explore', element: withSuspense(ExplorePlansPage) },
      // PT Portal currently disabled for public release; redirect to dashboard
      { path: '/coach', element: <Navigate to="/dashboard" replace /> },
      { path: '/tools/alternatives/:slug', element: withSuspense(ExerciseAlternativesPage) },
      { path: '/alternatives/:slug', element: withSuspense(ExerciseAlternativesPage) },
      { path: '/tools/alternatives', element: withSuspense(ExerciseAlternativesPage) },
      { path: '/alternatives', element: withSuspense(ExerciseAlternativesPage) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <App />,
        children: [
          { path: '/onboarding', element: withSuspense(OnboardingPage) },
          { path: '/assessment', element: withSuspense(AssessmentPage) },
          { path: '/dashboard', element: withSuspense(DashboardPage) },
          { path: '/exercises', element: withSuspense(ExercisesPage) },
          { path: '/calculator', element: withSuspense(CalculatorPage) },
          { path: '/tools/calculator', element: withSuspense(CalculatorPage) },
          { path: '/plan', element: withSuspense(PlanPage) },
          { path: '/plans/builder', element: withSuspense(PlanBuilderPage) },
          { path: '/builder', element: withSuspense(PlanBuilderPage) },
          { path: '/session', element: withSuspense(SessionPage) },
          { path: '/import', element: withSuspense(ImportPage) },
          { path: '/settings', element: withSuspense(SettingsPage) },
          { path: '/admin', element: withSuspense(AdminPage) },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
