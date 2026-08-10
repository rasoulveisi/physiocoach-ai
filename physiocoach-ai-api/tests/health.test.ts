import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('health routes', () => {
  it('returns API health status', async () => {
    const app = createApp();
    const response = await app.request('/api/v1/health');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: 'physiocoach-ai-api',
      version: '0.1.0',
    });
  });
});
