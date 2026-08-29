import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

/** Helper: send POST /api/v1/workout-plans/audit */
async function postAudit(body: unknown) {
  const app = createApp();
  return app.fetch(
    '/api/v1/workout-plans/audit',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'test-audit-user' },
      body: JSON.stringify(body),
    },
    mockEnv,
  );
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

const balancedPlan = {
  planJson: {
    days: [
      {
        exercises: [
          { name: 'Bench Press', movementPattern: 'push', muscleGroup: 'chest', sets: 3 },
          { name: 'Barbell Row', movementPattern: 'pull', muscleGroup: 'back', sets: 3 },
          { name: 'Overhead Press', movementPattern: 'push', muscleGroup: 'chest', sets: 3 },
          { name: 'Pull Up', movementPattern: 'pull', muscleGroup: 'back', sets: 3 },
        ],
      },
    ],
  },
};

const pushHeavyPlan = {
  planJson: {
    days: [
      {
        exercises: [
          { name: 'Bench Press', movementPattern: 'push', muscleGroup: 'chest', sets: 6 },
          { name: 'Incline Press', movementPattern: 'push', muscleGroup: 'chest', sets: 5 },
          { name: 'Cable Fly', movementPattern: 'push', muscleGroup: 'chest', sets: 4 },
          { name: 'Overhead Press', movementPattern: 'push', muscleGroup: 'chest', sets: 4 },
          // Only 1 pull
          { name: 'Face Pull', movementPattern: 'pull', muscleGroup: 'back', sets: 2 },
        ],
      },
    ],
  },
};

const mrvViolationPlan = {
  planJson: {
    days: [
      {
        exercises: [
          // chest gets 28 sets — well over MRV of 25
          { name: 'Bench Press', movementPattern: 'push', muscleGroup: 'chest', sets: 10 },
          { name: 'Incline Press', movementPattern: 'push', muscleGroup: 'chest', sets: 9 },
          { name: 'Cable Fly', movementPattern: 'push', muscleGroup: 'chest', sets: 9 },
          { name: 'Barbell Row', movementPattern: 'pull', muscleGroup: 'back', sets: 4 },
        ],
      },
    ],
  },
};

const jointShearPlan = {
  planJson: {
    days: [
      {
        exercises: [
          { name: 'Leg Press', movementPattern: 'squat', muscleGroup: 'quads', sets: 4 },
          { name: 'Barbell Squat', movementPattern: 'squat', muscleGroup: 'quads', sets: 3 },
          { name: 'Behind Neck Pulldown', movementPattern: 'pull', muscleGroup: 'back', sets: 3 },
          { name: 'Bench Press', movementPattern: 'push', muscleGroup: 'chest', sets: 3 },
        ],
      },
    ],
  },
};

const emptyDaysPlan = {
  planJson: {
    days: [{ exercises: [] }],
  },
};

const spinalOverloadPlan = {
  planJson: {
    days: [
      {
        exercises: Array.from({ length: 16 }, (_, i) => ({
          name: `Squat Variation ${i + 1}`,
          movementPattern: 'squat',
          muscleGroup: 'quads',
          sets: 1,
        })),
      },
    ],
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('E2E: Plan Safety Audit API (POST /api/v1/workout-plans/audit)', () => {
  it('returns 200 with certified badge for a balanced plan', async () => {
    const res = await postAudit(balancedPlan);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      auditLogId: string;
      traceId: string;
      certified: boolean;
      score: number;
      badge: string;
      checks: Array<{ id: string; passed: boolean; severity: string }>;
    };

    expect(json.auditLogId).toBeTruthy();
    expect(json.traceId).toBeTruthy();
    expect(json.score).toBeGreaterThanOrEqual(80);
    expect(json.badge).toBe('PhysioCoach Certified Safe');
    expect(json.certified).toBe(true);
    expect(Array.isArray(json.checks)).toBe(true);
    expect(json.checks.length).toBeGreaterThan(0);
    // All checks should pass for a balanced plan
    const pushPullCheck = json.checks.find((c) => c.id === 'push_pull_balance');
    expect(pushPullCheck?.passed).toBe(true);
  });

  it('flags push:pull imbalance when push volume far exceeds pull', async () => {
    const res = await postAudit(pushHeavyPlan);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      certified: boolean;
      score: number;
      badge: string;
      checks: Array<{ id: string; passed: boolean; severity: string; fixSuggestion?: string }>;
    };

    const ppCheck = json.checks.find((c) => c.id === 'push_pull_balance');
    expect(ppCheck).toBeDefined();
    expect(ppCheck?.passed).toBe(false);
    expect(['warning', 'critical']).toContain(ppCheck?.severity);
    expect(ppCheck?.fixSuggestion).toBeTruthy();
    expect(json.certified).toBe(false);
  });

  it('flags MRV violation when weekly muscle volume exceeds 25 sets', async () => {
    const res = await postAudit(mrvViolationPlan);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      certified: boolean;
      checks: Array<{ id: string; passed: boolean; message: string }>;
    };

    const volCheck = json.checks.find((c) => c.id === 'weekly_volume');
    expect(volCheck).toBeDefined();
    expect(volCheck?.passed).toBe(false);
    expect(volCheck?.message).toMatch(/MRV/i);
  });

  it('flags critical joint shear risk for leg press and behind-neck exercises', async () => {
    const res = await postAudit(jointShearPlan);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      certified: boolean;
      badge: string;
      checks: Array<{ id: string; passed: boolean; severity: string; fixSuggestion?: string }>;
    };

    const shearCheck = json.checks.find((c) => c.id === 'joint_shear_risk');
    expect(shearCheck).toBeDefined();
    expect(shearCheck?.passed).toBe(false);
    expect(shearCheck?.severity).toBe('critical');
    expect(shearCheck?.fixSuggestion).toBeTruthy();
    expect(json.badge).toBe('Medical Review Required');
  });

  it('returns 200 with valid response for empty days (passes all volume checks)', async () => {
    const res = await postAudit(emptyDaysPlan);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      auditLogId: string;
      traceId: string;
      certified: boolean;
      score: number;
      badge: string;
      checks: unknown[];
    };

    expect(json.auditLogId).toBeTruthy();
    expect(json.traceId).toBeTruthy();
    expect(json.checks).toHaveLength(4);
    // Empty plan trivially passes volume checks (no exercises to violate)
    expect(json.score).toBeGreaterThan(0);
  });

  it('flags spinal overload when more than 15 spinal-loading exercises per week', async () => {
    const res = await postAudit(spinalOverloadPlan);

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      certified: boolean;
      checks: Array<{ id: string; passed: boolean; severity: string }>;
    };

    const spinalCheck = json.checks.find((c) => c.id === 'spinal_load');
    expect(spinalCheck).toBeDefined();
    expect(spinalCheck?.passed).toBe(false);
    expect(spinalCheck?.severity).toBe('warning');
    // Score is reduced but may still be above 80 with only a single warning
    // The key assertion: the check is flagged and the plan is not trivially clean
    expect(json.checks.some((c) => !c.passed)).toBe(true);
  });

  it('returns 409 when planJson field is missing from body', async () => {
    const res = await postAudit({ wrongField: 'some_value' });

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; details: unknown } };
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe('invalid_request');
  });

  it('returns 409 when body is empty or not JSON', async () => {
    const app = createApp();
    const res = await app.fetch(
      '/api/v1/workout-plans/audit',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      },
      mockEnv,
    );

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('invalid_request');
  });
});
