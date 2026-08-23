import { and, desc, eq, inArray } from 'drizzle-orm';

import { assessmentConsiderations, assessments, bodyConsiderations } from '../db/schema';
import type { ExpressRouteContext } from './express-adapter';
import { createExpressRouter } from './express-adapter';
import { createApiError, handleRouteError } from '../shared/errors/api';
import {
  assessmentInputSchema,
  hasExplicitConsiderations,
  legacySafetyContextFromConsiderations,
  latestAssessmentOutputSchema,
  normalizeLegacyAssessmentConsiderations,
  resolveAssessmentConsiderations,
  type AssessmentConsideration,
} from '../types/assessment';
import { getApiRouteContext, hasDbClient } from './context';
import { parseJsonPayload } from './validation';
import { createInputHash } from '../services/input-hash';

const BODY_CONSIDERATION_OPTIONS = [
  {
    code: 'rounded_shoulders',
    displayName: 'Rounded shoulders',
    groupCode: 'posture',
    bodyRegion: 'shoulders',
    kind: 'posture',
    severityEnabled: true,
  },
  {
    code: 'neck_pain',
    displayName: 'Neck pain or stiffness',
    groupCode: 'neck',
    bodyRegion: 'neck',
    kind: 'pain',
    severityEnabled: true,
  },
  {
    code: 'shoulder_pain',
    displayName: 'Shoulder pain',
    groupCode: 'shoulders',
    bodyRegion: 'shoulders',
    kind: 'pain',
    severityEnabled: true,
  },
  {
    code: 'lower_back_pain',
    displayName: 'Lower-back pain',
    groupCode: 'back',
    bodyRegion: 'lower_back',
    kind: 'pain',
    severityEnabled: true,
  },
  {
    code: 'knee_pain',
    displayName: 'Knee pain',
    groupCode: 'knees',
    bodyRegion: 'knees',
    kind: 'pain',
    severityEnabled: true,
  },
] as const;

