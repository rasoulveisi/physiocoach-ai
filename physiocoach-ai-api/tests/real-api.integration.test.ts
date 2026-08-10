import { describe, expect, it } from 'vitest';
import { frontendGeneratePayloads } from './fixtures/frontend-generate-payloads';

const baseUrl = process.env.REAL_API_BASE_URL?.replace(/\/$/, '');
const accessToken = process.env.REAL_API_ACCESS_TOKEN;

describe.skipIf(!baseUrl)('deployed API integration', { timeout: 30_000 }, () => {
  it('serves health and OpenAPI from the real deployment', async () => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true });

    const openapi = await fetch(`${baseUrl}/api/v1/openapi.json`);
    expect(openapi.status).toBe(200);
    expect((await openapi.json()) as object).toMatchObject({ openapi: expect.any(String) });
  });

  it.skipIf(!accessToken)('accepts a real frontend workout-plan payload', async () => {
    const { payload } = frontendGeneratePayloads[0]!;
    const response = await fetch(`${baseUrl}/api/v1/workout-plans/generate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        origin: 'http://localhost:4200',
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBeLessThan(500);
    const body = (await response.json()) as { data?: unknown; error?: unknown };
    expect(body.data ?? body.error).toBeDefined();
  });
});
