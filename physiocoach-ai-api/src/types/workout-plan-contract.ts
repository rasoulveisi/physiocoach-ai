/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';
import type { WorkoutPlanPromptInputs, WorkoutPlanPromptContract } from './ai';
export type { WorkoutPlanPromptInputs, WorkoutPlanPromptContract };

export const WORKOUT_PLAN_PROMPT_VERSION = '2026-06-05-v3';
export const WORKOUT_PLAN_OUTPUT_SCHEMA_VERSION = '1.0';

export const WORKOUT_PLAN_SPLIT_VALUES = [
  'full_body',
  'upper_lower',
  'push_pull_legs',
  'custom',
] as const;

export const WORKOUT_PLAN_MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'push',
  'pull',
  'lunge',
  'carry',
  'core',
  'mobility',
] as const;

export const CANONICAL_PROGRESSION_RULE =
  'Increase load or reps by +10% after 2 pain-free sessions.';

const PROGRESSION_RULE_PERCENT_PATTERN = /(?:\b10\s*%|\bten\s+percent\b)/i;
const PROGRESSION_RULE_TWO_SESSIONS_PATTERN = /\b(?:2|two)\b/i;
const PROGRESSION_RULE_PAIN_FREE_PATTERN = /\bpain\s*[-\s]?free\b/i;
const PROGRESSION_RULE_STRENGTH_TARGET_PATTERN =
  /\b(?:load|loads|loaded|weight|weights|rep|reps|repetition|repetitions|volume|resistance|intensity)\b/i;
const PROGRESSION_RULE_UNSUPPORTED_TARGET_PATTERN =
  /\b(?:cardio|aerobic|endurance|running|run|cycling|cycle|steps)\b/i;

function normalizeProgressionRuleValue(input: string): string {
  return input
    .trim()
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
    .replace(/\bten\s+percent\b/gi, '10%')
    .replace(/10\s*%/g, '10%')
    .replace(/\btwo\b/gi, '2')
    .replace(/\bpain\s*free\b/gi, 'pain-free')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isCanonicalProgressionRule(input: string): boolean {
  const normalized = normalizeProgressionRuleValue(input);
  return (
    PROGRESSION_RULE_PERCENT_PATTERN.test(normalized) &&
    PROGRESSION_RULE_TWO_SESSIONS_PATTERN.test(normalized) &&
    PROGRESSION_RULE_PAIN_FREE_PATTERN.test(normalized) &&
    PROGRESSION_RULE_STRENGTH_TARGET_PATTERN.test(normalized) &&
    !PROGRESSION_RULE_UNSUPPORTED_TARGET_PATTERN.test(normalized)
  );
}

export function normalizeProgressionRule(input: string): string {
  return isCanonicalProgressionRule(input)
    ? CANONICAL_PROGRESSION_RULE
    : normalizeProgressionRuleValue(input);
}

export const workoutPlanExerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  masterExerciseId: z.string().min(1).optional(),
  muscleGroup: z.string().min(1),
  movementPattern: z.enum(WORKOUT_PLAN_MOVEMENT_PATTERNS),
  sets: z.number().int().min(1),
  reps: z.string().min(1),
  rpe: z.number().min(1).max(10).optional(),
  restSeconds: z.number().int().min(1).default(60),
  notes: z.string().min(1).optional(),
  customSets: z.array(z.any()).optional(),
});

export const workoutPlanAiExerciseSchema = workoutPlanExerciseSchema.extend({
  masterExerciseId: z.string().min(1),
});

export const workoutPlanDaySchema = z.object({
  dayNumber: z.number().int().min(1),
  name: z.string().min(1),
  focus: z.string().min(1),
  exercises: z.array(workoutPlanExerciseSchema).min(1),
});

export const workoutPlanProgressionSchema = z.object({
  baselineIntensity: z.literal('low-moderate'),
  progressionRule: z.literal(CANONICAL_PROGRESSION_RULE),
  increasePercent: z.number().min(1).max(100).default(10),
  conditions: z.array(z.string().min(1)).default([]),
});

