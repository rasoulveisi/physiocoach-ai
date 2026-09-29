import { z } from 'zod';
import type { AIProvider } from '../types/ai';
import { logAiAuditEntry } from './ai-audit-logger';
import type { createDb } from '../db/client';

type DbClient = ReturnType<typeof createDb>;

// ─── Input & Output Schemas ──────────────────────────────────────────────────

export const rawSafetyIssueSchema = z.object({
  dayIndex: z.coerce.number().int().min(0).optional(),
  day_index: z.coerce.number().int().min(0).optional(),
  exerciseIndex: z.coerce.number().int().min(0).optional(),
  exercise_index: z.coerce.number().int().min(0).optional(),
  exerciseName: z.string().optional(),
  exercise_name: z.string().optional(),
  name: z.string().optional(),
  problemText: z.string().optional(),
  problem_text: z.string().optional(),
  reason: z.string().optional(),
  actionType: z.union([z.enum(['SWAP', 'REDUCE_SETS']), z.string()]).transform((val) => {
    const u = String(val).toUpperCase();
    return u.includes('REDUCE') ? ('REDUCE_SETS' as const) : ('SWAP' as const);
  }),
  suggestedExerciseName: z.string().optional(),
  suggested_exercise_name: z.string().optional(),
  suggestedExerciseId: z.string().optional(),
  suggested_exercise_id: z.string().optional(),
  suggestedSets: z.coerce.number().int().min(1).max(10).optional(),
  suggested_sets: z.coerce.number().int().min(1).max(10).optional(),
});

export interface SafetyIssue {
  dayIndex: number;
  exerciseIndex: number;
  exerciseName: string;
  problemText: string;
  actionType: 'SWAP' | 'REDUCE_SETS';
  suggestedExerciseName?: string | undefined;
  suggestedExerciseId?: string | undefined;
  suggestedSets?: number | undefined;
}

export const safetyIssueSchema: z.ZodType<SafetyIssue> = rawSafetyIssueSchema.transform(
  (data): SafetyIssue => {
    const issue: SafetyIssue = {
      dayIndex: data.dayIndex ?? data.day_index ?? 0,
      exerciseIndex: data.exerciseIndex ?? data.exercise_index ?? 0,
      exerciseName: data.exerciseName ?? data.exercise_name ?? data.name ?? 'Exercise',
      problemText:
        data.problemText ?? data.problem_text ?? data.reason ?? 'Needs adjustment for your safety.',
      actionType: data.actionType,
    };
    const suggestedEx = data.suggestedExerciseName ?? data.suggested_exercise_name;
    if (suggestedEx !== undefined) issue.suggestedExerciseName = suggestedEx;
    const suggestedId = data.suggestedExerciseId ?? data.suggested_exercise_id;
    if (suggestedId !== undefined) issue.suggestedExerciseId = suggestedId;
    const sets = data.suggestedSets ?? data.suggested_sets;
    if (sets !== undefined) issue.suggestedSets = sets;
    return issue;
  },
);

export const safetyEvaluationOutputSchema = z.object({
  safetyScore: z.coerce.number().int().min(0).max(100),
  status: z.enum(['safe', 'caution', 'unsafe']),
  summary: z.string().min(1),
  issues: z.array(safetyIssueSchema),
});

export type SafetyEvaluationOutput = z.infer<typeof safetyEvaluationOutputSchema>;

export interface CustomPlanSafetyEvaluationResult extends SafetyEvaluationOutput {
  traceId: string;
  auditLogId: string;
}

export interface UserSafetyProfileContext {
  age?: number | null | undefined;
  sex?: string | null | undefined;
  experienceLevel?: string | null | undefined;
  lifestyle?: string | null | undefined;
  limitations?: string[] | null | undefined;
  postureFlags?: string[] | null | undefined;
  goals?: string[] | null | undefined;
  equipment?: string[] | null | undefined;
}

export interface PlanEvaluationExercise {
  exerciseId?: string | undefined;
  exerciseName: string;
  movementPattern?: string | undefined;
  muscleGroups?: string[] | undefined;
  sets?: number | unknown[] | undefined;
}

export interface PlanEvaluationDay {
  dayName: string;
  exercises: PlanEvaluationExercise[];
}

export interface PlanEvaluationInput {
  days: PlanEvaluationDay[];
  split?: string | undefined;
}

export interface EvaluateSafetyOptions {
  userContext: UserSafetyProfileContext;
  plan: PlanEvaluationInput;
  provider?: AIProvider | null | undefined;
  db?: DbClient | undefined;
  userId?: string | null | undefined;
  traceId?: string | undefined;
}

