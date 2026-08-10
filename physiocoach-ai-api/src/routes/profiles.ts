import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { profiles, users } from '../db/schema';
import { createDb } from '../db/client';
import type { WorkerBindings } from '../env';
import { createApiError } from '../shared/errors/api';
import { type ProfileInput, profileInputSchema } from '../types/profile';
import type { AuthenticatedUser } from '../types/auth';
import { getApiRouteContext, hasDbClient } from './context';
import { parseJsonPayload } from './validation';
import { withTransactionFallback } from './transactions';

type DbClient = ReturnType<typeof createDb>;
type ProfileRow = typeof profiles.$inferSelect;
type ProfileInsert = typeof profiles.$inferInsert;
type UserRow = typeof users.$inferSelect;

export function createProfileRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/me', (c) => {
    const { user } = getApiRouteContext(c);
    return c.json({
      data: {
        id: user.id,
        email: user.email,
        ...(user.role === undefined ? {} : { role: user.role }),
        roles: user.roles ?? [],
      },
    });
  });

  route.get('/profile', async (c) => {
    const context = getApiRouteContext(c);
    if (!hasDbClient(context)) {
      return c.json({ data: null });
    }

    const profile = await getLatestProfileForUser(context.db, context.user.id);
    if (!profile) {
      return c.json({ data: null });
    }

    return c.json({
      data: {
        age: profile.age,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        ...(profile.bodyFatEstimate === null
          ? {}
          : { bodyFatEstimate: profile.bodyFatEstimate }),
        lifestyle: profile.lifestyle,
        experienceLevel: profile.experienceLevel,
      },
    });
  });

  route.patch('/profile', async (c) => {
    const context = getApiRouteContext(c);
    const parsed = await parseJsonPayload(c, profileInputSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    if (!hasDbClient(context)) {
      return createApiError(
        c,
        'invalid_request',
        'Profile persistence is unavailable in this environment.',
      );
    }

    const now = new Date().toISOString();
    await upsertUserAndProfile(context.db, context.user, parsed.data, now);
    const profile = await getLatestProfileForUser(context.db, context.user.id);
    if (!profile) {
      return createApiError(c, 'internal_server_error', 'Profile row was not persisted.', {
        status: 500,
      });
    }

    return c.json({
      data: {
        age: profile.age,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        ...(profile.bodyFatEstimate === null
          ? {}
          : { bodyFatEstimate: profile.bodyFatEstimate }),
        lifestyle: profile.lifestyle,
        experienceLevel: profile.experienceLevel,
      },
    });
  });

  return route;
}

export function mapProfileRecordToInput(profile: ProfileRow | null): ProfileInput | null {
  if (!profile) {
    return null;
  }

  const mapped: ProfileInput = {
    age: profile.age,
    sex: profile.sex as ProfileInput['sex'],
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    ...(profile.bodyFatEstimate === null ? {} : { bodyFatEstimate: profile.bodyFatEstimate }),
    lifestyle: profile.lifestyle as ProfileInput['lifestyle'],
    experienceLevel: profile.experienceLevel as ProfileInput['experienceLevel'],
  };

  return mapped;
}

async function getLatestProfileForUser(db: DbClient, userId: string): Promise<ProfileRow | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .orderBy(desc(profiles.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function upsertUserAndProfile(
  db: DbClient,
  user: AuthenticatedUser,
  profile: ProfileInput,
  now: string,
): Promise<void> {
  const profileId = `profile_${crypto.randomUUID()}`;

  await withTransactionFallback(
    db,
    async (tx) => {
      const client = tx as DbClient;
      await upsertUserForContext(client, user, now);
      await client.insert(profiles).values(profileRowFromInput(profileId, user.id, profile, now));
    },
    'profile-upsert',
  );
}

function profileRowFromInput(
  profileId: string,
  userId: string,
  profile: ProfileInput,
  now: string,
): ProfileInsert {
  return {
    id: profileId,
    userId,
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatEstimate: profile.bodyFatEstimate ?? null,
    lifestyle: profile.lifestyle,
    experienceLevel: profile.experienceLevel,
    createdAt: now,
    updatedAt: now,
  };
}

async function upsertUserForContext(
  db: DbClient,
  user: AuthenticatedUser,
  now: string,
): Promise<void> {
  const safeDisplayName = user.displayName ?? null;
  const userInsert = {
    id: user.id,
    email: user.email,
    displayName: safeDisplayName,
    createdAt: now,
    updatedAt: now,
  } satisfies UserRow;

  await db
    .insert(users)
    .values(userInsert)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: user.email,
        displayName: safeDisplayName,
        updatedAt: now,
      },
    });
}
