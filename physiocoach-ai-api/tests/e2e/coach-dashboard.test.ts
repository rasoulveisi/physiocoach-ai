import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Post-Discharge Rehab Dashboard for PTs (/coach)', () => {
  it('GET /coach/clients and /api/v1/coach/clients returns client roster and clinical metrics', async () => {
    const app = createApp();

    // 1. Fetch from root /coach/clients
    const rootRes = await app.fetch('/coach/clients', { method: 'GET' }, mockEnv);
    expect(rootRes.status).toBe(200);
    const rootJson = (await rootRes.json()) as {
      data: Array<{
        id: string;
        clientName: string;
        injuryDiagnosis: string;
        status: string;
        complianceScore: number;
        currentPlan: { id: string; title: string } | null;
        lastSession: { avgRpe: number; painScore: number } | null;
      }>;
      stats: {
        totalPatients: number;
        activePatients: number;
        adherenceRate: number;
        painAlertsCount: number;
        graduatedCount: number;
        clinicName: string;
      };
      total: number;
    };

    expect(Array.isArray(rootJson.data)).toBe(true);
    expect(rootJson.total).toBeGreaterThanOrEqual(1);
    expect(rootJson.stats).toBeDefined();
    expect(rootJson.stats.totalPatients).toBeGreaterThanOrEqual(1);
    expect(rootJson.stats.clinicName).toBeDefined();

    // 2. Fetch from /api/v1/coach/clients
    const apiRes = await app.fetch('/api/v1/coach/clients', { method: 'GET' }, mockEnv);
    expect(apiRes.status).toBe(200);
    const apiJson = (await apiRes.json()) as typeof rootJson;
    expect(apiJson.data.length).toBe(rootJson.data.length);

    // Verify first client structure
    const sampleClient = rootJson.data[0];
    expect(sampleClient).toBeDefined();
    if (!sampleClient) throw new Error('Expected at least one sample client');
    expect(sampleClient.clientName).toBeDefined();
    expect(sampleClient.injuryDiagnosis).toBeDefined();
    expect(sampleClient.complianceScore).toBeGreaterThanOrEqual(0);

  });

  it('filters clients by status and search query', async () => {
    const app = createApp();

    // Filter by status=graduated
    const statusRes = await app.fetch(
      '/api/v1/coach/clients?status=graduated',
      { method: 'GET' },
      mockEnv,
    );
    expect(statusRes.status).toBe(200);
    const statusJson = (await statusRes.json()) as { data: Array<{ status: string }> };
    expect(statusJson.data.every((c) => c.status === 'graduated')).toBe(true);

    // Filter by search query
    const searchRes = await app.fetch(
      '/api/v1/coach/clients?search=Marcus',
      { method: 'GET' },
      mockEnv,
    );
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as { data: Array<{ clientName: string }> };
    expect(searchJson.data.some((c) => c.clientName.includes('Marcus'))).toBe(true);
  });

  it('POST /coach/clients validates input and enrolls a new post-discharge client', async () => {
    const app = createApp();

    // 1. Invalid payload: missing required fields
    const invalidRes = await app.fetch(
      '/api/v1/coach/clients',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: 'J', // too short
          clientEmail: 'not-an-email',
        }),
      },
      mockEnv,
    );
    expect(invalidRes.status).toBe(400);

    // 2. Valid enrollment payload
    const newClientPayload = {
      clientName: 'Jordan Taylor',
      clientEmail: 'jordan.taylor@example.com',
      injuryDiagnosis: 'Post-Op Meniscus Repair (Lateral)',
      dischargeDate: '2026-08-15',
      status: 'active',
      complianceScore: 100,
      clinicalNotes: 'Avoid deep knee flexion beyond 90 degrees for first 4 weeks.',
      assignedPlanId: 'plan-meniscus-recovery-v1',
      assignedPlanTitle: 'Meniscus Controlled Loading Protocol',
    };

    const createRes = await app.fetch(
      '/api/v1/coach/clients',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newClientPayload),
      },
      mockEnv,
    );

    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as {
      success: boolean;
      data: {
        id: string;
        clientName: string;
        clientEmail: string;
        injuryDiagnosis: string;
        currentPlan: { id: string; title: string } | null;
      };
    };

    expect(createJson.success).toBe(true);
    expect(createJson.data.id).toBeDefined();
    expect(createJson.data.clientName).toBe('Jordan Taylor');
    expect(createJson.data.injuryDiagnosis).toBe('Post-Op Meniscus Repair (Lateral)');
    expect(createJson.data.currentPlan?.id).toBe('plan-meniscus-recovery-v1');

    // 3. Verify newly created client appears in client list
    const listRes = await app.fetch('/api/v1/coach/clients', { method: 'GET' }, mockEnv);
    const listJson = (await listRes.json()) as { data: Array<{ id: string; clientName: string }> };
    expect(listJson.data.some((c) => c.id === createJson.data.id)).toBe(true);
  });

  it('POST /coach/clients/assign-plan prescribes routine with clinical notes', async () => {
    const app = createApp();

    const assignPayload = {
      clientId: 'pt-client-001',
      workoutPlanId: 'plan-patellar-progression-stage-2',
      planTitle: 'Patellar Tendon Stage 2 Energy Storage Routine',
      clinicalNotes: 'Introduce low-amplitude pogo hops. Monitor morning stiffness.',
      targetFrequencyDays: 3,
    };

    const assignRes = await app.fetch(
      '/api/v1/coach/clients/assign-plan',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(assignPayload),
      },
      mockEnv,
    );

    expect(assignRes.status).toBe(201);
    const assignJson = (await assignRes.json()) as {
      success: boolean;
      data: {
        id: string;
        clientId: string;
        workoutPlanId: string;
        planTitle: string;
        clinicalNotes: string;
      };
    };

    expect(assignJson.success).toBe(true);
    expect(assignJson.data.workoutPlanId).toBe('plan-patellar-progression-stage-2');
    expect(assignJson.data.clinicalNotes).toContain('pogo hops');

    // Verify updated current plan on client
    const clientListRes = await app.fetch('/api/v1/coach/clients', { method: 'GET' }, mockEnv);
    const clientListJson = (await clientListRes.json()) as {
      data: Array<{ id: string; currentPlan: { id: string; title: string } | null }>;
    };
    const target = clientListJson.data.find((c) => c.id === 'pt-client-001');
    expect(target?.currentPlan?.id).toBe('plan-patellar-progression-stage-2');
  });

  it('GET /coach/clients/:id/adherence returns weekly metrics, RPE trends, and clinical flags', async () => {
    const app = createApp();

    // 1. Non-existent client returns 404
    const notFoundRes = await app.fetch(
      '/api/v1/coach/clients/non-existent-id/adherence',
      { method: 'GET' },
      mockEnv,
    );
    expect(notFoundRes.status).toBe(404);

    // 2. Existing client adherence telemetry
    const adherenceRes = await app.fetch(
      '/api/v1/coach/clients/pt-client-001/adherence',
      { method: 'GET' },
      mockEnv,
    );

    expect(adherenceRes.status).toBe(200);
    const adherenceJson = (await adherenceRes.json()) as {
      data: {
        clientId: string;
        clientName: string;
        complianceScore: number;
        weeklyAdherence: Array<{
          week: string;
          sessionsPlanned: number;
          sessionsCompleted: number;
          adherencePct: number;
        }>;
        rpeTrend: Array<{
          date: string;
          avgRpe: number;
          painLevel: number;
          completedSets: number;
        }>;
        recentSessions: Array<{
          id: string;
          date: string;
          workoutName: string;
          rpe: number;
          painReported: number;
        }>;
        clinicalFlags: Array<{
          type: string;
          message: string;
          severity: string;
        }>;
      };
    };

    expect(adherenceJson.data.clientId).toBe('pt-client-001');
    expect(adherenceJson.data.clientName).toBe('Sarah Jenkins');
    expect(Array.isArray(adherenceJson.data.weeklyAdherence)).toBe(true);
    expect(adherenceJson.data.weeklyAdherence.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(adherenceJson.data.rpeTrend)).toBe(true);
    expect(adherenceJson.data.rpeTrend.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(adherenceJson.data.recentSessions)).toBe(true);
    expect(Array.isArray(adherenceJson.data.clinicalFlags)).toBe(true);
  });

  it('GET /coach/stats returns aggregated clinic metrics', async () => {
    const app = createApp();
    const statsRes = await app.fetch('/api/v1/coach/stats', { method: 'GET' }, mockEnv);
    expect(statsRes.status).toBe(200);
    const statsJson = (await statsRes.json()) as {
      data: {
        totalPatients: number;
        activePatients: number;
        adherenceRate: number;
        painAlertsCount: number;
      };
    };

    expect(statsJson.data.totalPatients).toBeGreaterThanOrEqual(1);
    expect(statsJson.data.adherenceRate).toBeGreaterThanOrEqual(0);
  });
});