// ─── Deterministic Rules & Clinical Knowledge Base ──────────────────────────

interface ContraindicationRule {
  keywords: string[];
  limitationKeywords: string[];
  problemText: string;
  suggestedExerciseName: string;
  suggestedExerciseId: string;
}

const CONTRAINDICATION_RULES: ContraindicationRule[] = [
  {
    keywords: ['deadlift', 'barbell deadlift', 'good morning', 'back squat', 'barbell squat'],
    limitationKeywords: ['lower_back', 'lumbar', 'back_pain', 'disc', 'spine', 'sciatica'],
    problemText: 'Puts heavy stress on your lower back. Can trigger pain.',
    suggestedExerciseName: 'Belt Squat',
    suggestedExerciseId: 'belt-squat',
  },
  {
    keywords: ['bent over row', 'barbell row'],
    limitationKeywords: ['lower_back', 'lumbar', 'back_pain', 'disc', 'spine'],
    problemText: 'Hanging forward with heavy weight strains your lower back.',
    suggestedExerciseName: 'Chest Supported Dumbbell Row',
    suggestedExerciseId: 'chest-supported-row',
  },
  {
    keywords: ['hack squat', 'sissy squat', 'leg extension', 'deep leg press'],
    limitationKeywords: ['knee', 'patella', 'meniscus', 'knee_pain'],
    problemText: 'Puts heavy pressure on your bad knee.',
    suggestedExerciseName: 'Goblet Box Squat',
    suggestedExerciseId: 'goblet-squat',
  },
  {
    keywords: ['behind neck', 'behind-neck', 'upright row'],
    limitationKeywords: ['shoulder', 'rotator_cuff', 'impingement', 'shoulder_pain'],
    problemText: 'Pinches your shoulder joint. Best to avoid this angle.',
    suggestedExerciseName: 'Cable Face Pull',
    suggestedExerciseId: 'face-pull',
  },
  {
    keywords: ['barbell overhead press', 'military press', 'overhead press'],
    limitationKeywords: ['shoulder_pain', 'rotator_cuff', 'impingement'],
    problemText: 'Lifting heavy weight directly overhead can pinch your shoulder.',
    suggestedExerciseName: 'Incline Neutral-Grip Dumbbell Press',
    suggestedExerciseId: 'incline-db-bench',
  },
  {
    keywords: ['behind neck'],
    limitationKeywords: ['neck', 'cervical', 'neck_pain'],
    problemText: 'Strains your neck muscles and joints.',
    suggestedExerciseName: 'Front Lat Pulldown',
    suggestedExerciseId: 'lat-pulldown',
  },
];

function getSetCount(sets: unknown): number {
  if (typeof sets === 'number') return sets;
  if (Array.isArray(sets)) return sets.length;
  return 3;
}

/**
 * Computes deterministic safety evaluation in <5ms.
 * Ensures client-friendly, everyday language and exact recommendations.
 */