export function createAssessmentRoutes() {
  const route = createExpressRouter();

  route.get('/considerations', (c) => c.json({ data: BODY_CONSIDERATION_OPTIONS }));

  async function loadLatestAssessment(c: ExpressRouteContext) {
    const { user, db } = getApiRouteContext(c);
    if (!db) return c.json({ data: null });

    const rows = await db
      .select()
      .from(assessments)
      .where(eq(assessments.userId, user.id))
      .orderBy(desc(assessments.completedAt))
      .limit(1);

    const row = rows[0];
    if (!row) return c.json({ data: null });

    const parsedGoals = safeJsonParse(row.goalsJson, ['strength']);
    const parsedLimitations = safeJsonParse(row.limitationsJson, []);
    const parsedPostureFlags = safeJsonParse(row.postureFlagsJson, []);
    const parsedEquipment = safeJsonParse(row.equipmentJson, ['home_gym']);
    const normalizedConsiderations = await loadAssessmentConsiderations(db, row.id);
    const considerations =
      normalizedConsiderations.length > 0
        ? normalizedConsiderations
        : normalizeLegacyAssessmentConsiderations({
            limitations: parsedLimitations,
            postureFlags: parsedPostureFlags,
          });

    const safeCompletedAt =
      typeof row.completedAt === 'string' && !isNaN(Date.parse(row.completedAt))
        ? new Date(row.completedAt).toISOString()
        : new Date().toISOString();

    const candidate = {
      goals: Array.isArray(parsedGoals) && parsedGoals.length > 0 ? parsedGoals : ['strength'],
      frequencyDays: typeof row.frequencyDays === 'number' && row.frequencyDays >= 2 ? row.frequencyDays : 3,
      equipment: Array.isArray(parsedEquipment) && parsedEquipment.length > 0 ? parsedEquipment : ['home_gym'],
      limitations: Array.isArray(parsedLimitations) ? parsedLimitations : [],
      postureFlags: Array.isArray(parsedPostureFlags) ? parsedPostureFlags : [],
      considerations: Array.isArray(considerations) ? considerations : [],
      completedAt: safeCompletedAt,
      inputHash: typeof row.inputHash === 'string' && row.inputHash.length > 0 ? row.inputHash : 'assessment_legacy',
    };

    const parsed = latestAssessmentOutputSchema.safeParse(candidate);
    return c.json({
      data: parsed.success ? parsed.data : candidate,
    });
  }

  route.post('/assessments', async (c) => {
    try {
      const context = getApiRouteContext(c);
      const parsed = await parseJsonPayload(c, assessmentInputSchema);
      if (!parsed.success) return parsed.response;
      const input = hasExplicitConsiderations(parsed.raw)
        ? parsed.data
        : { ...parsed.data, considerations: undefined };

      if (hasDbClient(context)) {
        const assessmentId = `assessment_${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const considerations = normalizedAssessmentConsiderations(input);
        const legacySafety = legacySafetyContextFromConsiderations(considerations);
        const assessment = { ...input, considerations, ...legacySafety };
        const inputHash = await createInputHash({
          promptVersion: '1.0',
          assessment,
        });

        const invalidCodes = await findInactiveOrUnknownCodes(context.db, considerations);
        if (invalidCodes.length > 0) {
          return createApiError(
            c,
            'invalid_request',
            'Assessment includes inactive or unknown consideration codes.',
            {
              details: { codes: invalidCodes },
            },
          );
        }

        await context.db.insert(assessments).values({
          id: assessmentId,
          userId: context.user.id,
          goalsJson: JSON.stringify(input.goals),
          frequencyDays: input.frequencyDays,
          equipmentJson: JSON.stringify(input.equipment),
          limitationsJson: JSON.stringify(legacySafety.limitations),
          postureFlagsJson: JSON.stringify(legacySafety.postureFlags),
          completedAt: now,
          inputHash: inputHash,
        });
        await insertAssessmentConsiderations(context.db, assessmentId, considerations, now);
        return c.json({ data: assessment });
      }

      const considerations = normalizedAssessmentConsiderations(input);
      const legacySafety = legacySafetyContextFromConsiderations(considerations);
      return c.json({ data: { ...input, considerations, ...legacySafety } });
    } catch (error) {
      return handleRouteError(c, error, 'Failed to save assessment.');
    }
  });

  route.get('/assessments/latest', async (c) => {
    try {
      return await loadLatestAssessment(c);
    } catch (error) {
      console.warn('assessments.latest.fallback', error);
      return c.json({ data: null });
    }
  });

  return route;
}

export const assessmentsRouter = createAssessmentRoutes();

function normalizedAssessmentConsiderations(input: {
  considerations?: AssessmentConsideration[] | undefined;
  limitations?: string[] | undefined;
  postureFlags?: string[] | undefined;
}): AssessmentConsideration[] {
  return resolveAssessmentConsiderations(input);
}

async function findInactiveOrUnknownCodes(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  considerations: readonly AssessmentConsideration[],
): Promise<string[]> {
  if (considerations.length === 0) return [];
  const rows = await db
    .select({ code: bodyConsiderations.code })
    .from(bodyConsiderations)
    .where(
      and(
        inArray(
          bodyConsiderations.code,
          considerations.map(({ code }) => code),
        ),
        eq(bodyConsiderations.active, true),
      ),
    );
  const activeCodes = new Set(rows.map((row) => row.code));
  return considerations.map(({ code }) => code).filter((code) => !activeCodes.has(code));
}

async function insertAssessmentConsiderations(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  assessmentId: string,
  considerations: readonly AssessmentConsideration[],
  createdAt: string,
): Promise<void> {
  if (considerations.length === 0) return;
  const rows = await db
    .select({ id: bodyConsiderations.id, code: bodyConsiderations.code })
    .from(bodyConsiderations)
    .where(
      inArray(
        bodyConsiderations.code,
        considerations.map(({ code }) => code),
      ),
    );
  const idsByCode = new Map(rows.map((row) => [row.code, row.id]));
  await db.insert(assessmentConsiderations).values(
    considerations.map((consideration) => ({
      assessmentId,
      considerationId: idsByCode.get(consideration.code)!,
      severity: consideration.severity,
      side: consideration.side,
      notes: consideration.notes ?? null,
      inferred: Boolean(consideration.inferred),
      createdAt,
    })),
  );
}

export async function loadAssessmentConsiderations(
  db: NonNullable<ReturnType<typeof getApiRouteContext>['db']>,
  assessmentId: string,
): Promise<AssessmentConsideration[]> {
  const rows = await db
    .select({
      code: bodyConsiderations.code,
      severity: assessmentConsiderations.severity,
      side: assessmentConsiderations.side,
      notes: assessmentConsiderations.notes,
      inferred: assessmentConsiderations.inferred,
    })
    .from(assessmentConsiderations)
    .innerJoin(
      bodyConsiderations,
      eq(assessmentConsiderations.considerationId, bodyConsiderations.id),
    )
    .where(eq(assessmentConsiderations.assessmentId, assessmentId));
  return rows.map((row) => ({
    code: row.code,
    severity: row.severity as AssessmentConsideration['severity'],
    side: row.side as AssessmentConsideration['side'],
    ...(row.notes ? { notes: row.notes } : {}),
    inferred: Boolean(row.inferred),
  }));
}

function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    const parsed = JSON.parse(input) as T;
    return parsed;
  } catch {
    return fallback;
  }
}
