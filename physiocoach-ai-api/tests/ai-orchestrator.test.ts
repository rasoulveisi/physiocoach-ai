import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AIProvider } from '../src/types/ai';
import {
  buildWorkoutPlanContext,
  createWorkoutPlanProvider,
  generateWorkoutPlanWithSafety,
  type CatalogCandidate,
  WorkoutPlanGenerationError,
} from '../src/services/workout-generator';
import { CANONICAL_PROGRESSION_RULE } from '../src/types/workout-plan-contract';
import { DISCLAIMER } from '../src/types/workout';
import { validateCandidatePlan } from '../src/services/plan-validator';

const context = {
  goal: 'posture_improvement',
  goals: ['posture_improvement', 'fat_loss', 'muscle_gain'],
  experienceLevel: 'intermediate' as const,
  frequencyDays: 3,
  sessionMinutes: 45,
  equipment: ['dumbbells', 'bench'],
  limitations: ['rounded shoulders'],
  considerations: [{ code: 'knee_pain', severity: 'moderate' as const }],
  postureFlags: {
    roundedShoulders: true,
  },
};

const modelConfig = {
  primaryModel: 'test/primary',
  fallbackModels: ['test/fallback-a'],
  timeoutMs: 10000,
};

const modelConfigWithoutFallback = {
  primaryModel: 'test/primary',
  fallbackModels: [],
  timeoutMs: 10000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const defaultDbCatalogRows = [
  {
    exerciseId: 'db_master_ex_1',
    exerciseCanonicalId: 'db_master_canon_ex_1',
    exerciseName: 'DB Goblet squat',
    movementPattern: 'squat',
    equipmentCanonicalId: 'dumbbells',
    equipmentName: 'Dumbbells',
    muscleName: 'legs',
    isPrimaryMuscle: 1,
    recommendedLevel: 'beginner',
    goalTagsJson: '["posture_improvement","fat_loss","muscle_gain"]',
    excludedLimitationsJson: '[]',
  },
];

type PlanWithExercises = {
  days: Array<{
    dayNumber: number;
    exercises: Array<{
      [key: string]: unknown;
      masterExerciseId: string;
    }>;
  }>;
};

function buildPlanWithMasterExerciseIds(
  plan: PlanWithExercises,
  masterExerciseIds: readonly string[],
) {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise, index) => ({
        ...exercise,
        masterExerciseId:
          masterExerciseIds[index % masterExerciseIds.length] ?? exercise.masterExerciseId,
      })),
    })),
  };
}

function buildPlanWithDbExerciseIds(plan: PlanWithExercises, primaryMasterExerciseId: string) {
  return buildPlanWithMasterExerciseIds(plan, [
    primaryMasterExerciseId,
    `${primaryMasterExerciseId}_filler_1`,
    `${primaryMasterExerciseId}_filler_2`,
  ]);
}

type DbCandidateRow = {
  exerciseId: string;
  exerciseCanonicalId: string;
  exerciseName: string;
  movementPattern: string;
  equipmentCanonicalId: string;
  equipmentName: string;
  muscleName: string;
  isPrimaryMuscle: number;
  recommendedLevel: string;
  goalTagsJson: string;
  excludedLimitationsJson: string;
};

function createFakeDb(rows: ReadonlyArray<Partial<DbCandidateRow>>) {
  const defaultRow = defaultDbCatalogRows[0]!;
  const resolvedRows = rows.flatMap((row, index) => {
    const exerciseId = row.exerciseId ?? `db_master_ex_${index + 1}`;
    const inheritedCanonical = row.exerciseCanonicalId ?? defaultRow.exerciseCanonicalId;
    const canonicalId =
      inheritedCanonical === defaultRow.exerciseCanonicalId && exerciseId !== defaultRow.exerciseId
        ? exerciseId
        : (inheritedCanonical ?? `db_master_canon_${index + 1}`);

    const resolvedRow = {
      ...defaultRow,
      ...row,
      exerciseId,
      exerciseCanonicalId: canonicalId,
    };

    return [
      resolvedRow,
      {
        ...resolvedRow,
        exerciseId: `${exerciseId}_filler_1`,
        exerciseCanonicalId: `${canonicalId}_filler_1`,
        exerciseName: `${resolvedRow.exerciseName} filler 1`,
      },
      {
        ...resolvedRow,
        exerciseId: `${exerciseId}_filler_2`,
        exerciseCanonicalId: `${canonicalId}_filler_2`,
        exerciseName: `${resolvedRow.exerciseName} filler 2`,
      },
    ];
  }) as ReadonlyArray<DbCandidateRow>;

  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    then: (resolve: (value: ReadonlyArray<DbCandidateRow>) => unknown) => resolve(resolvedRows),
  };

  return { select: () => query } as any;
}

function generateWithCandidates(
  provider: AIProvider,
  contextOverrides?: Partial<typeof context>,
  candidates: readonly CatalogCandidate[] = catalogCandidates,
) {
  return generateWorkoutPlanWithSafety(
    provider,
    { ...context, ...(contextOverrides ?? {}) },
    modelConfig,
    'legacy',
    {},
    undefined,
    candidates,
  );
}

function buildManyCatalogCandidates(count: number): CatalogCandidate[] {
  const movementPatterns: CatalogCandidate['movementPattern'][] = [
    'squat',
    'hinge',
    'push',
    'pull',
    'lunge',
    'carry',
    'core',
    'mobility',
  ];

  return Array.from({ length: count }, (_, index) => {
    const movementPattern = movementPatterns[index % movementPatterns.length]!;
    return {
      masterExerciseId: `wide_ex_${index + 1}`,
      sourceId: String(10_000 + index),
      name: `Wide ${movementPattern} exercise ${index + 1}`,
      movementPattern,
      allowedEquipment: ['dumbbells', 'bench', 'bodyweight'],
      primaryMuscleGroup: movementPattern,
      recommendedLevel: 'beginner' as const,
      goalTags: ['posture_improvement', 'fat_loss', 'muscle_gain', 'strength'],
      excludedLimitations: [],
    };
  });
}

function readApprovedExerciseIdsFromPrompt(prompt: string): Record<string, Record<string, string>> {
  const match = prompt.match(
    /Approved green exercise ID map by movement \(\{movement:\{id:name\}\}\): (\{.*?\})\.\nAmber candidates/s,
  );
  expect(match?.[1]).toBeDefined();
  return JSON.parse(match![1]!);
}

function countApprovedExerciseIds(grouped: Record<string, Record<string, string>>): number {
  return Object.values(grouped).reduce((total, group) => total + Object.keys(group).length, 0);
}

