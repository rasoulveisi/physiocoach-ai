import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Public Explore Workout Plans Feed & Clone Workflow', () => {
  it('returns all verified curated clinical templates by default', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/explore/plans',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: Array<{
        id: string;
        title: string;
        split: string;
        frequencyDays: number;
        experienceLevel: string;
        jointTags: string[];
        targetPersonas: string[];
        totalWeeklySets: number;
        author: { name: string; verified: boolean };
        cloneCount: number;
        days: Array<{ dayNumber: number; exercises: unknown[] }>;
      }>;
      total: number;
    };

    expect(json.data.length).toBeGreaterThanOrEqual(4);
    expect(json.total).toBeGreaterThanOrEqual(4);

    const ids = json.data.map((p) => p.id);
    expect(ids).toContain('template-ppl-knee-safe');
    expect(ids).toContain('template-desk-worker-posture');
    expect(ids).toContain('template-fullbody-minimalist');
    expect(ids).toContain('template-shoulder-safe-hypertrophy');

    // Verify properties of PPL Knee-Safe
    const ppl = json.data.find((p) => p.id === 'template-ppl-knee-safe');
    expect(ppl).toBeDefined();
    expect(ppl?.split).toBe('push_pull_legs');
    expect(ppl?.jointTags).toContain('Knee-Friendly');
    expect(ppl?.targetPersonas).toContain('Athletes with Patellar Tendinopathy');
    expect(ppl?.days.length).toBe(3);
    expect(ppl?.author.verified).toBe(true);
  });

  it('filters explore plans by split parameter', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/explore/plans?split=push_pull_legs',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: Array<{ id: string; split: string }> };
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.data.every((p) => p.split === 'push_pull_legs')).toBe(true);
  });

  it('filters explore plans by injuryFilter parameter', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/explore/plans?injuryFilter=knee_friendly',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: Array<{ id: string; jointTags: string[]; targetPersonas: string[] }>;
    };
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.data.some((p) => p.id === 'template-ppl-knee-safe')).toBe(true);
  });

  it('filters explore plans by experienceLevel parameter', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/explore/plans?experienceLevel=beginner',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      data: Array<{ id: string; experienceLevel: string }>;
    };
    expect(json.data.length).toBeGreaterThanOrEqual(2);
    expect(json.data.every((p) => p.experienceLevel === 'beginner')).toBe(true);
  });

  it('filters explore plans by search query', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/explore/plans?search=desk',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: Array<{ id: string; title: string }> };
    expect(json.data.length).toBeGreaterThanOrEqual(1);
    expect(json.data.some((p) => p.id === 'template-desk-worker-posture')).toBe(true);
  });

  it('supports retrieving single explore plan by id', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/explore/plans/template-desk-worker-posture',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: { id: string; title: string } };
    expect(json.data.id).toBe('template-desk-worker-posture');
    expect(json.data.title).toContain('Desk-Worker Posture');
  });

  it('clones a verified template workout plan into user active routine', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-plans/template-ppl-knee-safe/clone',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      mockEnv,
    );

    expect(response.status).toBe(201);
    const json = (await response.json()) as {
      data: {
        id: string;
        plan: { days: Array<{ dayNumber: number; exercises: unknown[] }> };
      };
    };

    expect(json.data).toBeDefined();
    expect(json.data.id).toBeDefined();
    expect(json.data.plan.days.length).toBe(3);
  });

  it('submits a 5-star rating with review and aggregates scores for explore plan', async () => {
    const app = createApp();

    const rateRes = await app.fetch(
      '/api/v1/workout-plans/template-ppl-knee-safe/rate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: 5,
          review: 'Incredible routine! My patellar pain vanished after 3 weeks.',
        }),
      },
      mockEnv,
    );

    expect(rateRes.status).toBe(200);
    const rateJson = (await rateRes.json()) as {
      success: boolean;
      data: {
        planId: string;
        rating: number;
        reviewsCount: number;
        userRating: number;
      };
    };

    expect(rateJson.success).toBe(true);
    expect(rateJson.data.planId).toBe('template-ppl-knee-safe');
    expect(rateJson.data.userRating).toBe(5);
    expect(rateJson.data.reviewsCount).toBeGreaterThanOrEqual(1);

    // Verify rating appears on single explore plan endpoint
    const singleRes = await app.fetch(
      '/api/v1/explore/plans/template-ppl-knee-safe',
      { method: 'GET' },
      mockEnv,
    );
    expect(singleRes.status).toBe(200);
    const singleJson = (await singleRes.json()) as {
      data: { id: string; rating: number; reviewsCount: number };
    };
    expect(singleJson.data.reviewsCount).toBeGreaterThanOrEqual(1);
  });

  it('preserves forking lineage when cloning and publishing a routine', async () => {
    const app = createApp();

    // 1. Clone a template
    const cloneRes = await app.fetch(
      '/api/v1/workout-plans/template-shoulder-safe-hypertrophy/clone',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      mockEnv,
    );
    expect(cloneRes.status).toBe(201);
    const cloneJson = (await cloneRes.json()) as { data: { id: string } };
    const clonedId = cloneJson.data.id;

    // 2. Publish the cloned plan
    const publishRes = await app.fetch(
      `/api/v1/workout-plans/${clonedId}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      mockEnv,
    );
    expect(publishRes.status).toBe(200);

    // 3. Verify in explore feed that forkedFrom lineage is present
    const exploreRes = await app.fetch('/api/v1/explore/plans', { method: 'GET' }, mockEnv);
    expect(exploreRes.status).toBe(200);
    const exploreJson = (await exploreRes.json()) as {
      data: Array<{
        id: string;
        forkedFrom?: { planId: string; authorName: string; planTitle?: string };
      }>;
    };

    const publishedPlan = exploreJson.data.find((p) => p.id === clonedId);
    expect(publishedPlan).toBeDefined();
    expect(publishedPlan?.forkedFrom).toBeDefined();
    expect(publishedPlan?.forkedFrom?.planId).toBe('template-shoulder-safe-hypertrophy');
  });

  it('deletes a plan from user library via DELETE /workout-plans/:planId', async () => {
    const app = createApp();

    // 1. Clone a plan
    const cloneRes = await app.fetch(
      '/api/v1/workout-plans/template-fullbody-minimalist/clone',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      mockEnv,
    );
    expect(cloneRes.status).toBe(201);
    const cloneJson = (await cloneRes.json()) as { data: { id: string } };
    const planId = cloneJson.data.id;

    // 2. Delete the plan
    const deleteRes = await app.fetch(
      `/api/v1/workout-plans/${planId}`,
      { method: 'DELETE' },
      mockEnv,
    );
    expect(deleteRes.status).toBe(200);
    const deleteJson = (await deleteRes.json()) as { success: boolean; data: { id: string; deleted: boolean } };
    expect(deleteJson.success).toBe(true);
    expect(deleteJson.data.id).toBe(planId);
    expect(deleteJson.data.deleted).toBe(true);
  });
});