function sanitizeAndRepairRawPlan(plan: unknown): unknown {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return plan;
  }

  const raw = { ...(plan as any) };
  let isRepaired = false;

  // 1. Coerce schemaVersion to "1.0"
  if (raw.schemaVersion !== '1.0') {
    raw.schemaVersion = '1.0';
    isRepaired = true;
  }

  // 3. Transform safetyNotes and warnings from string to string arrays if they are strings
  if (typeof raw.safetyNotes === 'string') {
    raw.safetyNotes = [raw.safetyNotes];
    isRepaired = true;
  } else if (!Array.isArray(raw.safetyNotes)) {
    raw.safetyNotes = [];
    isRepaired = true;
  } else {
    const originalNotesCount = raw.safetyNotes.length;
    raw.safetyNotes = raw.safetyNotes.map((note: any) => String(note || '').trim()).filter(Boolean);
    if (raw.safetyNotes.length !== originalNotesCount) {
      isRepaired = true;
    }
  }

  if (typeof raw.warnings === 'string') {
    raw.warnings = [raw.warnings];
    isRepaired = true;
  } else if (!Array.isArray(raw.warnings)) {
    raw.warnings = [];
    isRepaired = true;
  } else {
    const originalWarningsCount = raw.warnings.length;
    raw.warnings = raw.warnings.map((warn: any) => String(warn || '').trim()).filter(Boolean);
    if (raw.warnings.length !== originalWarningsCount) {
      isRepaired = true;
    }
  }

  // Inject missing safety disclaimer, pain warning, and dizziness warning if absent
  const DISCLAIMER = 'Educational fitness recommendations only. Not medical advice.';
  const PAIN_WARNING = 'Stop immediately if pain increases during an exercise.';
  const DIZZY_WARNING = 'Do not continue if dizziness, lightheadedness, or chest pressure appears.';

  const hasDisclaimer = raw.warnings.some(
    (w: string) =>
      w.includes('Educational fitness recommendations only') ||
      w.includes('medical advice') ||
      w.includes('disclaimer'),
  );
  if (!hasDisclaimer) {
    raw.warnings.unshift(DISCLAIMER);
    isRepaired = true;
  }

  const hasPain = raw.warnings.some((w: string) => w.toLowerCase().includes('pain'));
  if (!hasPain) {
    raw.warnings.push(PAIN_WARNING);
    isRepaired = true;
  }

  const hasDizzy = raw.warnings.some((w: string) =>
    /dizziness|dizzy|lightheaded/.test(w.toLowerCase()),
  );
  if (!hasDizzy) {
    raw.warnings.push(DIZZY_WARNING);
    isRepaired = true;
  }

  // 4. Ensure progression structure is sound
  if (!raw.progression || typeof raw.progression !== 'object' || Array.isArray(raw.progression)) {
    raw.progression = {
      baselineIntensity: 'low-moderate',
      progressionRule: CANONICAL_PROGRESSION_RULE,
      increasePercent: 10,
      conditions: ['Two pain-free sessions'],
    };
    isRepaired = true;
  } else {
    const progression = { ...raw.progression };
    if (progression.baselineIntensity !== 'low-moderate') {
      progression.baselineIntensity = 'low-moderate';
      isRepaired = true;
    }
    if (progression.progressionRule !== CANONICAL_PROGRESSION_RULE) {
      progression.progressionRule = CANONICAL_PROGRESSION_RULE;
      isRepaired = true;
    }

    if (progression.increasePercent === undefined || progression.increasePercent === null) {
      progression.increasePercent = 10;
      isRepaired = true;
    } else if (typeof progression.increasePercent === 'string') {
      const parsed = parseInt(progression.increasePercent.replace(/\D/g, ''), 10);
      progression.increasePercent = isNaN(parsed) ? 10 : parsed;
      isRepaired = true;
    } else if (typeof progression.increasePercent !== 'number') {
      progression.increasePercent = 10;
      isRepaired = true;
    }

    if (!progression.conditions || !Array.isArray(progression.conditions)) {
      progression.conditions = ['Two pain-free sessions'];
      isRepaired = true;
    } else {
      const originalCondCount = progression.conditions.length;
      progression.conditions = progression.conditions
        .map((cond: any) => String(cond || '').trim())
        .filter(Boolean);
      if (progression.conditions.length !== originalCondCount) {
        isRepaired = true;
      }
    }
    raw.progression = progression;
  }

  // 5. Loop through days and exercises
  const WORKOUT_PLAN_MOVEMENT_PATTERNS = [
    'squat',
    'hinge',
    'push',
    'pull',
    'lunge',
    'carry',
    'core',
    'mobility',
  ];

  if (!Array.isArray(raw.days)) {
    raw.days = [];
    isRepaired = true;
  } else {
    raw.days = raw.days.map((dayObj: any, dayIndex: number) => {
      if (!dayObj || typeof dayObj !== 'object' || Array.isArray(dayObj)) {
        isRepaired = true;
        return {
          dayNumber: dayIndex + 1,
          name: `Day ${dayIndex + 1}`,
          focus: 'Full body strength',
          exercises: [],
        };
      }

      const day = { ...dayObj };

      // Flatten legacy nested structures: warmup, mainSet, main_set, cooldown
      const legacyKeys = ['warmup', 'mainSet', 'main_set', 'cooldown'];
      if (!day.exercises) {
        day.exercises = [];
      }
      for (const key of legacyKeys) {
        if (day[key]) {
          isRepaired = true;
          if (Array.isArray(day[key])) {
            day.exercises.push(...day[key]);
          } else if (typeof day[key] === 'object') {
            day.exercises.push(day[key]);
          }
          delete day[key];
        }
      }

      if (typeof day.dayNumber !== 'number') {
        const parsed = parseInt(String(day.dayNumber).replace(/\D/g, ''), 10);
        day.dayNumber = isNaN(parsed) ? dayIndex + 1 : parsed;
        isRepaired = true;
      } else if (day.dayNumber <= 0) {
        day.dayNumber = dayIndex + 1;
        isRepaired = true;
      }
      if (!day.focus || typeof day.focus !== 'string') {
        day.focus = 'Workout Focus';
        isRepaired = true;
      }
      if (!day.name || typeof day.name !== 'string') {
        day.name = day.focus || `Day ${day.dayNumber}`;
        isRepaired = true;
      }

      // Strip extra fields from day
      const extraDayFields = ['rationale', 'focusRationale'];
      for (const f of extraDayFields) {
        if (f in day) {
          delete day[f];
          isRepaired = true;
        }
      }

      if (!Array.isArray(day.exercises)) {
        day.exercises = [];
        isRepaired = true;
      } else {
        day.exercises = day.exercises.map((exObj: any, exIndex: number) => {
          if (!exObj || typeof exObj !== 'object' || Array.isArray(exObj)) {
            isRepaired = true;
            return {
              id: `ex_d${day.dayNumber}_${exIndex + 1}`,
              name: `Exercise ${exIndex + 1}`,
              muscleGroup: 'target',
              movementPattern: 'mobility',
              sets: 3,
              reps: '10',
              restSeconds: 60,
            };
          }

          const ex = { ...exObj };

          // Coerce id
          if (!ex.id || typeof ex.id !== 'string') {
            ex.id = `ex_d${day.dayNumber}_${exIndex + 1}`;
            isRepaired = true;
          }

          // Coerce name
          if (ex.namename !== undefined && ex.name === undefined) {
            ex.name = ex.namename;
            delete ex.namename;
            isRepaired = true;
          }
          if (!ex.name || typeof ex.name !== 'string') {
            ex.name = `Exercise ${exIndex + 1}`;
            isRepaired = true;
          }

          // Coerce/Infer movementPattern
          if (!ex.movementPattern || !WORKOUT_PLAN_MOVEMENT_PATTERNS.includes(ex.movementPattern)) {
            const nameLower = String(ex.name || '').toLowerCase();
            if (nameLower.includes('squat') || nameLower.includes('leg press')) {
              ex.movementPattern = 'squat';
            } else if (
              nameLower.includes('deadlift') ||
              nameLower.includes('swing') ||
              nameLower.includes('hinge') ||
              nameLower.includes('bridge') ||
              nameLower.includes('thrust') ||
              nameLower.includes('good morning')
            ) {
              ex.movementPattern = 'hinge';
            } else if (
              nameLower.includes('row') ||
              nameLower.includes('pull') ||
              nameLower.includes('chin') ||
              nameLower.includes('lat') ||
              nameLower.includes('face pull') ||
              nameLower.includes('curl')
            ) {
              ex.movementPattern = 'pull';
            } else if (
              nameLower.includes('press') ||
              nameLower.includes('push') ||
              nameLower.includes('dip') ||
              nameLower.includes('chest fly')
            ) {
              ex.movementPattern = 'push';
            } else if (
              nameLower.includes('lunge') ||
              nameLower.includes('step') ||
              nameLower.includes('split') ||
              nameLower.includes('bulgarian')
            ) {
              ex.movementPattern = 'lunge';
            } else if (
              nameLower.includes('carry') ||
              nameLower.includes('walk') ||
              nameLower.includes('farmer')
            ) {
              ex.movementPattern = 'carry';
            } else if (
              nameLower.includes('plank') ||
              nameLower.includes('ab') ||
              nameLower.includes('core') ||
              nameLower.includes('situp') ||
              nameLower.includes('crunch') ||
              nameLower.includes('woodchop') ||
              nameLower.includes('pallof')
            ) {
              ex.movementPattern = 'core';
            } else {
              ex.movementPattern = 'mobility';
            }
            isRepaired = true;
          }

          // Coerce muscleGroup
          if (!ex.muscleGroup || typeof ex.muscleGroup !== 'string') {
            ex.muscleGroup = ex.movementPattern || 'target';
            isRepaired = true;
          }

          // Coerce sets
          if (ex.sets === undefined || ex.sets === null) {
            ex.sets = 3;
            isRepaired = true;
          } else if (typeof ex.sets === 'string') {
            const parsed = parseInt(ex.sets.replace(/\D/g, ''), 10);
            ex.sets = isNaN(parsed) || parsed <= 0 ? 3 : parsed;
            isRepaired = true;
          } else if (typeof ex.sets === 'number') {
            if (ex.sets <= 0) {
              ex.sets = 3;
              isRepaired = true;
            }
          } else {
            ex.sets = 3;
            isRepaired = true;
          }

          // Coerce reps
          if (ex.reps === undefined || ex.reps === null) {
            ex.reps = '10';
            isRepaired = true;
          } else if (typeof ex.reps === 'number') {
            ex.reps = String(ex.reps);
            isRepaired = true;
          } else if (typeof ex.reps !== 'string') {
            ex.reps = '10';
            isRepaired = true;
          }

          // Coerce rpe (string/etc to number)
          if (ex.rpe !== undefined && ex.rpe !== null) {
            if (typeof ex.rpe === 'string') {
              const parsed = parseFloat(ex.rpe);
              if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
                ex.rpe = parsed;
              } else {
                delete ex.rpe;
              }
              isRepaired = true;
            } else if (typeof ex.rpe !== 'number' || ex.rpe < 1 || ex.rpe > 10) {
              delete ex.rpe;
              isRepaired = true;
            }
          }

          // Coerce restSeconds
          if (ex.restSeconds === undefined || ex.restSeconds === null) {
            ex.restSeconds = 60;
            isRepaired = true;
          } else if (typeof ex.restSeconds === 'string') {
            const parsed = parseInt(ex.restSeconds.replace(/\D/g, ''), 10);
            ex.restSeconds = isNaN(parsed) || parsed <= 0 ? 60 : parsed;
            isRepaired = true;
          } else if (typeof ex.restSeconds === 'number') {
            if (ex.restSeconds <= 0) {
              ex.restSeconds = 60;
              isRepaired = true;
            }
          } else {
            ex.restSeconds = 60;
            isRepaired = true;
          }

          // Map exerciseRationale or rationale to notes if notes is empty/missing
          const rawRationale = ex.exerciseRationale || ex.rationale;
          if (
            (!ex.notes || typeof ex.notes !== 'string') &&
            rawRationale &&
            typeof rawRationale === 'string'
          ) {
            ex.notes = rawRationale;
            isRepaired = true;
          }

          // Clean empty string notes
          if (ex.notes === '') {
            delete ex.notes;
            isRepaired = true;
          }

          // Strip extra fields from exercise
          const extraExFields = [
            'exerciseRationale',
            'rationale',
            'warmup',
            'cooldown',
            'mainSet',
            'main_set',
          ];
          for (const f of extraExFields) {
            if (f in ex) {
              delete ex[f];
              isRepaired = true;
            }
          }

          return ex;
        });
      }

      return day;
    });
  }

  // Set source based on repairs
  if (isRepaired) {
    raw.source = 'repaired';
  } else if (raw.source !== 'fallback') {
    raw.source = 'ai';
  }

  return raw;
}

