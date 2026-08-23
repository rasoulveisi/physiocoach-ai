import { desc, eq } from 'drizzle-orm';
import { profiles, users } from '../db/schema';
import type { AuthenticatedUser } from '../types/auth';
import type { ProfileInput } from '../types/profile';
import { withTransactionFallback } from '../routes/transactions';

type DbClient = ReturnType<typeof import('../db/client').createDb>;
type ProfileRow = typeof profiles.$inferSelect;
type ProfileInsert = typeof profiles.$inferInsert;
type UserRow = typeof users.$inferSelect;

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

export async function getLatestProfileForUser(
  db: DbClient,
  userId: string,
): Promise<ProfileRow | null> {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .orderBy(desc(profiles.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertUserAndProfile(
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
