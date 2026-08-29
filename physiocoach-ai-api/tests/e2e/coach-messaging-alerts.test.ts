import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Feature 4.3 Coach-Client Async Review & Pain Alerts', () => {
  it('GET /coach/messages/:clientId and /api/v1/coach/messages/:clientId loads chat history and unread tracking', async () => {
    const app = createApp();
    const clientId = 'pt-client-001';

    // 1. Fetch from root route
    const rootRes = await app.fetch(`/coach/messages/${clientId}?markRead=false`, { method: 'GET' }, mockEnv);
    expect(rootRes.status).toBe(200);
    const rootJson = (await rootRes.json()) as {
      success: boolean;
      clientId: string;
      data: Array<{
        id: string;
        coachId: string;
        clientId: string;
        senderRole: 'coach' | 'client';
        senderName: string;
        message: string;
        isRead: boolean;
        isPainAlert: boolean;
        painScore: number | null;
        jointRegion: string | null;
        createdAt: string;
      }>;
      unreadCount: number;
    };

    expect(rootJson.success).toBe(true);
    expect(rootJson.clientId).toBe(clientId);
    expect(Array.isArray(rootJson.data)).toBe(true);
    expect(rootJson.data.length).toBeGreaterThanOrEqual(1);

    // 2. Fetch from /api/v1 route with markRead=true
    const apiRes = await app.fetch(`/api/v1/coach/messages/${clientId}?markRead=true`, { method: 'GET' }, mockEnv);
    expect(apiRes.status).toBe(200);
    const apiJson = (await apiRes.json()) as typeof rootJson;
    expect(apiJson.success).toBe(true);
    expect(apiJson.unreadCount).toBe(0);
  });

  it('POST /coach/messages validates inputs and creates message between coach and patient', async () => {
    const app = createApp();

    // 1. Invalid payload
    const invalidRes = await app.fetch(
      '/api/v1/coach/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: '',
          message: '',
        }),
      },
      mockEnv,
    );
    expect(invalidRes.status).toBe(400);

    // 2. Valid therapist message
    const coachMsgRes = await app.fetch(
      '/api/v1/coach/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: 'pt-client-002',
          senderRole: 'coach',
          senderName: 'Dr. Alex Vance, DPT',
          message: 'Excellent compliance on your ACL return-to-sport routine this week.',
        }),
      },
      mockEnv,
    );
    expect(coachMsgRes.status).toBe(201);
    const coachMsgJson = (await coachMsgRes.json()) as {
      success: boolean;
      data: { id: string; senderRole: string; message: string };
      alertCreated: boolean;
    };
    expect(coachMsgJson.success).toBe(true);
    expect(coachMsgJson.data.senderRole).toBe('coach');
    expect(coachMsgJson.alertCreated).toBe(false);

    // 3. Client message with pain alert (painScore > 4) automatically triggers alert
    const painMsgRes = await app.fetch(
      '/api/v1/coach/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: 'pt-client-002',
          senderRole: 'client',
          senderName: 'Marcus Vance',
          message: 'Felt sharp pain (7/10) in patellar graft site during plyometric jump landings.',
          isPainAlert: true,
          painScore: 7,
          jointRegion: 'Left Anterior Knee (Graft Site)',
          exerciseName: 'Depth Jumps to Box',
        }),
      },
      mockEnv,
    );
    expect(painMsgRes.status).toBe(201);
    const painMsgJson = (await painMsgRes.json()) as {
      success: boolean;
      alertCreated: boolean;
      alert: { id: string; painScore: number; jointRegion: string; status: string };
    };
    expect(painMsgJson.success).toBe(true);
    expect(painMsgJson.alertCreated).toBe(true);
    expect(painMsgJson.alert.painScore).toBe(7);
    expect(painMsgJson.alert.status).toBe('active');
  });

  it('GET /coach/alerts returns active high-priority pain alerts with filtering', async () => {
    const app = createApp();

    // 1. Fetch active alerts
    const alertsRes = await app.fetch('/api/v1/coach/alerts?status=active', { method: 'GET' }, mockEnv);
    expect(alertsRes.status).toBe(200);
    const alertsJson = (await alertsRes.json()) as {
      success: boolean;
      data: Array<{
        id: string;
        clientName: string;
        painScore: number;
        jointRegion: string;
        status: string;
      }>;
      totalActive: number;
    };

    expect(alertsJson.success).toBe(true);
    expect(Array.isArray(alertsJson.data)).toBe(true);
    expect(alertsJson.data.length).toBeGreaterThanOrEqual(1);
    expect(alertsJson.totalActive).toBeGreaterThanOrEqual(1);
    expect(alertsJson.data.every((a) => a.painScore > 4)).toBe(true);

    // 2. Filter by clientId
    const filteredRes = await app.fetch(
      '/api/v1/coach/alerts?clientId=pt-client-001&status=all',
      { method: 'GET' },
      mockEnv,
    );
    expect(filteredRes.status).toBe(200);
    const filteredJson = (await filteredRes.json()) as typeof alertsJson;
    expect(filteredJson.data.every((a) => a.id.includes('alert') || a.painScore > 4)).toBe(true);
  });

  it('POST /coach/alerts/:id/resolve resolves alert and optionally sends feedback message', async () => {
    const app = createApp();

    // 1. First trigger an alert to resolve
    const postAlertMsg = await app.fetch(
      '/api/v1/coach/messages',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: 'pt-client-005',
          senderRole: 'client',
          senderName: 'Amara Okafor',
          message: 'Achilles insertional pain spiked to 6/10 during morning eccentrics.',
          isPainAlert: true,
          painScore: 6,
          jointRegion: 'Achilles Insertion (Right)',
        }),
      },
      mockEnv,
    );
    const postAlertJson = (await postAlertMsg.json()) as { alert: { id: string } };
    const alertId = postAlertJson.alert.id;

    // 2. Resolve alert with clinical directive and auto feedback message
    const resolveRes = await app.fetch(
      `/api/v1/coach/alerts/${alertId}/resolve`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          clinicalNote: 'Patient instructed to stop eccentric heel drops below floor level. Switch to straight isometric hold.',
          sendFeedbackMessage: true,
          directiveMessage: 'Apply Tendon Deload Protocol: Perform 5x45s isometric calf holds on flat ground. Rest from jumping 48h.',
        }),
      },
      mockEnv,
    );

    expect(resolveRes.status).toBe(200);
    const resolveJson = (await resolveRes.json()) as {
      success: boolean;
      alert: { id: string; status: string; clinicalNote: string; resolvedAt: string };
      sentMessage: { id: string; message: string; senderRole: string } | null;
    };

    expect(resolveJson.success).toBe(true);
    expect(resolveJson.alert.status).toBe('resolved');
    expect(resolveJson.alert.clinicalNote).toContain('Patient instructed');
    expect(resolveJson.alert.resolvedAt).toBeDefined();
    expect(resolveJson.sentMessage).toBeDefined();
    expect(resolveJson.sentMessage?.senderRole).toBe('coach');
    expect(resolveJson.sentMessage?.message).toContain('Apply Tendon Deload Protocol');
  });

  it('POST /workout-sessions/pain-alert automatically triggers high-priority alert when painScore > 4', async () => {
    const app = createApp();

    // 1. Mild pain (<= 4) does NOT trigger high priority alert
    const mildRes = await app.fetch(
      '/api/v1/workout-sessions/pain-alert',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          painScore: 2,
          jointRegion: 'Right Knee',
          exerciseName: 'Leg Extension',
          notes: 'Mild fatigue sensation only.',
        }),
      },
      mockEnv,
    );
    expect(mildRes.status).toBe(200);
    const mildJson = (await mildRes.json()) as { alertTriggered: boolean };
    expect(mildJson.alertTriggered).toBe(false);

    // 2. Severe pain (> 4) DOES trigger high-priority alert
    const severeRes = await app.fetch(
      '/api/v1/workout-sessions/pain-alert',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          painScore: 6,
          jointRegion: 'Left Lumbar Spine',
          exerciseName: 'Barbell Romanian Deadlift',
          notes: 'Sharp pinching sensation at bottom of hinge.',
        }),
      },
      mockEnv,
    );
    expect(severeRes.status).toBe(200);
    const severeJson = (await severeRes.json()) as {
      alertTriggered: boolean;
      alert: { painScore: number; jointRegion: string; status: string };
    };
    expect(severeJson.alertTriggered).toBe(true);
    expect(severeJson.alert.painScore).toBe(6);
    expect(severeJson.alert.status).toBe('active');
  });
});