export function evaluateDeterministicSafety(
  plan: PlanEvaluationInput,
  profile: UserSafetyProfileContext,
): SafetyEvaluationOutput {
  const issues: SafetyIssue[] = [];
  const limitations = (profile.limitations ?? []).map((l) => l.toLowerCase());
  const postureFlags = (profile.postureFlags ?? []).map((p) => p.toLowerCase());
  const userLimitationsCombined = [...limitations, ...postureFlags];
  const experience = (profile.experienceLevel ?? 'intermediate').toLowerCase();

  const muscleSetTotals: Record<string, { totalSets: number; dayIndices: Set<number>; firstDayIdx: number; firstExIdx: number; exName: string }> = {};

  plan.days.forEach((day, dayIndex) => {
    day.exercises.forEach((ex, exerciseIndex) => {
      const exName = (ex.exerciseName || '').toLowerCase();
      const setCount = getSetCount(ex.sets);

      // Track muscle volume
      const muscle = (ex.muscleGroups?.[0] || 'general').toLowerCase();
      if (!muscleSetTotals[muscle]) {
        muscleSetTotals[muscle] = { totalSets: 0, dayIndices: new Set(), firstDayIdx: dayIndex, firstExIdx: exerciseIndex, exName: ex.exerciseName };
      }
      muscleSetTotals[muscle].totalSets += setCount;
      muscleSetTotals[muscle].dayIndices.add(dayIndex);

      // Check contraindications
      for (const rule of CONTRAINDICATION_RULES) {
        const matchesExercise = rule.keywords.some((kw) => exName.includes(kw));
        const matchesLimitation =
          userLimitationsCombined.length === 0
            ? false
            : rule.limitationKeywords.some((lim) =>
                userLimitationsCombined.some((uLim) => uLim.includes(lim)),
              );

        // Also check universal high-shear contraindications (e.g. behind-neck or upright row)
        const isUniversallyDangerous =
          exName.includes('behind neck') || exName.includes('behind-neck');

        if ((matchesExercise && matchesLimitation) || isUniversallyDangerous) {
          // Avoid duplicate issues on the same exercise
          const alreadyFlagged = issues.some(
            (i) => i.dayIndex === dayIndex && i.exerciseIndex === exerciseIndex,
          );
          if (!alreadyFlagged) {
            issues.push({
              dayIndex,
              exerciseIndex,
              exerciseName: ex.exerciseName,
              problemText: rule.problemText,
              actionType: 'SWAP',
              suggestedExerciseName: rule.suggestedExerciseName,
              suggestedExerciseId: rule.suggestedExerciseId,
            });
          }
          break;
        }
      }
    });
  });

  // Check Volume Limits
  const maxWeeklySets = experience === 'beginner' ? 14 : experience === 'intermediate' ? 20 : 25;
  for (const [muscle, stat] of Object.entries(muscleSetTotals)) {
    if (stat.totalSets > maxWeeklySets && muscle !== 'general') {
      const excess = stat.totalSets - maxWeeklySets;
      issues.push({
        dayIndex: stat.firstDayIdx,
        exerciseIndex: stat.firstExIdx,
        exerciseName: stat.exName,
        problemText: `Too many sets for your ${muscle} this week (${stat.totalSets} sets). Muscles need rest to recover.`,
        actionType: 'REDUCE_SETS',
        suggestedSets: Math.max(2, 4 - Math.min(2, excess)),
      });
    }
  }

  // Calculate score & status
  let score = 96;
  if (issues.length > 0) {
    const swapDeduction = 15;
    const volumeDeduction = 10;
    for (const issue of issues) {
      if (issue.actionType === 'SWAP') score -= swapDeduction;
      else score -= volumeDeduction;
    }
    score = Math.max(40, Math.min(88, score));
  }

  let status: 'safe' | 'caution' | 'unsafe' = 'safe';
  let summary = 'Great job! This routine is well balanced and safe for your body.';

  if (score < 70) {
    status = 'unsafe';
    summary = `Your plan has ${issues.length} exercises that risk causing pain. See quick fixes below.`;
  } else if (score < 90) {
    status = 'caution';
    summary = `Good routine with ${issues.length} adjustment${issues.length > 1 ? 's' : ''} recommended to protect your joints.`;
  }

  return {
    safetyScore: score,
    status,
    summary,
    issues,
  };
}

// ─── AI Evaluation Prompt & Execution ───────────────────────────────────────

function buildPrompt(plan: PlanEvaluationInput, profile: UserSafetyProfileContext): string {
  const planSummary = plan.days.map((d, dIdx) => ({
    dayNumber: dIdx + 1,
    name: d.dayName,
    exercises: d.exercises.map((e, eIdx) => ({
      index: eIdx,
      name: e.exerciseName,
      pattern: e.movementPattern || 'unspecified',
      muscle: e.muscleGroups?.[0] || 'unspecified',
      sets: getSetCount(e.sets),
    })),
  }));

  return `You are PhysioCoach AI, an elite physiotherapy and exercise safety specialist.
Assess the user's custom workout plan against their personal health profile.

USER HEALTH PROFILE:
- Age: ${profile.age ?? 'Not specified'}
- Experience Level: ${profile.experienceLevel ?? 'Intermediate'}
- Reported Pain or Injuries: ${(profile.limitations ?? []).join(', ') || 'None reported'}
- Posture Flags: ${(profile.postureFlags ?? []).join(', ') || 'None reported'}
- Available Equipment: ${(profile.equipment ?? []).join(', ') || 'All standard gym equipment'}

CUSTOM WORKOUT PLAN:
${JSON.stringify(planSummary, null, 2)}

CRITICAL LANGUAGE GUIDELINE:
- All warnings and explanations MUST use simple, everyday, client-friendly words.
- DO NOT use complex medical jargon or clinical biomechanical terms.
- Say "Puts heavy stress on your lower back" instead of "axial spinal compression".
- Say "Pinches your shoulder joint" instead of "subacromial impingement".
- Say "Hard on your kneecap" instead of "patellofemoral shear".
- Say "Too many sets for your recovery" instead of "MRV exceeded".

EVALUATION RULES:
1. "safetyScore": Integer from 0 to 100 based on joint safety and recovery load.
2. "status": 'safe' (>=90), 'caution' (70-89), or 'unsafe' (<70).
3. "summary": Exactly ONE short, encouraging sentence in plain English.
4. "issues": Array of specific problems.
   - For joint pain/contraindications: actionType: "SWAP" with suggestedExerciseName and suggestedExerciseId.
   - For excessive sets/volume: actionType: "REDUCE_SETS" with suggestedSets (e.g. 3).
   - If everything is safe, "issues" MUST be an empty array [].

OUTPUT FORMAT: Return raw JSON matching this structure:
{
  "safetyScore": 82,
  "status": "caution",
  "summary": "Your plan has 1 exercise that can strain your lower back.",
  "issues": [
    {
      "dayIndex": 0,
      "exerciseIndex": 0,
      "exerciseName": "Barbell Deadlift",
      "problemText": "Puts heavy stress on your lower back. Can trigger pain.",
      "actionType": "SWAP",
      "suggestedExerciseName": "Belt Squat",
      "suggestedExerciseId": "belt-squat"
    }
  ]
}`;
}

