import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Feature 4.2 Bulk Client Codes & Seat Licensing (/coach/seats & /coach/invites)', () => {
  it('GET /coach/seats and /api/v1/coach/seats returns seat licensing telemetry, active tier, and invite roster', async () => {
    const app = createApp();

    // 1. Fetch from root /coach/seats
    const rootRes = await app.fetch('/coach/seats', { method: 'GET' }, mockEnv);
    expect(rootRes.status).toBe(200);
    const rootJson = (await rootRes.json()) as {
      data: {
        licenseId: string;
        tier: string;
        tierName: string;
        priceMonthly: number;
        totalSeats: number;
        usedSeats: number;
        availableSeats: number;
        inviteCode: string;
        status: string;
        invites: Array<{
          id: string;
          clientName: string;
          clientEmail: string;
          inviteToken: string;
          inviteUrl: string;
          status: 'pending' | 'redeemed' | 'revoked';
        }>;
        pricingTiers: Array<{
          tier: string;
          name: string;
          seats: number;
          priceMonthly: number;
        }>;
      };
    };

    expect(rootJson.data).toBeDefined();
    expect(rootJson.data.licenseId).toBeDefined();
    expect(rootJson.data.totalSeats).toBeGreaterThanOrEqual(5);
    expect(rootJson.data.availableSeats).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(rootJson.data.invites)).toBe(true);
    expect(rootJson.data.invites.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(rootJson.data.pricingTiers)).toBe(true);
    expect(rootJson.data.pricingTiers.length).toBe(3);

    // 2. Fetch from /api/v1/coach/seats
    const apiRes = await app.fetch('/api/v1/coach/seats', { method: 'GET' }, mockEnv);
    expect(apiRes.status).toBe(200);
    const apiJson = (await apiRes.json()) as typeof rootJson;
    expect(apiJson.data.totalSeats).toBe(rootJson.data.totalSeats);
  });

  it('POST /coach/seats/checkout validates tier and returns Stripe checkout session info', async () => {
    const app = createApp();

    // 1. Invalid tier
    const invalidRes = await app.fetch(
      '/api/v1/coach/seats/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier: 'mega_100' }),
      },
      mockEnv,
    );
    expect(invalidRes.status).toBe(400);

    // 2. Valid purchase of clinic_25 tier
    const validRes = await app.fetch(
      '/api/v1/coach/seats/checkout',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tier: 'clinic_25' }),
      },
      mockEnv,
    );

    expect(validRes.status).toBe(201);
    const validJson = (await validRes.json()) as {
      success: boolean;
      checkoutUrl: string;
      sessionId: string;
      tier: string;
      totalSeats: number;
      priceMonthly: number;
      license: {
        id: string;
        tier: string;
        totalSeats: number;
        status: string;
      };
    };

    expect(validJson.success).toBe(true);
    expect(validJson.checkoutUrl).toContain('checkout.stripe.com');
    expect(validJson.tier).toBe('clinic_25');
    expect(validJson.totalSeats).toBe(25);
    expect(validJson.priceMonthly).toBe(199);
    expect(validJson.license.totalSeats).toBe(25);
  });

  it('POST /coach/invites/generate creates trackable invite and updates capacity', async () => {
    const app = createApp();

    // 1. Validation error on missing fields
    const invalidRes = await app.fetch(
      '/api/v1/coach/invites/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientName: 'A' }),
      },
      mockEnv,
    );
    expect(invalidRes.status).toBe(400);

    // 2. Successful invite generation
    const generateRes = await app.fetch(
      '/api/v1/coach/invites/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Maya Lin',
          clientEmail: 'maya.lin@example.com',
          injuryDiagnosis: 'ACL Reconstruction Phase 2',
        }),
      },
      mockEnv,
    );

    expect(generateRes.status).toBe(201);
    const generateJson = (await generateRes.json()) as {
      success: boolean;
      invite: {
        id: string;
        clientName: string;
        clientEmail: string;
        inviteToken: string;
        inviteUrl: string;
        status: string;
      };
      availableSeats: number;
      usedSeats: number;
      totalSeats: number;
    };

    expect(generateJson.success).toBe(true);
    expect(generateJson.invite.clientName).toBe('Maya Lin');
    expect(generateJson.invite.inviteToken).toMatch(/^pt-inv-/);
    expect(generateJson.invite.inviteUrl).toContain('https://physiocoach.ai/invite/');
    expect(generateJson.invite.status).toBe('pending');
    expect(generateJson.usedSeats).toBeGreaterThanOrEqual(1);

    // 3. Verify newly generated invite appears in GET /coach/seats
    const seatsRes = await app.fetch('/api/v1/coach/seats', { method: 'GET' }, mockEnv);
    const seatsJson = (await seatsRes.json()) as {
      data: { invites: Array<{ id: string; inviteToken: string }> };
    };
    expect(seatsJson.data.invites.some((inv) => inv.id === generateJson.invite.id)).toBe(true);
  });

  it('POST /coach/invites/redeem activates patient and links to PT coach roster', async () => {
    const app = createApp();

    // 1. Generate new invite
    const genRes = await app.fetch(
      '/api/v1/coach/invites/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Julian Hayes',
          clientEmail: 'julian.hayes@example.com',
          injuryDiagnosis: 'Subacromial Decompression Rehab',
        }),
      },
      mockEnv,
    );
    const genJson = (await genRes.json()) as {
      invite: { inviteToken: string };
    };
    const token = genJson.invite.inviteToken;

    // 2. Redeem invite token
    const redeemRes = await app.fetch(
      '/api/v1/coach/invites/redeem',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inviteToken: token,
          patientUserId: 'usr-julian-hayes-100',
        }),
      },
      mockEnv,
    );

    expect(redeemRes.status).toBe(200);
    const redeemJson = (await redeemRes.json()) as {
      success: boolean;
      message: string;
      coachId: string;
      client: {
        id: string;
        clientName: string;
        clientEmail: string;
        injuryDiagnosis: string;
      };
      invite: {
        status: string;
        redeemedAt: string;
        redeemedUserId: string;
      };
    };

    expect(redeemJson.success).toBe(true);
    expect(redeemJson.invite.status).toBe('redeemed');
    expect(redeemJson.invite.redeemedUserId).toBe('usr-julian-hayes-100');
    expect(redeemJson.client.clientName).toBe('Julian Hayes');

    // 3. Verify client appears in PT patient roster (GET /coach/clients)
    const clientsRes = await app.fetch('/api/v1/coach/clients', { method: 'GET' }, mockEnv);
    const clientsJson = (await clientsRes.json()) as {
      data: Array<{ id: string; clientName: string }>;
    };
    expect(clientsJson.data.some((c) => c.clientName === 'Julian Hayes')).toBe(true);

    // 4. Attempt to redeem token again should fail with 400
    const duplicateRedeemRes = await app.fetch(
      '/api/v1/coach/invites/redeem',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken: token }),
      },
      mockEnv,
    );
    expect(duplicateRedeemRes.status).toBe(400);

    // 5. Non-existent token should return 404
    const notFoundRes = await app.fetch(
      '/api/v1/coach/invites/redeem',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken: 'pt-inv-non-existent-token-xyz' }),
      },
      mockEnv,
    );
    expect(notFoundRes.status).toBe(404);
  });

  it('POST /coach/invites/revoke revokes an unredeemed patient invite', async () => {
    const app = createApp();

    // 1. Generate invite to revoke
    const genRes = await app.fetch(
      '/api/v1/coach/invites/generate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Casey Miller',
          clientEmail: 'casey.miller@example.com',
          injuryDiagnosis: 'Plantar Fasciitis',
        }),
      },
      mockEnv,
    );
    const genJson = (await genRes.json()) as {
      invite: { id: string; inviteToken: string };
    };

    // 2. Revoke invite
    const revokeRes = await app.fetch(
      '/api/v1/coach/invites/revoke',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteId: genJson.invite.id }),
      },
      mockEnv,
    );

    expect(revokeRes.status).toBe(200);
    const revokeJson = (await revokeRes.json()) as { success: boolean };
    expect(revokeJson.success).toBe(true);

    // 3. Attempting to redeem revoked token should fail with 400
    const redeemRes = await app.fetch(
      '/api/v1/coach/invites/redeem',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviteToken: genJson.invite.inviteToken }),
      },
      mockEnv,
    );
    expect(redeemRes.status).toBe(400);
  });
});
