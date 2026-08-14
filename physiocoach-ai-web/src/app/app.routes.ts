import { Routes } from '@angular/router';

import { authGuard, unauthGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';
import { AppShellComponent } from './core/layout/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.page').then((component) => component.LandingPage),
  },
  {
    path: 'auth',
    loadComponent: () =>
      import('./features/auth/auth.page').then((component) => component.AuthPage),
    canActivate: [unauthGuard],
  },
  {
    path: 'oauth-callback',
    loadComponent: () =>
      import('./features/oauth-callback/oauth-callback.page').then(
        (component) => component.OauthCallbackPage,
      ),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'onboarding',
        loadComponent: () =>
          import('./features/onboarding/onboarding.page').then(
            (component) => component.OnboardingPage,
          ),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then(
            (component) => component.DashboardPage,
          ),
      },
      {
        path: 'plan',
        loadComponent: () =>
          import('./features/workout-plan/workout-plan.page').then(
            (component) => component.WorkoutPlanPage,
          ),
      },
      {
        path: 'session',
        loadComponent: () =>
          import('./features/workout-session/workout-session.page').then(
            (component) => component.WorkoutSessionPage,
          ),
      },
      {
        path: 'workout-plan',
        redirectTo: 'plan',
        pathMatch: 'full',
      },
      {
        path: 'workout-session',
        redirectTo: 'session',
        pathMatch: 'full',
      },
      {
        path: 'progress',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'posture-assessment',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((component) => component.SettingsPage),
      },
      {
        path: 'measurements',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/admin.page').then((component) => component.AdminPage),
        canActivate: [authGuard, adminGuard],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
