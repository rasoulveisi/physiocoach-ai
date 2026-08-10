import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';

interface RouteConfig {
  path?: string;
  redirectTo?: string;
  children?: RouteConfig[];
  canActivate?: unknown[];
  loadComponent?: unknown;
}

describe('app.routes', () => {
  it('defines canonical /plan and /session routes', () => {
    const shellRoute = routes.find((route) => route.path === '' && route.pathMatch === undefined);
    const children = (shellRoute?.children ?? []) as RouteConfig[];

    const planRoute = children.find((route) => route.path === 'plan');
    const sessionRoute = children.find((route) => route.path === 'session');
    const legacyPlanRoute = children.find((route) => route.path === 'workout-plan');
    const legacySessionRoute = children.find((route) => route.path === 'workout-session');

    expect(planRoute?.loadComponent).toBeTruthy();
    expect(sessionRoute?.loadComponent).toBeTruthy();
    expect(legacyPlanRoute?.redirectTo).toBe('plan');
    expect(legacySessionRoute?.redirectTo).toBe('session');
  });

  it('adds new core and internal routes', () => {
    const shellRoute = routes.find((route) => route.path === '' && route.pathMatch === undefined);
    const children = (shellRoute?.children ?? []) as RouteConfig[];

    expect(children.some((route) => route.path === 'measurements')).toBe(true);
    expect(children.some((route) => route.path === 'admin')).toBe(true);
  });

  it('does not block normal app routes behind onboarding completion', () => {
    const shellRoute = routes.find((route) => route.path === '' && route.pathMatch === undefined);
    const children = (shellRoute?.children ?? []) as RouteConfig[];
    const normalAppPaths = [
      'dashboard',
      'plan',
      'session',
      'progress',
      'posture-assessment',
      'settings',
      'measurements',
    ];

    for (const path of normalAppPaths) {
      const route = children.find((candidate) => candidate.path === path);
      expect(route?.loadComponent).toBeTruthy();
      expect(route?.canActivate).toBeUndefined();
    }
  });
});