const catalogCandidates: CatalogCandidate[] = [
  {
    masterExerciseId: 'master_ex_1',
    name: 'Goblet squat',
    movementPattern: 'squat',
    allowedEquipment: ['dumbbells', 'bench', 'bodyweight'],
    primaryMuscleGroup: 'legs',
    recommendedLevel: 'intermediate' as const,
    goalTags: ['posture_improvement', 'fat_loss', 'muscle_gain', 'strength'],
    excludedLimitations: [],
  },
  {
    masterExerciseId: 'master_ex_2',
    name: 'Chest-supported row',
    movementPattern: 'pull',
    allowedEquipment: ['dumbbells', 'bench', 'bodyweight'],
    primaryMuscleGroup: 'back',
    recommendedLevel: 'beginner' as const,
    goalTags: ['posture_improvement', 'fat_loss', 'strength'],
    excludedLimitations: ['shoulder_pain'],
  },
  {
    masterExerciseId: 'master_ex_3',
    name: 'Dumbbell Romanian deadlift',
    movementPattern: 'hinge',
    allowedEquipment: ['dumbbells'],
    primaryMuscleGroup: 'glutes',
    recommendedLevel: 'intermediate' as const,
    goalTags: ['strength', 'posture_improvement'],
    excludedLimitations: ['lower_back_pain'],
  },
  {
    masterExerciseId: 'master_ex_4',
    name: 'Reverse lunge',
    movementPattern: 'pull',
    allowedEquipment: ['dumbbells', 'bench', 'bodyweight'],
    primaryMuscleGroup: 'legs',
    recommendedLevel: 'beginner' as const,
    goalTags: ['fat_loss', 'mobility', 'posture_improvement'],
    excludedLimitations: ['knee_pain'],
  },
  {
    masterExerciseId: 'master_ex_5',
    name: 'Barbell deadlift',
    movementPattern: 'hinge',
    allowedEquipment: ['full_gym'],
    primaryMuscleGroup: 'hamstrings',
    recommendedLevel: 'advanced' as const,
    goalTags: ['strength'],
    excludedLimitations: ['lower_back_pain'],
  },
  {
    masterExerciseId: 'master_ex_6',
    name: 'Chest-supported Dumbbell row',
    movementPattern: 'pull',
    allowedEquipment: ['dumbbells', 'bench'],
    primaryMuscleGroup: 'back',
    recommendedLevel: 'intermediate' as const,
    goalTags: ['posture_improvement', 'fat_loss'],
    excludedLimitations: ['shoulder_pain'],
  },
  {
    masterExerciseId: 'master_ex_7',
    name: 'Barbell back squat',
    movementPattern: 'squat',
    allowedEquipment: ['full_gym'],
    primaryMuscleGroup: 'legs',
    recommendedLevel: 'advanced' as const,
    goalTags: ['strength'],
    excludedLimitations: [],
  },
  {
    masterExerciseId: 'master_ex_8',
    name: 'Dumbbell Bench Press',
    movementPattern: 'push',
    allowedEquipment: ['dumbbells', 'bench'],
    primaryMuscleGroup: 'chest',
    recommendedLevel: 'intermediate' as const,
    goalTags: ['muscle_gain', 'strength'],
    excludedLimitations: ['shoulder_pain'],
  },
] as const;

const baseValidPlan = {
  schemaVersion: '1.0',
  source: 'ai',
  days: [
    {
      dayNumber: 1,
      name: 'Day 1',
      focus: 'Full body strength',
      exercises: [
        {
          id: 'ex_1',
          name: 'Goblet squat',
          masterExerciseId: 'master_ex_1',
          muscleGroup: 'legs',
          movementPattern: 'squat',
          sets: 3,
          reps: '8-10',
          restSeconds: 90,
        },
        {
          id: 'ex_2',
          name: 'Chest-supported row',
          masterExerciseId: 'master_ex_2',
          muscleGroup: 'back',
          movementPattern: 'pull',
          sets: 3,
          reps: '10-12',
          restSeconds: 90,
        },
      ],
    },
    {
      dayNumber: 2,
      name: 'Day 2',
      focus: 'Posterior chain',
      exercises: [
        {
          id: 'ex_3',
          name: 'Dumbbell Romanian deadlift',
          masterExerciseId: 'master_ex_3',
          muscleGroup: 'glutes',
          movementPattern: 'hinge',
          sets: 3,
          reps: '8-10',
          restSeconds: 90,
        },
      ],
    },
    {
      dayNumber: 3,
      name: 'Day 3',
      focus: 'Balanced strength',
      exercises: [
        {
          id: 'ex_4',
          name: 'Reverse lunge',
          masterExerciseId: 'master_ex_4',
          muscleGroup: 'legs',
          movementPattern: 'pull',
          sets: 3,
          reps: '8-10/side',
          restSeconds: 90,
        },
      ],
    },
  ],
  progression: {
    baselineIntensity: 'low-moderate',
    progressionRule: CANONICAL_PROGRESSION_RULE,
    increasePercent: 10,
    conditions: ['Two pain-free sessions'],
  },
  safetyNotes: [],
  warnings: [DISCLAIMER, 'Stop if pain increase or dizziness appears.'],
};

const invalidCandidatePlan = {
  ...baseValidPlan,
  days: baseValidPlan.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise, index) => ({
      ...exercise,
      masterExerciseId: index === 0 ? 'master_ex_unknown' : exercise.masterExerciseId,
    })),
  })),
};

const wrongDayCountPlan = {
  ...baseValidPlan,
  days: baseValidPlan.days.slice(0, 1),
};

