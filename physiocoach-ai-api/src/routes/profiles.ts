import { desc, eq } from 'drizzle-orm';
import { createExpressRouter } from './express-adapter';
import { createApiError } from '../shared/errors/api';
import { profileInputSchema } from '../types/profile';
import { getApiRouteContext, hasDbClient } from './context';
import { assessments, profiles, users } from '../db/schema';
import {
  getLatestProfileForUser,
  mapProfileRecordToInput,
  upsertUserAndProfile,
} from '../services/user-profile';
import type { AuthenticatedUser } from '../types/auth';

export { mapProfileRecordToInput };

export function createProfileRoutes() {
  const route = createExpressRouter();

  route.get('/profile', async (c) => {
    const context = getApiRouteContext(c);
    if (!hasDbClient(context)) {
      return c.json({ data: null });
    }

    const [userRows, profileRows, assessmentRows] = await Promise.all([
      context.db
        .select()
        .from(users)
        .where(eq(users.id, context.user.id))
        .limit(1),
      context.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, context.user.id))
        .orderBy(desc(profiles.createdAt))
        .limit(1),
      context.db
        .select()
        .from(assessments)
        .where(eq(assessments.userId, context.user.id))
        .orderBy(desc(assessments.completedAt))
        .limit(1),
    ]);

    const userRecord = userRows[0];
    const profile = profileRows[0];
    const latestAssessment = assessmentRows[0];

    let availableEquipment: string[] = [];
    if (latestAssessment?.equipmentJson) {
      try {
        const parsed = JSON.parse(latestAssessment.equipmentJson);
        if (Array.isArray(parsed)) availableEquipment = parsed;
      } catch {}
    }

    return c.json({
      data: {
        displayName:
          userRecord?.displayName ||
          (context.user as any).displayName ||
          (context.user as any).name ||
          undefined,
        email: userRecord?.email || context.user.email || undefined,
        age: profile?.age ?? null,
        sex: profile?.sex ?? 'prefer_not_to_say',
        heightCm: profile?.heightCm ?? null,
        weightKg: profile?.weightKg ?? null,
        ...(profile?.bodyFatEstimate === null || profile?.bodyFatEstimate === undefined
          ? {}
          : { bodyFatEstimate: profile.bodyFatEstimate }),
        lifestyle: profile?.lifestyle ?? 'active',
        experienceLevel: profile?.experienceLevel ?? 'beginner',
        availableEquipment,
      },
    });
  });

  route.patch('/profile', async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const context = getApiRouteContext(c);
    const now = new Date().toISOString();

    if (!hasDbClient(context)) {
      return c.json({ data: raw });
    }

    const [existingProfileRows, latestAssessmentRows] = await Promise.all([
      context.db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, context.user.id))
        .orderBy(desc(profiles.createdAt))
        .limit(1),
      context.db
        .select()
        .from(assessments)
        .where(eq(assessments.userId, context.user.id))
        .orderBy(desc(assessments.completedAt))
        .limit(1),
    ]);

    const existingProfile = existingProfileRows[0];
    const latestAssessment = latestAssessmentRows[0];

    const mergedProfile = {
      age: typeof raw.age === 'number' ? raw.age : existingProfile?.age ?? 30,
      sex: typeof raw.sex === 'string' ? (raw.sex as any) : existingProfile?.sex ?? 'prefer_not_to_say',
      heightCm: typeof raw.heightCm === 'number' ? raw.heightCm : existingProfile?.heightCm ?? 175,
      weightKg: typeof raw.weightKg === 'number' ? raw.weightKg : existingProfile?.weightKg ?? 75,
      bodyFatEstimate: typeof raw.bodyFatEstimate === 'number' ? raw.bodyFatEstimate : existingProfile?.bodyFatEstimate ?? undefined,
      lifestyle: typeof raw.lifestyle === 'string' ? (raw.lifestyle as any) : existingProfile?.lifestyle ?? 'active',
      experienceLevel: typeof raw.experienceLevel === 'string' ? (raw.experienceLevel as any) : existingProfile?.experienceLevel ?? 'beginner',
    };

    const userToUpsert: AuthenticatedUser = {
      ...context.user,
      displayName:
        typeof raw.displayName === 'string' && raw.displayName.trim().length > 0
          ? raw.displayName.trim()
          : context.user.displayName,
      email:
        typeof raw.email === 'string' && raw.email.trim().length > 0
          ? raw.email.trim()
          : context.user.email,
    };

    const profileId = `profile_${crypto.randomUUID()}`;
    const profileInsert = {
      id: profileId,
      userId: context.user.id,
      age: mergedProfile.age,
      sex: mergedProfile.sex,
      heightCm: mergedProfile.heightCm,
      weightKg: mergedProfile.weightKg,
      bodyFatEstimate: mergedProfile.bodyFatEstimate ?? null,
      lifestyle: mergedProfile.lifestyle,
      experienceLevel: mergedProfile.experienceLevel,
      createdAt: now,
      updatedAt: now,
    };

    const userInsert = {
      id: userToUpsert.id,
      email: userToUpsert.email,
      displayName: userToUpsert.displayName ?? null,
      createdAt: now,
      updatedAt: now,
    };

    // First ensure user record exists / updated
    await context.db
      .insert(users)
      .values(userInsert)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: userInsert.displayName,
          email: userInsert.email,
          updatedAt: now,
        },
      });

    const writePromises: Promise<any>[] = [
      context.db.insert(profiles).values(profileInsert),
    ];

    let savedEquipment: string[] = [];
    if (Array.isArray(raw.availableEquipment)) {
      savedEquipment = raw.availableEquipment;
      if (latestAssessment) {
        writePromises.push(
          context.db
            .update(assessments)
            .set({ equipmentJson: JSON.stringify(raw.availableEquipment) })
            .where(eq(assessments.id, latestAssessment.id)),
        );
      } else {
        writePromises.push(
          context.db.insert(assessments).values({
            id: `assessment_${crypto.randomUUID()}`,
            userId: context.user.id,
            goalsJson: JSON.stringify(['strength']),
            frequencyDays: 3,
            equipmentJson: JSON.stringify(raw.availableEquipment),
            limitationsJson: JSON.stringify([]),
            postureFlagsJson: JSON.stringify([]),
            completedAt: now,
            inputHash: 'settings_init',
          }),
        );
      }
    } else if (latestAssessment?.equipmentJson) {
      try {
        const parsed = JSON.parse(latestAssessment.equipmentJson);
        if (Array.isArray(parsed)) savedEquipment = parsed;
      } catch {}
    }

    await Promise.all(writePromises);

    return c.json({
      data: {
        displayName: userToUpsert.displayName || undefined,
        email: userToUpsert.email,
        age: mergedProfile.age,
        sex: mergedProfile.sex,
        heightCm: mergedProfile.heightCm,
        weightKg: mergedProfile.weightKg,
        ...(mergedProfile.bodyFatEstimate ? { bodyFatEstimate: mergedProfile.bodyFatEstimate } : {}),
        lifestyle: mergedProfile.lifestyle,
        experienceLevel: mergedProfile.experienceLevel,
        availableEquipment: savedEquipment,
      },
    });
  });

  return route;
}

export const profilesRouter = createProfileRoutes();
