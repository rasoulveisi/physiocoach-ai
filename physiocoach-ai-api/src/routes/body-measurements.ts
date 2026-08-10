import type { Context } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { bodyMeasurements } from '../db/schema';
import type { WorkerBindings } from '../env';
import { createApiError, handleRouteError } from '../shared/errors/api';
import { bodyMeasurementInputSchema } from '../types/progress';
import { getApiRouteContext } from './context';
import { parseJsonPayload } from './validation';

type BodyMeasurementRow = typeof bodyMeasurements.$inferSelect;

export function createBodyMeasurementRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  const toNullableNumber = (value: number | undefined): number | null =>
    value === undefined ? null : value;
  const toNullableString = (value: string | undefined): string | null =>
    value === undefined ? null : value;

  const list = async (c: Context<{ Bindings: WorkerBindings }>) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: [] });

      const rows = await db
        .select()
        .from(bodyMeasurements)
        .where(eq(bodyMeasurements.userId, user.id))
        .orderBy(desc(bodyMeasurements.measuredAt));

      return c.json({ data: rows.map(mapBodyMeasurementToDto) });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch body measurements.');
    }
  };

  const create = async (c: Context<{ Bindings: WorkerBindings }>) => {
    try {
      const parsed = await parseJsonPayload(c, bodyMeasurementInputSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) return c.json({ data: parsed.data });

      const id = crypto.randomUUID();
      try {
        const inserted = await db
          .insert(bodyMeasurements)
          .values({
            id,
            userId: user.id,
            measuredAt: parsed.data.measuredAt,
            bodyWeightKg: parsed.data.bodyWeightKg,
            bodyFatEstimate: toNullableNumber(parsed.data.bodyFatEstimate),
            neckCm: toNullableNumber(parsed.data.neckCm),
            shouldersCm: toNullableNumber(parsed.data.shouldersCm),
            chestCm: toNullableNumber(parsed.data.chestCm),
            waistCm: toNullableNumber(parsed.data.waistCm),
            hipsCm: toNullableNumber(parsed.data.hipsCm),
            upperArmLeftCm: toNullableNumber(parsed.data.upperArmLeftCm),
            upperArmRightCm: toNullableNumber(parsed.data.upperArmRightCm),
            forearmLeftCm: toNullableNumber(parsed.data.forearmLeftCm),
            forearmRightCm: toNullableNumber(parsed.data.forearmRightCm),
            thighLeftCm: toNullableNumber(parsed.data.thighLeftCm),
            thighRightCm: toNullableNumber(parsed.data.thighRightCm),
            calfLeftCm: toNullableNumber(parsed.data.calfLeftCm),
            calfRightCm: toNullableNumber(parsed.data.calfRightCm),
            notes: toNullableString(parsed.data.notes),
          })
          .returning();

        const row = inserted[0];
        if (!row) {
          return createApiError(c, 'internal_server_error', 'Unable to save body measurement.');
        }

        return c.json({ data: mapBodyMeasurementToDto(row) });
      } catch (error) {
        const dbError = error instanceof Error ? error.message : 'Unknown error.';
        return createApiError(c, 'invalid_request', `Unable to save body measurement: ${dbError}`, {
          status: 500,
        });
      }
    } catch (error) {
      return handleRouteError(c, error, 'Failed to save body measurement.');
    }
  };

  route.get('/body-measurements', (c) => list(c));
  route.get('/measurement', (c) => list(c));

  route.post('/body-measurements', (c) => create(c));
  route.post('/measurement', (c) => create(c));

  return route;
}

function mapBodyMeasurementToDto(row: BodyMeasurementRow) {
  return {
    id: row.id,
    measuredAt: row.measuredAt,
    bodyWeightKg: row.bodyWeightKg,
    bodyFatEstimate: row.bodyFatEstimate,
    neckCm: row.neckCm,
    shouldersCm: row.shouldersCm,
    chestCm: row.chestCm,
    waistCm: row.waistCm,
    hipsCm: row.hipsCm,
    upperArmLeftCm: row.upperArmLeftCm,
    upperArmRightCm: row.upperArmRightCm,
    forearmLeftCm: row.forearmLeftCm,
    forearmRightCm: row.forearmRightCm,
    thighLeftCm: row.thighLeftCm,
    thighRightCm: row.thighRightCm,
    calfLeftCm: row.calfLeftCm,
    calfRightCm: row.calfRightCm,
    notes: row.notes,
  };
}