describe('generateWorkoutPlanWithSafety', () => {
  it('returns a safety-validated AI plan when the provider succeeds', async () => {
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: baseValidPlan as T,
        };
      },
    };

    const result = await generateWithCandidates(provider);

    expect(result.source).toBe('ai');
    expect(result.model).toBe('test-model');
    expect(result.plan.days).toHaveLength(3);
    expect(result.plan.warnings).toContain(DISCLAIMER);
  });

  it('generates an ID-first prompt with approved catalog candidates', async () => {
    const prompts: string[] = [];
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>(request: any) {
        prompts.push(request.prompt);
        return {
          model: 'test-model',
          payload: baseValidPlan as T,
        };
      },
    };

    await generateWithCandidates(provider);

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('Profile: goals');
    expect(prompts[0]).toContain('session duration 45 min');
    expect(prompts[0]).toContain('Build a science-based intermediate');
    expect(prompts[0]).toContain('Candidate count is choice breadth, not target workout size');
    expect(prompts[0]).toContain(
      'Approved green exercise ID map by movement ({movement:{id:name}})',
    );
    expect(prompts[0]).toContain('Use catalog ID as masterExerciseId');
    expect(prompts[0]).toContain('"master_ex_1":"Goblet squat"');
    expect(prompts[0]).not.toContain('"movementPattern":"squat"');
  });

  it('never includes red candidates in the AI prompt', async () => {
    const prompts: string[] = [];
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>(request: any) {
        prompts.push(request.prompt);
        return { model: 'test-model', payload: baseValidPlan as T };
      },
    };
    const redCandidate: CatalogCandidate = {
      ...catalogCandidates[0]!,
      masterExerciseId: 'jump_squat',
      name: 'Jump squat',
      safetyRatings: [
        {
          considerationCode: 'knee_pain',
          severity: 'moderate',
          rating: 'avoid',
          reason: 'High impact can aggravate knee symptoms.',
        },
      ],
    };

    await generateWithCandidates(provider, undefined, [...catalogCandidates, redCandidate]);

    expect(prompts[0]).not.toContain('jump_squat');
    expect(prompts[0]).not.toContain('Jump squat');
  });

  it('injects the required amber modification when the AI omits it', async () => {
    const prompts: string[] = [];
    const amberByNamePlan = {
      ...baseValidPlan,
      days: baseValidPlan.days.map((day, dayIndex) => ({
        ...day,
        exercises: day.exercises.map((exercise, exerciseIndex) => {
          if (dayIndex !== 0 || exerciseIndex !== 0) return exercise;
          const output = { ...exercise };
          delete (output as any).masterExerciseId;
          return output;
        }),
      })),
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(amberByNamePlan) };
      },
      async generateStructured<T>(request: any) {
        prompts.push(request.prompt);
        return { model: 'test-model', payload: amberByNamePlan as T };
      },
    };
    const amberCandidates = catalogCandidates.map((candidate) =>
      candidate.masterExerciseId === 'master_ex_1'
        ? {
            ...candidate,
            safetyRatings: [
              {
                considerationCode: 'knee_pain',
                severity: 'moderate' as const,
                rating: 'caution' as const,
                reason: 'Keep the knee range comfortable.',
                requiredModification: 'Use a pain-free range of motion.',
              },
            ],
          }
        : candidate,
    );

    const result = await generateWithCandidates(provider, undefined, amberCandidates);

    expect(prompts[0]).toContain(
      'Amber candidates (at most one per day; include every required modification in notes)',
    );
    expect(prompts[0]).toContain('Keep the knee range comfortable.');
    expect(prompts[0]).toContain('Use a pain-free range of motion.');
    expect(result.plan.days[0]?.exercises[0]?.notes).toContain('Use a pain-free range of motion.');
  });

  it('rejects an AI plan exceeding one amber exercise per day', () => {
    const twoAmberPlan = {
      ...baseValidPlan,
      days: [
        {
          ...baseValidPlan.days[0],
          exercises: [
            { ...baseValidPlan.days[0]!.exercises[0], masterExerciseId: 'amber_one' },
            { ...baseValidPlan.days[0]!.exercises[1], masterExerciseId: 'amber_two' },
          ],
        },
      ],
    };
    const candidateSet: CatalogCandidate[] = [
      { ...catalogCandidates[0]!, masterExerciseId: 'amber_one', cluster: 'amber' },
      { ...catalogCandidates[1]!, masterExerciseId: 'amber_two', cluster: 'amber' },
    ];

    expect(validateCandidatePlan(twoAmberPlan, candidateSet).ok).toBe(false);
  });

  it('rejects an AI plan that selects a red catalog ID', () => {
    const redPlan = {
      days: [
        {
          dayNumber: 1,
          exercises: [{ masterExerciseId: 'jump_squat' }],
        },
      ],
    };
    const candidateSet: CatalogCandidate[] = [
      { ...catalogCandidates[0]!, masterExerciseId: 'jump_squat', cluster: 'red' },
    ];

    expect(validateCandidatePlan(redPlan, candidateSet)).toMatchObject({
      ok: false,
      issues: ['Day 1 selected excluded catalog exercise "jump_squat".'],
    });
  });

  it('fails with insufficient_safe_candidates when safety exclusions leave no safe coverage', async () => {
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: baseValidPlan as T };
      },
    };
    const allRedCandidates = catalogCandidates.map((candidate) => ({
      ...candidate,
      safetyRatings: [
        {
          considerationCode: 'knee_pain',
          severity: 'moderate' as const,
          rating: 'avoid' as const,
          reason: 'Avoid for this exact severity.',
        },
      ],
    }));

    await expect(
      generateWithCandidates(provider, undefined, allRedCandidates),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'insufficient_safe_candidates' },
    });
  });

  it('does not invent session duration when building context from assessment payload', () => {
    const builtContext = buildWorkoutPlanContext({
      profile: {
        age: 34,
        sex: 'male',
        heightCm: 180,
        weightKg: 82,
        lifestyle: 'desk_job',
        experienceLevel: 'beginner',
      },
      assessment: {
        goals: ['posture_improvement'],
        frequencyDays: 3,
        equipment: ['full_gym'],
        limitations: ['knee_pain'],
        postureFlags: ['rounded_shoulders'],
      },
    });

    expect(builtContext.sessionMinutes).toBeUndefined();
  });

  it('sends at least five times the final exercise count when enough candidates exist', async () => {
    const prompts: string[] = [];
    const wideCandidates = buildManyCatalogCandidates(120);
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>(request: any) {
        prompts.push(request.prompt);
        return {
          model: 'test-model',
          payload: buildPlanWithMasterExerciseIds(baseValidPlan, [
            'wide_ex_1',
            'wide_ex_2',
            'wide_ex_3',
            'wide_ex_4',
            'wide_ex_5',
            'wide_ex_6',
            'wide_ex_7',
            'wide_ex_8',
          ]) as T,
        };
      },
    };

    await generateWorkoutPlanWithSafety(
      provider,
      context,
      modelConfig,
      'legacy',
      {},
      undefined,
      wideCandidates,
    );

    const approvedExercises = readApprovedExerciseIdsFromPrompt(prompts[0]!);
    const approvedExerciseCount = countApprovedExerciseIds(approvedExercises);
    const finalExerciseCount = context.frequencyDays * 5;
    expect(approvedExerciseCount).toBe(finalExerciseCount * 6);
    expect(approvedExerciseCount).toBeGreaterThanOrEqual(finalExerciseCount * 5);
    expect(approvedExercises.squat).toMatchObject({
      '10000': 'Wide squat exercise 1',
    });
    expect(prompts[0]).toContain(
      `Candidate pool breadth: minimum approved options ${
        finalExerciseCount * 5
      }; preferred approved options ${finalExerciseCount * 6}; provided approved options ${
        finalExerciseCount * 6
      }. This is not the number of exercises to output.`,
    );
  });

  it('accepts lean AI output that identifies exercises by masterExerciseId', async () => {
    const leanPlan = {
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Squat and pull',
          exercises: [
            {
              masterExerciseId: 'master_ex_1',
              name: 'Goblet squat',
              sets: 3,
              reps: '8-10',
              restSeconds: 90,
            },
            {
              masterExerciseId: 'master_ex_2',
              name: 'Chest-supported row',
              sets: 3,
              reps: '10-12',
              restSeconds: 90,
            },
          ],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Posterior chain',
          exercises: [
            {
              masterExerciseId: 'master_ex_3',
              name: 'Dumbbell Romanian deadlift',
              sets: 3,
              reps: '8-10',
              restSeconds: 90,
            },
          ],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Balanced strength',
          exercises: [
            {
              masterExerciseId: 'master_ex_4',
              name: 'Reverse lunge',
              sets: 3,
              reps: '8-10/side',
              restSeconds: 90,
            },
          ],
        },
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(leanPlan) };
      },
      async generateStructured<T>(request: any) {
        return {
          model: 'test-model',
          payload: request.schema.parse(leanPlan) as T,
        };
      },
    };

    const result = await generateWithCandidates(provider);

    expect(result.source).toBe('ai');
    expect(result.plan.days[0]!.exercises[0]).toMatchObject({
      id: 'master_ex_1',
      masterExerciseId: 'master_ex_1',
      name: 'Goblet squat',
    });
  });

  it('accepts compact source IDs from the approved exercise map as masterExerciseId', async () => {
    const sourceIdPlan = {
      ...baseValidPlan,
      days: baseValidPlan.days.map((day, dayIndex) => ({
        ...day,
        exercises: day.exercises.map((exercise, exerciseIndex) => {
          if (dayIndex === 0 && exerciseIndex === 0) {
            return {
              ...exercise,
              masterExerciseId: '1948',
              name: '1 Leg Box Squat',
            };
          }
          return exercise;
        }),
      })),
    };
    const sourceCandidates: CatalogCandidate[] = [
      {
        ...catalogCandidates[0]!,
        masterExerciseId: 'ex_catalog_1948',
        sourceId: '1948',
        name: '1 Leg Box Squat',
      },
      ...catalogCandidates.slice(1),
    ];
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(sourceIdPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test/primary',
          payload: sourceIdPlan as T,
        };
      },
    };

    const result = await generateWithCandidates(provider, {}, sourceCandidates);

    expect(result.plan.days[0]!.exercises[0]).toMatchObject({
      id: 'ex_catalog_1948',
      masterExerciseId: 'ex_catalog_1948',
      name: '1 Leg Box Squat',
    });
  });

  it('hydrates lean AI exercise IDs from catalog candidates', async () => {
    const leanPlan = {
      name: 'Lean ID Plan',
      focus: 'Posture and strength',
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Squat and pull',
          exercises: [
            {
              id: 'master_ex_1',
              sets: 3,
              reps: '8-10',
              restSeconds: 90,
              notes: 'Stay tall.',
            },
            {
              id: 'master_ex_2',
              sets: 3,
              reps: '10-12',
              restSeconds: 90,
              notes: 'Pause at the top.',
            },
          ],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Posterior chain',
          exercises: [
            {
              id: 'master_ex_3',
              sets: 3,
              reps: '8-10',
              restSeconds: 90,
            },
          ],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Balanced strength',
          exercises: [
            {
              id: 'master_ex_4',
              sets: 3,
              reps: '8-10/side',
              restSeconds: 90,
            },
          ],
        },
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(leanPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: leanPlan as T,
        };
      },
    };

    const result = await generateWithCandidates(provider);

    expect(result.source).toBe('ai');
    expect(result.plan.days[0]!.exercises[0]).toMatchObject({
      id: 'master_ex_1',
      masterExerciseId: 'master_ex_1',
      name: 'Goblet squat',
      muscleGroup: 'legs',
      movementPattern: 'squat',
      notes: 'Stay tall.',
    });
    expect(result.plan.days[0]!.exercises[1]).toMatchObject({
      id: 'master_ex_2',
      masterExerciseId: 'master_ex_2',
      name: 'Chest-supported row',
      muscleGroup: 'back',
      movementPattern: 'pull',
    });
  });

  it('direct OpenRouter provider rejects payloads that do not match the requested schema', async () => {
    let capturedBody: { messages?: Array<{ role?: string; content?: string }> } | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body)) as {
          messages?: Array<{ role?: string; content?: string }>;
        };

        return Response.json({
          choices: [
            {
              message: {
                content: '{"bad":true}',
              },
            },
          ],
        });
      }),
    );

    const provider = createWorkoutPlanProvider({
      OPENROUTER_API_KEY: 'sk-or-test',
      OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1',
    });

    await expect(
      provider.generateStructured({
        task: 'workout_plan',
        inputHash: 'hash',
        prompt: 'return ok',
        schema: z.object({ ok: z.literal(true) }),
        primaryModel: 'test/primary',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow();

    const systemPrompt = capturedBody?.messages?.find(
      (message) => message.role === 'system',
    )?.content;
    expect(systemPrompt).toContain('physiotherapist');
    expect(systemPrompt).toContain('strength and conditioning coach');
    expect(systemPrompt).toContain('EXACT JSON SCHEMA');
    expect(systemPrompt).toContain('"days"');
    expect(systemPrompt).toContain('"dayNumber"');
    expect(systemPrompt).toContain('"exercises"');
    expect(systemPrompt).toContain('"name"');
    expect(systemPrompt).toContain('"sets"');
    expect(systemPrompt).toContain('"reps"');
    expect(systemPrompt).toContain('"restSeconds"');
    expect(systemPrompt).toContain('"notes"');
    expect(systemPrompt).not.toContain('muscleGroup');
    expect(systemPrompt).toContain('Do not include');
    expect(systemPrompt).toContain('instructions');
  });

  it('runs fallbacks sequentially when the primary model fails', async () => {
    const attemptedModels: string[] = [];

    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: '' };
      },
      async generateStructured<T>(request: any) {
        attemptedModels.push(request.primaryModel!);
        if (request.primaryModel === 'test/primary') {
          throw new Error('primary model overloaded');
        }
        return {
          model: 'test/fallback-a',
          payload: baseValidPlan as T,
        };
      },
    };

    const result = await generateWithCandidates(provider);

    expect(attemptedModels).toEqual(['test/primary', 'test/fallback-a']);
    expect(result.source).toBe('ai');
    expect(result.model).toBe('test/fallback-a');
    expect(result.generation?.fallbackUsed).toBe(true);
  });

  it('tolerates invalid catalog IDs by matching them to approved catalog exercises', async () => {
    const attemptedModels: string[] = [];

    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(invalidCandidatePlan) };
      },
      async generateStructured<T>(request: any) {
        attemptedModels.push(request.primaryModel!);
        return {
          model: 'test/primary',
          payload: invalidCandidatePlan as T,
        };
      },
    };

    const result = await generateWithCandidates(provider);

    expect(attemptedModels).toEqual(['test/primary']);
    expect(result.model).toBe('test/primary');
    expect(result.plan.days).toHaveLength(3);
    // Goblet squat matched by name 'Goblet squat' to candidate 'master_ex_1' despite invalid ID
    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('master_ex_1');
  });

  it('throws WorkoutPlanGenerationError when AI repeats catalog exercise IDs within the same workout day', async () => {
    const repeatedIdPlan = {
      ...baseValidPlan,
      days: [
        {
          ...baseValidPlan.days[0]!,
          exercises: [
            baseValidPlan.days[0]!.exercises[0]!,
            {
              ...baseValidPlan.days[0]!.exercises[1]!,
              masterExerciseId: baseValidPlan.days[0]!.exercises[0]!.masterExerciseId,
            },
          ],
        },
        ...baseValidPlan.days.slice(1),
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(repeatedIdPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: repeatedIdPlan as T,
        };
      },
    };

    await expect(generateWithCandidates(provider)).rejects.toThrow(WorkoutPlanGenerationError);
  });

  it('throws WorkoutPlanGenerationError for workout days with excessive catalog exercise overlap', async () => {
    const highOverlapPlan = {
      ...baseValidPlan,
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Posterior focus',
          exercises: [
            { ...baseValidPlan.days[0]!.exercises[0]!, masterExerciseId: 'master_ex_1' },
            { ...baseValidPlan.days[0]!.exercises[1]!, masterExerciseId: 'master_ex_2' },
            {
              ...baseValidPlan.days[1]!.exercises[0]!,
              id: 'overlap_d1_3',
              masterExerciseId: 'master_ex_3',
            },
            {
              ...baseValidPlan.days[2]!.exercises[0]!,
              id: 'overlap_d1_4',
              masterExerciseId: 'master_ex_4',
            },
          ],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Different order and parameters',
          exercises: [
            {
              ...baseValidPlan.days[0]!.exercises[1]!,
              id: 'overlap_d2_1',
              masterExerciseId: 'master_ex_2',
              reps: '12-15',
            },
            {
              ...baseValidPlan.days[0]!.exercises[0]!,
              id: 'overlap_d2_2',
              masterExerciseId: 'master_ex_1',
              reps: '10-12',
            },
            {
              ...baseValidPlan.days[2]!.exercises[0]!,
              id: 'overlap_d2_3',
              masterExerciseId: 'master_ex_4',
              reps: '12-15',
            },
            {
              ...baseValidPlan.days[1]!.exercises[0]!,
              id: 'overlap_d2_4',
              masterExerciseId: 'master_ex_3',
              reps: '12-15',
            },
          ],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Alternate full body',
          exercises: [
            {
              ...baseValidPlan.days[0]!.exercises[1]!,
              id: 'overlap_d3_1',
              masterExerciseId: 'master_ex_6',
            },
            {
              ...baseValidPlan.days[0]!.exercises[0]!,
              id: 'overlap_d3_2',
              masterExerciseId: 'master_ex_1',
            },
            {
              ...baseValidPlan.days[1]!.exercises[0]!,
              id: 'overlap_d3_3',
              masterExerciseId: 'master_ex_3',
            },
            {
              ...baseValidPlan.days[2]!.exercises[0]!,
              id: 'overlap_d3_4',
              masterExerciseId: 'master_ex_4',
            },
          ],
        },
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(highOverlapPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: highOverlapPlan as T,
        };
      },
    };

    await expect(
      generateWorkoutPlanWithSafety(
        provider,
        context,
        modelConfigWithoutFallback,
        'legacy',
        {},
        undefined,
        catalogCandidates,
      ),
    ).rejects.toThrow(WorkoutPlanGenerationError);
  });

  it('throws WorkoutPlanGenerationError for plans with incorrect day count', async () => {
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(wrongDayCountPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: wrongDayCountPlan as T,
        };
      },
    };

    await expect(generateWithCandidates(provider)).rejects.toThrow(WorkoutPlanGenerationError);
  });

  it('throws WorkoutPlanGenerationError when all models fail', async () => {
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: '' };
      },
      async generateStructured() {
        throw new Error('all models down');
      },
    };

    await expect(generateWithCandidates(provider)).rejects.toThrow(WorkoutPlanGenerationError);
  });

  it('canonicalizes AI output fields to catalog values when IDs are valid', async () => {
    const canonicalizePlan = {
      ...baseValidPlan,
      days: baseValidPlan.days.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise, index) => {
          if (day.dayNumber === 1 && index === 0) {
            return {
              ...exercise,
              name: 'Improbable squat variant',
              movementPattern: 'push',
              muscleGroup: 'mystery',
            };
          }

          return {
            ...exercise,
            name: `${exercise.name} v2`,
            movementPattern:
              exercise.movementPattern === 'squat' ? 'hinge' : exercise.movementPattern,
            muscleGroup: 'mystery',
          };
        }),
      })),
    };

    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(canonicalizePlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: canonicalizePlan as T,
        };
      },
    };

    const result = await generateWithCandidates(provider);

    expect(result.source).toBe('repaired');
    expect(result.model).toBe('test-model');
    expect(result.plan.days[0]!.exercises[0]!.name).toBe('Goblet squat');
    expect(result.plan.days[0]!.exercises[0]!.movementPattern).toBe('squat');
    expect(result.plan.days[0]!.exercises[0]!.muscleGroup).toBe('legs');
    expect(result.warnings).not.toContain(
      'Canonicalized exercise "Improbable squat variant" (id: "master_ex_1") to catalog details.',
    );
  });

  it('returns safety-corrected plans when validation repairs excessive beginner volume', async () => {
    const beginnerLegCandidates: CatalogCandidate[] = [
      {
        masterExerciseId: 'beginner_leg_1',
        name: 'Beginner Goblet Squat',
        movementPattern: 'squat',
        allowedEquipment: ['dumbbells', 'bodyweight'],
        primaryMuscleGroup: 'legs',
        recommendedLevel: 'beginner',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
      {
        masterExerciseId: 'beginner_leg_2',
        name: 'Beginner Box Squat',
        movementPattern: 'hinge',
        allowedEquipment: ['dumbbells', 'bodyweight'],
        primaryMuscleGroup: 'legs',
        recommendedLevel: 'beginner',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
      {
        masterExerciseId: 'beginner_leg_3',
        name: 'Beginner Sled Pull',
        movementPattern: 'pull',
        allowedEquipment: ['dumbbells', 'bodyweight'],
        primaryMuscleGroup: 'legs',
        recommendedLevel: 'beginner',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
    ];
    const excessiveLegVolumePlan = {
      name: 'Beginner Legs',
      focus: 'Strength',
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Squat',
          exercises: [{ id: 'beginner_leg_1', sets: 10, reps: '8-10', restSeconds: 75 }],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Hinge',
          exercises: [{ id: 'beginner_leg_2', sets: 10, reps: '8-10', restSeconds: 75 }],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Pull',
          exercises: [{ id: 'beginner_leg_3', sets: 10, reps: '8-10', restSeconds: 75 }],
        },
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(excessiveLegVolumePlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: excessiveLegVolumePlan as T,
        };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      {
        ...context,
        goals: ['strength'],
        experienceLevel: 'beginner',
        limitations: [],
        postureFlags: {},
      },
      modelConfigWithoutFallback,
      'legacy',
      {},
      undefined,
      beginnerLegCandidates,
    );

    const weeklyLegSets = result.plan.days.reduce(
      (total, day) =>
        total +
        day.exercises.reduce(
          (subtotal, exercise) =>
            exercise.muscleGroup === 'legs' ? subtotal + exercise.sets : subtotal,
          0,
        ),
      0,
    );

    expect(result.source).toBe('repaired');
    expect(weeklyLegSets).toBe(20);
    expect(result.warnings).toContain('Beginner legs volume capped at 20 sets per week.');
  });

  it('rejects safety corrections that introduce non-catalog replacements before trying provider fallback', async () => {
    const safetyCandidates: CatalogCandidate[] = [
      {
        masterExerciseId: 'risky_press',
        name: 'Behind-Neck Press',
        movementPattern: 'push',
        allowedEquipment: ['full_gym'],
        primaryMuscleGroup: 'shoulders',
        recommendedLevel: 'intermediate',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
      {
        masterExerciseId: 'safe_squat',
        name: 'Safe Squat',
        movementPattern: 'squat',
        allowedEquipment: ['full_gym'],
        primaryMuscleGroup: 'legs',
        recommendedLevel: 'intermediate',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
      {
        masterExerciseId: 'safe_hinge',
        name: 'Safe Hinge',
        movementPattern: 'hinge',
        allowedEquipment: ['full_gym'],
        primaryMuscleGroup: 'glutes',
        recommendedLevel: 'intermediate',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
      {
        masterExerciseId: 'safe_pull',
        name: 'Safe Row',
        movementPattern: 'pull',
        allowedEquipment: ['full_gym'],
        primaryMuscleGroup: 'back',
        recommendedLevel: 'intermediate',
        goalTags: ['strength'],
        excludedLimitations: [],
      },
    ];
    const primaryPlan = {
      name: 'Risky plan',
      focus: 'Strength',
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Push',
          exercises: [{ id: 'risky_press', sets: 3, reps: '8-10', restSeconds: 75 }],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Hinge',
          exercises: [{ id: 'safe_hinge', sets: 3, reps: '8-10', restSeconds: 75 }],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Pull',
          exercises: [{ id: 'safe_pull', sets: 3, reps: '8-10', restSeconds: 75 }],
        },
      ],
    };
    const fallbackPlan = {
      name: 'Safe plan',
      focus: 'Strength',
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Squat',
          exercises: [{ id: 'safe_squat', sets: 3, reps: '8-10', restSeconds: 75 }],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Hinge',
          exercises: [{ id: 'safe_hinge', sets: 3, reps: '8-10', restSeconds: 75 }],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Pull',
          exercises: [{ id: 'safe_pull', sets: 3, reps: '8-10', restSeconds: 75 }],
        },
      ],
    };
    const attemptedModels: string[] = [];
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: '' };
      },
      async generateStructured<T>(request: any) {
        attemptedModels.push(request.primaryModel);
        return {
          model: request.primaryModel,
          payload: (request.primaryModel === 'test/primary' ? primaryPlan : fallbackPlan) as T,
        };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      {
        ...context,
        equipment: ['full_gym'],
        goals: ['strength'],
        limitations: ['shoulder_pain'],
        postureFlags: {
          shoulderPain: true,
        },
      },
      modelConfig,
      'legacy',
      {},
      undefined,
      safetyCandidates,
    );

    expect(attemptedModels).toEqual(['test/primary', 'test/fallback-a']);
    expect(result.model).toBe('test/fallback-a');
    expect(result.source).toBe('ai');
    expect(result.plan.days.flatMap((day) => day.exercises)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Safe Squat' }),
        expect.objectContaining({ name: 'Safe Hinge' }),
        expect.objectContaining({ name: 'Safe Row' }),
        expect.objectContaining({ masterExerciseId: 'safe_hinge' }),
        expect.objectContaining({ masterExerciseId: 'safe_pull' }),
      ]),
    );
  });

  it('uses catalog-canonical movement before safety validation', async () => {
    const safetyMismatchPlan = {
      schemaVersion: '1.0',
      source: 'ai',
      days: [
        {
          dayNumber: 1,
          name: 'Day 1',
          focus: 'Posterior focus',
          exercises: [
            {
              id: 'ex_round_1',
              name: 'AI named press one',
              masterExerciseId: 'master_ex_2',
              muscleGroup: 'mystery',
              movementPattern: 'push',
              sets: 4,
              reps: '8-10',
              restSeconds: 90,
            },
          ],
        },
        {
          dayNumber: 2,
          name: 'Day 2',
          focus: 'Posterior focus',
          exercises: [
            {
              id: 'ex_round_2',
              name: 'AI named press two',
              masterExerciseId: 'master_ex_6',
              muscleGroup: 'mystery',
              movementPattern: 'push',
              sets: 4,
              reps: '8-10',
              restSeconds: 90,
            },
          ],
        },
        {
          dayNumber: 3,
          name: 'Day 3',
          focus: 'Posterior focus',
          exercises: [
            {
              id: 'ex_round_3',
              name: 'AI named press three',
              masterExerciseId: 'master_ex_2',
              muscleGroup: 'mystery',
              movementPattern: 'push',
              sets: 4,
              reps: '8-10',
              restSeconds: 90,
            },
          ],
        },
      ],
      progression: {
        baselineIntensity: 'low-moderate',
        progressionRule: CANONICAL_PROGRESSION_RULE,
        increasePercent: 10,
        conditions: ['Two pain-free sessions'],
      },
      safetyNotes: [],
      warnings: [DISCLAIMER, 'Stop if pain increase or dizziness appears.'],
    };

    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(safetyMismatchPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: safetyMismatchPlan as T,
        };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      {
        ...context,
        postureFlags: {
          roundedShoulders: true,
        },
      },
      modelConfigWithoutFallback,
      'legacy',
      {},
      undefined,
      catalogCandidates,
    );

    expect(result.source).toBe('repaired');
    expect(result.plan.days[0]!.exercises[0]!.movementPattern).toBe('pull');
  });

  it('rejects an unknown exercise name when the AI omits its catalog ID', async () => {
    const mixedPlan = {
      ...baseValidPlan,
      days: baseValidPlan.days.map((day, dIdx) => ({
        ...day,
        exercises: day.exercises.map((exercise, eIdx) => {
          if (dIdx === 0 && eIdx === 0) {
            const rest = { ...exercise };
            delete (rest as any).masterExerciseId;
            return rest;
          }
          if (dIdx === 0 && eIdx === 1) {
            const rest = { ...exercise };
            delete (rest as any).masterExerciseId;
            return {
              ...rest,
              name: 'Strictly Unknown Row Drill',
            };
          }
          return exercise;
        }),
      })),
    };

    const attemptedModels: string[] = [];
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(mixedPlan) };
      },
      async generateStructured<T>(request: any) {
        attemptedModels.push(request.primaryModel!);
        return {
          model: 'test/primary',
          payload: mixedPlan as T,
        };
      },
    };

    await expect(generateWithCandidates(provider)).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'catalog_validation' },
    });
    expect(attemptedModels).toEqual(['test/primary', 'test/fallback-a']);
  });

  it('rejects a red catalog exercise selected by name without an ID', async () => {
    const redByNamePlan = {
      ...baseValidPlan,
      days: baseValidPlan.days.map((day, dayIndex) => ({
        ...day,
        exercises: day.exercises.map((exercise, exerciseIndex) => {
          if (dayIndex !== 0 || exerciseIndex !== 0) return exercise;
          const output = { ...exercise, name: 'Jump squat' };
          delete (output as any).masterExerciseId;
          return output;
        }),
      })),
    };
    const redCandidate: CatalogCandidate = {
      ...catalogCandidates[0]!,
      masterExerciseId: 'jump_squat',
      name: 'Jump squat',
      safetyRatings: [
        {
          considerationCode: 'knee_pain',
          severity: 'moderate',
          rating: 'avoid',
          reason: 'High impact can aggravate knee symptoms.',
        },
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(redByNamePlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: redByNamePlan as T };
      },
    };

    await expect(
      generateWithCandidates(provider, undefined, [...catalogCandidates, redCandidate]),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'catalog_safety_validation' },
    });
  });

  it('rejects a red catalog exercise selected directly by ID', async () => {
    const redByIdPlan = buildPlanWithMasterExerciseIds(baseValidPlan, ['jump_squat']);
    const redCandidate: CatalogCandidate = {
      ...catalogCandidates[0]!,
      masterExerciseId: 'jump_squat',
      name: 'Jump squat',
      safetyRatings: [
        {
          considerationCode: 'knee_pain',
          severity: 'moderate',
          rating: 'avoid',
          reason: 'High impact can aggravate knee symptoms.',
        },
      ],
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(redByIdPlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: redByIdPlan as T };
      },
    };

    await expect(
      generateWithCandidates(provider, undefined, [...catalogCandidates, redCandidate]),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'catalog_safety_validation' },
    });
  });

  it('fails when red candidates leave a required movement pattern without safe coverage', async () => {
    const provider = {
      generateWorkoutPlan: async () => ({
        model: 'test-model',
        text: JSON.stringify(baseValidPlan),
      }),
      generateStructured: async <T>() => ({ model: 'test-model', payload: baseValidPlan as T }),
    } satisfies AIProvider;
    const candidatesWithUnsafePatterns: CatalogCandidate[] = [
      { ...catalogCandidates[0]!, masterExerciseId: 'safe_squat_one' },
      { ...catalogCandidates[0]!, masterExerciseId: 'safe_squat_two' },
      { ...catalogCandidates[0]!, masterExerciseId: 'safe_squat_three' },
      ...catalogCandidates
        .filter((candidate) => ['hinge', 'pull'].includes(candidate.movementPattern))
        .map((candidate) => ({
          ...candidate,
          safetyRatings: [
            {
              considerationCode: 'knee_pain',
              severity: 'moderate' as const,
              rating: 'avoid' as const,
              reason: 'Avoid for this exact severity.',
            },
          ],
        })),
      {
        ...catalogCandidates[0]!,
        masterExerciseId: 'unsafe_lunge',
        name: 'Unsafe lunge',
        movementPattern: 'lunge',
        safetyRatings: [
          {
            considerationCode: 'knee_pain',
            severity: 'moderate',
            rating: 'avoid',
            reason: 'Avoid for this exact severity.',
          },
        ],
      },
    ];

    await expect(
      generateWithCandidates(
        provider,
        { limitations: ['knee_pain'] },
        candidatesWithUnsafePatterns,
      ),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'insufficient_safe_candidates' },
    });
  });

  it('loads catalog candidates from D1 when no candidates are injected', async () => {
    const fakeDb = createFakeDb(defaultDbCatalogRows);
    const dbPlan = buildPlanWithDbExerciseIds(baseValidPlan, 'db_master_canon_ex_1');

    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: dbPlan as T,
        };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      context,
      modelConfig,
      'legacy',
      {},
      fakeDb,
      undefined,
    );

    expect(result.plan.days).toHaveLength(3);
    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('db_master_canon_ex_1');
  });

  it('maps assessment equipment buckets to concrete catalog equipment tokens', async () => {
    const scenarios = [
      {
        bucket: 'full_gym',
        allowedId: 'db_ex_full_gym',
        blockedId: 'db_ex_full_bike',
      },
      {
        bucket: 'dumbbells_only',
        allowedId: 'db_ex_dumbbells_only',
        blockedId: 'db_ex_dumbbells_full',
      },
      {
        bucket: 'home_gym',
        allowedId: 'db_ex_home_gym',
        blockedId: 'db_ex_home_barbell',
      },
      {
        bucket: 'resistance_bands',
        allowedId: 'db_ex_resistance_band',
        blockedId: 'db_ex_resistance_dumbbells',
      },
    ] as const;

    for (const { bucket, allowedId, blockedId } of scenarios) {
      const scenarioConfig = {
        full_gym: {
          allowedName: 'Barbell',
          allowedCanonical: 'barbell',
          blockedName: 'Bikes',
          blockedCanonical: 'bike',
        },
        dumbbells_only: {
          allowedName: 'Dumbbells',
          allowedCanonical: 'dumbbells',
          blockedName: 'Barbell',
          blockedCanonical: 'barbell',
        },
        home_gym: {
          allowedName: 'Dumbbells',
          allowedCanonical: 'dumbbells',
          blockedName: 'Power Rack',
          blockedCanonical: 'barbell',
        },
        resistance_bands: {
          allowedName: 'Resistance Bands',
          allowedCanonical: 'bands',
          blockedName: 'Dumbbells',
          blockedCanonical: 'dumbbells',
        },
      }[bucket];

      const fakeDb = createFakeDb([
        {
          ...defaultDbCatalogRows[0],
          exerciseId: allowedId,
          exerciseCanonicalId: allowedId,
          exerciseName: `Allowed ${bucket} exercise`,
          equipmentName: scenarioConfig.allowedName,
          equipmentCanonicalId: scenarioConfig.allowedCanonical,
        },
        {
          ...defaultDbCatalogRows[0],
          exerciseId: blockedId,
          exerciseCanonicalId: blockedId,
          exerciseName: `Blocked ${bucket} exercise`,
          equipmentName: scenarioConfig.blockedName,
          equipmentCanonicalId: scenarioConfig.blockedCanonical,
        },
      ]);

      const dbPlan = buildPlanWithDbExerciseIds(baseValidPlan, allowedId);
      const provider: AIProvider = {
        async generateWorkoutPlan() {
          return { model: 'test-model', text: JSON.stringify(dbPlan) };
        },
        async generateStructured<T>() {
          return { model: 'test-model', payload: dbPlan as T };
        },
      };

      const result = await generateWorkoutPlanWithSafety(
        provider,
        {
          ...context,
          equipment: [bucket],
          goals: ['posture_improvement'],
          limitations: [],
        },
        modelConfig,
        'legacy',
        {},
        fakeDb,
      );

      expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe(allowedId);

      const dbPlanBlocked = buildPlanWithDbExerciseIds(baseValidPlan, blockedId);
      const providerBlocked: AIProvider = {
        async generateWorkoutPlan() {
          return { model: 'test-model', text: JSON.stringify(dbPlanBlocked) };
        },
        async generateStructured<T>() {
          return { model: 'test-model', payload: dbPlanBlocked as T };
        },
      };

      await expect(
        generateWorkoutPlanWithSafety(
          providerBlocked,
          {
            ...context,
            equipment: [bucket],
            goals: ['posture_improvement'],
            limitations: [],
          },
          modelConfig,
          'legacy',
          {},
          fakeDb,
        ),
      ).rejects.toMatchObject({
        name: 'WorkoutPlanGenerationError',
        details: { reason: 'catalog_validation' },
      });
    }
  });

  it('handles undefined goals by deriving needs from primary goal', async () => {
    const contextWithoutGoals = {
      ...context,
    } as Omit<typeof context, 'goals'>;
    delete (contextWithoutGoals as { goals?: readonly string[] }).goals;

    const fakeDb = createFakeDb([
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_goalless',
        exerciseCanonicalId: 'db_goalless',
        exerciseName: 'Posture-only DB squat',
        goalTagsJson: '["posture_improvement"]',
      },
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_strict_goal_ex',
        exerciseName: 'Strength-only DB squat',
        goalTagsJson: '["strength"]',
      },
    ]);
    const dbPlan = buildPlanWithDbExerciseIds(baseValidPlan, 'db_goalless');
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlan as T };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      contextWithoutGoals,
      modelConfig,
      'legacy',
      {},
      fakeDb,
    );

    expect(result.plan.days).toHaveLength(3);
    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('db_goalless');
  });

  it('normalizes bodyweight aliases when matching bodyweight-only equipment', async () => {
    const fakeDb = createFakeDb([
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_bodyweight',
        exerciseCanonicalId: 'db_bodyweight',
        exerciseName: 'Bodyweight squat',
        equipmentCanonicalId: 'n_a',
        equipmentName: 'N/A',
      },
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_bike',
        exerciseCanonicalId: 'db_bike',
        exerciseName: 'Bike interval',
        equipmentCanonicalId: 'bike',
        equipmentName: 'Bike',
      },
    ]);

    const dbPlan = buildPlanWithDbExerciseIds(baseValidPlan, 'db_bodyweight');
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlan as T };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      {
        ...context,
        equipment: ['n/a'],
        goals: ['posture_improvement'],
        limitations: [],
      },
      modelConfig,
      'legacy',
      {},
      fakeDb,
    );

    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('db_bodyweight');

    const dbPlanBike = buildPlanWithDbExerciseIds(baseValidPlan, 'db_bike');
    const providerBike: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlanBike) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlanBike as T };
      },
    };

    await expect(
      generateWorkoutPlanWithSafety(
        providerBike,
        {
          ...context,
          equipment: ['n/a'],
          goals: ['posture_improvement'],
          limitations: [],
        },
        modelConfig,
        'legacy',
        {},
        fakeDb,
      ),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'catalog_validation' },
    });
  });

  it('uses canonical catalog IDs from D1 even when internal db ids differ', async () => {
    const fakeDb = createFakeDb([
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_internal_ex_1',
        exerciseCanonicalId: 'db_canonical_ex_1',
        exerciseName: 'Canonicalized DB squat',
      },
    ]);

    const canonicalPlan = {
      ...baseValidPlan,
      days: baseValidPlan.days.map((day, dayIndex) => ({
        ...day,
        exercises: [
          {
            ...day.exercises[0]!,
            masterExerciseId: 'db_internal_ex_1',
            name: 'Canonicalized DB squat',
            reps: `${8 + dayIndex}-${10 + dayIndex}`,
          },
        ],
      })),
    };
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(canonicalPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test/primary',
          payload: canonicalPlan as T,
        };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      context,
      modelConfig,
      'legacy',
      {},
      fakeDb,
      undefined,
    );

    expect(result.model).toBe('test/primary');
    expect(result.plan.days).toHaveLength(3);
    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('db_canonical_ex_1');
  });

  it('throws an explicit catalog error when no candidates are available and does not call the provider', async () => {
    let structuredCalls = 0;
    let textCalls = 0;

    const provider: AIProvider = {
      async generateWorkoutPlan() {
        textCalls += 1;
        return { model: 'test-model', text: '' };
      },
      async generateStructured<T>() {
        structuredCalls += 1;
        return { model: 'test-model', payload: baseValidPlan as T };
      },
    };

    const action = generateWorkoutPlanWithSafety(
      provider,
      context,
      modelConfig,
      'legacy',
      {},
      undefined,
      [],
    );

    await expect(action).rejects.toMatchObject({
      message:
        'Catalog-backed AI generation is unavailable because no catalog candidates are loaded.',
      name: 'WorkoutPlanGenerationError',
      details: {
        reason: 'catalog_candidates_unavailable',
      },
    });
    expect(textCalls).toBe(0);
    expect(structuredCalls).toBe(0);
  });

  it('filters D1 candidates by user equipment', async () => {
    const fakeDb = createFakeDb([
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_allowed',
        exerciseName: 'Allowed DB Goblet squat',
        equipmentCanonicalId: 'dumbbells',
        equipmentName: 'Dumbbells',
      },
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_forbidden',
        exerciseName: 'Forbidden barbell-only squat',
        equipmentCanonicalId: 'barbell',
        equipmentName: 'Barbell',
      },
    ]);

    const dbPlan = buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_allowed');
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlan as T };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      {
        ...context,
        equipment: ['dumbbells'],
        goals: ['posture_improvement'],
        limitations: [],
      },
      modelConfig,
      'legacy',
      {},
      fakeDb,
    );

    expect(result.plan.days).toHaveLength(3);
    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('db_ex_allowed');

    const dbPlanForbidden = buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_forbidden');
    const providerForbidden: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlanForbidden) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlanForbidden as T };
      },
    };

    await expect(
      generateWorkoutPlanWithSafety(
        providerForbidden,
        {
          ...context,
          equipment: ['dumbbells'],
          goals: ['posture_improvement'],
          limitations: [],
        },
        modelConfig,
        'legacy',
        {},
        fakeDb,
      ),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'catalog_validation' },
    });
  });

  it('filters D1 candidates by catalog recommended level (minimum level semantics)', async () => {
    const fakeDb = createFakeDb([
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_advanced',
        exerciseCanonicalId: 'db_ex_advanced',
        exerciseName: 'Advanced DB squat',
        recommendedLevel: 'advanced',
        goalTagsJson: '["strength"]',
      },
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_too_easy',
        exerciseCanonicalId: 'db_ex_too_easy',
        exerciseName: 'Too easy DB row',
        recommendedLevel: 'beginner',
        goalTagsJson: '["strength"]',
      },
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_intermediate',
        exerciseCanonicalId: 'db_ex_intermediate',
        exerciseName: 'Intermediate DB row',
        recommendedLevel: 'intermediate',
        goalTagsJson: '["strength"]',
      },
    ]);

    const beginnerProvider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_too_easy') as T,
        };
      },
    };

    const intermediateProvider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          payload: buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_intermediate') as T,
        };
      },
    };

    const advancedProvider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(baseValidPlan) };
      },
      async generateStructured<T>() {
        return {
          model: 'test-model',
          // Advanced users can use any of the level recommendations.
          payload: buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_advanced') as T,
        };
      },
    };

    const beginnerResult = await generateWorkoutPlanWithSafety(
      beginnerProvider,
      {
        ...context,
        experienceLevel: 'beginner',
        goals: ['strength'],
        limitations: [],
      },
      modelConfig,
      'legacy',
      {},
      fakeDb,
      undefined,
    );

    const intermediateResult = await generateWorkoutPlanWithSafety(
      intermediateProvider,
      {
        ...context,
        experienceLevel: 'intermediate',
        goals: ['strength'],
        limitations: [],
      },
      modelConfig,
      'legacy',
      {},
      fakeDb,
      undefined,
    );

    const advancedResult = await generateWorkoutPlanWithSafety(
      advancedProvider,
      {
        ...context,
        goals: ['strength'],
        experienceLevel: 'advanced',
        limitations: [],
      },
      modelConfig,
      'legacy',
      {},
      fakeDb,
      undefined,
    );

    expect(beginnerResult.plan.days).toHaveLength(3);
    expect(beginnerResult.plan.days[0]!.exercises[0]!.masterExerciseId).toBe('db_ex_too_easy');

    expect(intermediateResult.plan.days).toHaveLength(3);
    expect(intermediateResult.plan.days[0]!.exercises[0]!.masterExerciseId).toBe(
      'db_ex_intermediate',
    );

    expect(advancedResult.plan.days).toHaveLength(3);
    expect(['db_ex_too_easy', 'db_ex_intermediate', 'db_ex_advanced']).toContain(
      advancedResult.plan.days[0]!.exercises[0]!.masterExerciseId,
    );
  });

  it('filters D1 candidates by excluded limitations metadata', async () => {
    const fakeDb = createFakeDb([
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_allowed',
        exerciseName: 'Allowed DB squat',
        excludedLimitationsJson: '[]',
      },
      {
        ...defaultDbCatalogRows[0],
        exerciseId: 'db_ex_excluded',
        exerciseName: 'Shoulder-pain excluded DB squat',
        excludedLimitationsJson: '["shoulder_pain"]',
      },
    ]);

    const dbPlan = buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_allowed');
    const provider: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlan) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlan as T };
      },
    };

    const result = await generateWorkoutPlanWithSafety(
      provider,
      {
        ...context,
        goals: ['posture_improvement'],
        limitations: ['shoulder_pain'],
      },
      modelConfig,
      'legacy',
      {},
      fakeDb,
    );

    expect(result.plan.days[0]?.exercises[0]?.masterExerciseId).toBe('db_ex_allowed');

    const dbPlanExcluded = buildPlanWithDbExerciseIds(baseValidPlan, 'db_ex_excluded');
    const providerExcluded: AIProvider = {
      async generateWorkoutPlan() {
        return { model: 'test-model', text: JSON.stringify(dbPlanExcluded) };
      },
      async generateStructured<T>() {
        return { model: 'test-model', payload: dbPlanExcluded as T };
      },
    };

    await expect(
      generateWorkoutPlanWithSafety(
        providerExcluded,
        {
          ...context,
          goals: ['posture_improvement'],
          limitations: ['shoulder_pain'],
        },
        modelConfig,
        'legacy',
        {},
        fakeDb,
      ),
    ).rejects.toMatchObject({
      name: 'WorkoutPlanGenerationError',
      details: { reason: 'catalog_validation' },
    });
  });
});