const workoutPlanStrictObjectSchema = z.object({
  schemaVersion: z.literal('1.0'),
  source: z.enum(['ai', 'fallback', 'repaired']).default('ai'),
  name: z.string().optional(),
  description: z.string().optional(),
  scheduleType: z.string().optional(),
  summary: z.string().optional(),
  isCustom: z.boolean().optional(),
  days: z.array(workoutPlanDaySchema).min(1),
  progression: workoutPlanProgressionSchema,
  safetyNotes: z.array(z.string().min(1)).default([]),
  warnings: z.array(z.string().min(1)).default([]),
});

const workoutPlanAiOutputObjectSchema = workoutPlanStrictObjectSchema
  .omit({
    days: true,
    source: true,
  })
  .extend({
    source: z.enum(['ai', 'repaired']).default('ai'),
    days: z
      .array(
        workoutPlanDaySchema.extend({
          exercises: z.array(workoutPlanAiExerciseSchema).min(1),
        }),
      )
      .min(1),
  });

export const workoutPlanStrictSchema = z.preprocess(
  (val) => sanitizeAndRepairRawPlan(val),
  workoutPlanStrictObjectSchema,
);

export const workoutPlanAiOutputSchema = z.preprocess(
  (val) => sanitizeAndRepairRawPlan(val),
  workoutPlanAiOutputObjectSchema,
);

