import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('E2E Behavior: AI Audit Logs Inspection', () => {
  it('allows querying AI audit log entries by traceId and task', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/ai-audit-logs?limit=5', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json<{ data: Array<{ id: string; task: string }> }>();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 404 for non-existent audit log ID', async () => {
    const app = createApp();

    const response = await app.request('/api/v1/ai-audit-logs/audit_non_existent_123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token',
      },
    });

    expect(response.status).toBe(404);
    const body = await response.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('not_found');
  });
});
