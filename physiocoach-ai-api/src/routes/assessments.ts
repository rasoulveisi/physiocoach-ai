import { and, desc, eq, inArray } from 'drizzle-orm';
import { Hono, type Context } from 'hono';

import { assessmentConsiderations, assessments, bodyConsiderations } from '../db/schema';
import type { WorkerBindings } from '../env';
import { createApiError, handleRouteError } from '../shared/errors/api';
import {
  assessmentInputSchema,
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
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/assessments', (c) => c.json({ data: [] }));

  route.get('/considerations', (c) => c.json({ data: BODY_CONSIDERATION_OPTIONS }));

  async function loadLatestAssessment(c: Context<{ Bindings: WorkerBindings }>) {
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

    const parsedGoals = safeJsonParse(row.goalsJson, []);
    const parsedLimitations = safeJsonParse(row.limitationsJson, []);
    const parsedPostureFlags = safeJsonParse(row.postureFlagsJson, []);
    const parsedEquipment = safeJsonParse(row.equipmentJson, []);
    const normalizedConsiderations = await loadAssessmentConsiderations(db, row.id);
    const considerations =
      normalizedConsiderations.length > 0
        ? normalizedConsiderations
        : normalizeLegacyAssessmentConsiderations({
            limitations: parsedLimitations,
            postureFlags: parsedPostureFlags,
          });
    const candidate = {
      goals: parsedGoals,
      frequencyDays: row.frequencyDays,
      equipment: parsedEquipment,
      limitations: parsedLimitations,
      postureFlags: parsedPostureFlags,
      considerations,
      completedAt: row.completedAt,
      inputHash: row.inputHash,
    };
    const parsed = latestAssessmentOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      return createApiError(
        c,
        'invalid_request',
        'Stored latest assessment record is not compatible with current schema.',
        {
          status: 500,
          details: parsed.error.issues,
        },
      );
    }

    return c.json({
      data: parsed.data,
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
      return handleRouteError(c, error, 'Failed to load latest assessment.');
    }
  });

  return route;
}

function normalizedAssessmentConsiderations(input: {
  considerations?: AssessmentConsideration[] | undefined;
  limitations?: string[] | undefined;
  postureFlags?: string[] | undefined;
}): AssessmentConsideration[] {
  return resolveAssessmentConsiderations(input);
}

function hasExplicitConsiderations(input: unknown): boolean {
  return typeof input === 'object' && input !== null && Object.hasOwn(input, 'considerations');
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
        eq(bodyConsiderations.active, 1),
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
      inferred: consideration.inferred ? 1 : 0,
      createdAt,
    })),
  );
}

async function loadAssessmentConsiderations(
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
    inferred: row.inferred === 1,
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