export type WorkoutPlanAiOutput = z.infer<typeof workoutPlanAiOutputSchema>;
export type WorkoutPlanAiStrictOutput = WorkoutPlanAiOutput;

export const workoutPlanStructuredOutputJsonSchema = z.toJSONSchema(
  workoutPlanAiOutputObjectSchema,
  {
    target: 'draft-7',
  },
);

export function buildCanonicalPromptContract(
  context: WorkoutPlanPromptInputs,
  generationRunHint = `run-${Date.now()}`,
): WorkoutPlanPromptContract {
  return {
    task: 'workout_plan_generation',
    promptVersion: WORKOUT_PLAN_PROMPT_VERSION,
    outputSchemaVersion: WORKOUT_PLAN_OUTPUT_SCHEMA_VERSION,
    generationRunHint,
    context: {
      ...context,
      equipment: [...context.equipment].sort(),
      limitations: [...context.limitations].sort(),
      postureFlags: [...context.postureFlags].sort(),
    },
    mustIncludeDisclaimer: 'Educational fitness recommendations only. Not medical advice.',
    constraints: [
      'Return strict JSON only.',
      'No markdown, code fences, prose, or inline comments.',
      'No medical claims or diagnostic language.',
      'Include disclaimer as an exact warning string.',
      'Match schema keys exactly as specified.',
    ],
  };
}
