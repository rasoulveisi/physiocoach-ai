import { createExpressRouter } from './express-adapter';
import { createApiError } from '../shared/errors/api';
import { profileInputSchema } from '../types/profile';
import { getApiRouteContext, hasDbClient } from './context';
import { parseJsonPayload } from './validation';
import {
  getLatestProfileForUser,
  mapProfileRecordToInput,
  upsertUserAndProfile,
} from '../services/user-profile';

export { mapProfileRecordToInput };

export function createProfileRoutes() {
  const route = createExpressRouter();

  route.get('/profile', async (c) => {
    const context = getApiRouteContext(c);
    if (!hasDbClient(context)) {
      return c.json({ data: null });
    }

    const profile = await getLatestProfileForUser(context.db, context.user.id);
    return c.json({
      data: {
        displayName: (context.user as any).displayName || (context.user as any).name || undefined,
        email: context.user.email || undefined,
        age: profile?.age ?? null,
        sex: profile?.sex ?? 'prefer_not_to_say',
        heightCm: profile?.heightCm ?? null,
        weightKg: profile?.weightKg ?? null,
        ...(profile?.bodyFatEstimate === null || profile?.bodyFatEstimate === undefined
          ? {}
          : { bodyFatEstimate: profile.bodyFatEstimate }),
        lifestyle: profile?.lifestyle ?? 'active',
        experienceLevel: profile?.experienceLevel ?? 'beginner',
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

    const existingProfile = await getLatestProfileForUser(context.db, context.user.id);
    const mergedProfile = {
      age: typeof raw.age === 'number' ? raw.age : existingProfile?.age ?? 30,
      sex: typeof raw.sex === 'string' ? (raw.sex as any) : existingProfile?.sex ?? 'prefer_not_to_say',
      heightCm: typeof raw.heightCm === 'number' ? raw.heightCm : existingProfile?.heightCm ?? 175,
      weightKg: typeof raw.weightKg === 'number' ? raw.weightKg : existingProfile?.weightKg ?? 75,
      bodyFatEstimate: typeof raw.bodyFatEstimate === 'number' ? raw.bodyFatEstimate : existingProfile?.bodyFatEstimate ?? undefined,
      lifestyle: typeof raw.lifestyle === 'string' ? (raw.lifestyle as any) : existingProfile?.lifestyle ?? 'active',
      experienceLevel: typeof raw.experienceLevel === 'string' ? (raw.experienceLevel as any) : existingProfile?.experienceLevel ?? 'beginner',
    };

    await upsertUserAndProfile(context.db, context.user, mergedProfile, now);
    const updated = await getLatestProfileForUser(context.db, context.user.id);

    return c.json({
      data: {
        displayName:
          typeof raw.displayName === 'string'
            ? raw.displayName
            : (context.user as any).displayName || (context.user as any).name,
        email: typeof raw.email === 'string' ? raw.email : context.user.email,
        age: updated?.age ?? mergedProfile.age,
        sex: updated?.sex ?? mergedProfile.sex,
        heightCm: updated?.heightCm ?? mergedProfile.heightCm,
        weightKg: updated?.weightKg ?? mergedProfile.weightKg,
        ...(updated?.bodyFatEstimate ? { bodyFatEstimate: updated.bodyFatEstimate } : {}),
        lifestyle: updated?.lifestyle ?? mergedProfile.lifestyle,
        experienceLevel: updated?.experienceLevel ?? mergedProfile.experienceLevel,
      },
    });
  });

  return route;
}

export const profilesRouter = createProfileRoutes();
