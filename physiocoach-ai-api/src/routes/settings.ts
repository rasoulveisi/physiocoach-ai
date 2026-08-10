import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { userSettings } from '../db/schema';
import type { WorkerBindings } from '../env';
import { createApiError, handleRouteError } from '../shared/errors/api';
import { parseJsonPayload } from './validation';
import {
  applySettingsPatch,
  mergeWithDefaults,
  type UserSettingsInput,
  userSettingsPatchSchema,
} from '../types/settings';
import { getApiRouteContext } from './context';

type DbClient = ReturnType<typeof import('../db/client').createDb>;
type SettingsRow = typeof userSettings.$inferSelect;

export function createSettingsRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/settings', async (c) => {
    try {
      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: mergeWithDefaults({}) });
      }

      const row = await findLatestUserSettings(db, user.id);
      if (!row) {
        return c.json({ data: mergeWithDefaults({}) });
      }

      return c.json({
        data: {
          theme: row.theme,
          unitSystem: row.unitSystem,
          defaultWorkoutView: row.defaultWorkoutView,
          remindersEnabled: row.remindersEnabled === 1,
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to fetch user settings.');
    }
  });

  route.patch('/settings', async (c) => {
    try {
      const parsed = await parseJsonPayload(c, userSettingsPatchSchema);
      if (!parsed.success) return parsed.response;

      const { user, db } = getApiRouteContext(c);
      if (!db) {
        return c.json({ data: mergeWithDefaults(parsed.data) });
      }

      const now = new Date().toISOString();
      const current = await findLatestUserSettings(db, user.id);
      const currentSettings: UserSettingsInput | undefined = current
        ? {
            theme: current.theme as UserSettingsInput['theme'],
            unitSystem: current.unitSystem as UserSettingsInput['unitSystem'],
            defaultWorkoutView:
              current.defaultWorkoutView as UserSettingsInput['defaultWorkoutView'],
            remindersEnabled: current.remindersEnabled === 1,
          }
        : undefined;
      const merged = applySettingsPatch(currentSettings, parsed.data);

      const updated = await upsertUserSettings(db, {
        id: current?.id ?? `settings_${user.id}`,
        userId: user.id,
        theme: merged.theme,
        unitSystem: merged.unitSystem,
        defaultWorkoutView: merged.defaultWorkoutView,
        remindersEnabled: merged.remindersEnabled ? 1 : 0,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      });

      if (!updated) {
        return createApiError(c, 'invalid_request', 'Unable to save settings.');
      }

      return c.json({
        data: {
          theme: updated.theme,
          unitSystem: updated.unitSystem,
          defaultWorkoutView: updated.defaultWorkoutView,
          remindersEnabled: updated.remindersEnabled === 1,
        },
      });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to update user settings.');
    }
  });

  return route;
}

async function findLatestUserSettings(db: DbClient, userId: string): Promise<SettingsRow | null> {
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .orderBy(desc(userSettings.updatedAt))
    .limit(1);

  return rows[0] ?? null;
}

async function upsertUserSettings(db: DbClient, payload: SettingsRow): Promise<SettingsRow | null> {
  const existing = await findLatestUserSettings(db, payload.userId);

  if (!existing) {
    const inserted = await db.insert(userSettings).values(payload).returning();
    return inserted[0] ?? null;
  }

  await db
    .update(userSettings)
    .set({
      theme: payload.theme,
      unitSystem: payload.unitSystem,
      defaultWorkoutView: payload.defaultWorkoutView,
      remindersEnabled: payload.remindersEnabled,
      updatedAt: payload.updatedAt,
    })
    .where(and(eq(userSettings.id, existing.id), eq(userSettings.userId, payload.userId)));

  const updated = await findLatestUserSettings(db, payload.userId);
  return updated;
}