// ─── Main Orchestration Function ───────────────────────────────────────────

export async function evaluateCustomPlanSafety(
  options: EvaluateSafetyOptions,
): Promise<CustomPlanSafetyEvaluationResult> {
  const startMs = Date.now();
  const traceId = options.traceId ?? `trace_${crypto.randomUUID()}`;
  const auditLogId = `audit_${crypto.randomUUID()}`;
  const { userContext, plan, provider, db, userId } = options;

  // Run deterministic baseline first
  const deterministicBaseline = evaluateDeterministicSafety(plan, userContext);

  // If no AI provider is configured or available, return deterministic result
  if (!provider) {
    const latencyMs = Date.now() - startMs;
    await logAiAuditEntry(db, {
      id: auditLogId,
      traceId,
      userId: userId ?? null,
      task: 'custom_plan_safety_evaluation',
      provider: 'deterministic',
      model: 'physiocoach-safety-rules-v1',
      prompt: JSON.stringify({ userContext, plan }),
      completion: JSON.stringify(deterministicBaseline),
      status: 'success',
      latencyMs,
    });

    return {
      ...deterministicBaseline,
      traceId,
      auditLogId,
    };
  }

  // AI Structured Generation
  const prompt = buildPrompt(plan, userContext);
  try {
    const response = await provider.generateStructured<SafetyEvaluationOutput>({
      task: 'custom_plan_safety_evaluation',
      inputHash: traceId,
      prompt,
      schema: safetyEvaluationOutputSchema,
    });

    const parsed = safetyEvaluationOutputSchema.safeParse(response.payload);
    const latencyMs = Date.now() - startMs;

    if (parsed.success) {
      await logAiAuditEntry(db, {
        id: auditLogId,
        traceId,
        userId: userId ?? null,
        task: 'custom_plan_safety_evaluation',
        provider: response.model.includes('gemini') ? 'google' : 'openrouter',
        model: response.model,
        prompt,
        completion: JSON.stringify(parsed.data),
        status: 'success',
        latencyMs,
      });

      return {
        ...parsed.data,
        traceId,
        auditLogId,
      };
    }

    // Schema parsing issue, log and fallback
    await logAiAuditEntry(db, {
      id: auditLogId,
      traceId,
      userId: userId ?? null,
      task: 'custom_plan_safety_evaluation',
      provider: response.model.includes('gemini') ? 'google' : 'openrouter',
      model: response.model,
      prompt,
      completion: JSON.stringify(response.payload),
      status: 'schema_rejected',
      schemaIssuesJson: JSON.stringify(parsed.error.issues),
      latencyMs,
    });

    return {
      ...deterministicBaseline,
      traceId,
      auditLogId,
    };
  } catch (error) {
    const latencyMs = Date.now() - startMs;
    await logAiAuditEntry(db, {
      id: auditLogId,
      traceId,
      userId: userId ?? null,
      task: 'custom_plan_safety_evaluation',
      provider: 'unknown',
      model: 'unknown',
      prompt,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
      latencyMs,
    });

    // Gracefully fall back to deterministic baseline
    return {
      ...deterministicBaseline,
      traceId,
      auditLogId,
    };
  }
}
