import { describe, expect, it } from 'vitest';
import type { AIProvider, GenerateStructuredRequest } from '../src/types/ai';
import {
  analyzeExerciseSafety,
  assertMonotonicSeverity,
  type ExerciseSafetyAnalysisInput,
} from '../src/services/exercise-safety-analyzer';

const analysisInput: ExerciseSafetyAnalysisInput = {
  exercise: {
    id: 'ex_behind_neck_press',
    name: 'Barbell Behind Neck Press',
    instructions: 'Press the barbell from behind the neck overhead.',
    equipment: 'barbell',
  },
  considerations: [
    { id: 'bc_shoulder_pain', code: 'shoulder_pain' },
    { id: 'bc_neck_pain', code: 'neck_pain' },
  ],
  analysisVersion: 'safety-v1',
  primaryModel: 'test/safety-model',
  timeoutMs: 1_000,
};

function compactPayload(cells: unknown[]) {
  const ratings: Record<string, Record<string, unknown>> = {};
  for (const value of cells) {
    const cell = value as {
      considerationCode: string;
      severity: string;
      rating: string;
      reason: string;
      confidence: number;
    };
    const current = ratings[cell.considerationCode] ?? {
      reason: cell.reason,
      requiredModification: 'None required for the test fixture.',
      confidence: cell.confidence,
    };
    current[cell.severity] = cell.rating;
    ratings[cell.considerationCode] = current;
  }
  return {
    schemaVersion: '1.0',
    ratings,
    summaryReason: 'Test analysis.',
    confidence: 0.9,
  };
}

function createProvider(cells: unknown[]): AIProvider {
  return {
    generateWorkoutPlan: async () => ({ model: 'test', text: '' }),
    generateStructured: async <T>() => ({
      model: 'test/safety-model',
      payload: compactPayload(cells) as T,
    }),
  };
}

const completeAiCells = [
  ...(['mild', 'moderate', 'severe'] as const).map((severity) => ({
    considerationCode: 'shoulder_pain',
    severity,
    rating: 'recommended',
    reason: 'AI explanation.',
    confidence: 0.9,
  })),
  ...(['mild', 'moderate', 'severe'] as const).map((severity) => ({
    considerationCode: 'neck_pain',
    severity,
    rating: 'recommended',
    reason: 'AI explanation.',
    confidence: 0.9,
  })),
];

const noRuleInput: ExerciseSafetyAnalysisInput = {
  ...analysisInput,
  exercise: {
    id: 'ex_calf_raise',
    name: 'Bodyweight Calf Raise',
    instructions: 'Raise the heels slowly.',
    equipment: 'body weight',
  },
  considerations: [{ id: 'bc_knee_pain', code: 'knee_pain' }],
};

function findRating(
  result: Awaited<ReturnType<typeof analyzeExerciseSafety>>,
  considerationCode: string,
  severity: 'mild' | 'moderate' | 'severe',
) {
  return result.ratings.find(
    (rating) => rating.considerationCode === considerationCode && rating.severity === severity,
  );
}

describe('exercise safety analyzer', () => {
  it('requests a strict provider schema for the complete safety matrix', async () => {
    let responseFormat: unknown;
    const provider: AIProvider = {
      generateWorkoutPlan: async () => ({ model: 'test', text: '' }),
      generateStructured: async <T>(request: GenerateStructuredRequest<T>) => {
        responseFormat = request.responseFormat;
        return {
          model: 'test/safety-model',
          payload: compactPayload(completeAiCells) as T,
        };
      },
    };

    await analyzeExerciseSafety(provider, analysisInput);

    expect(responseFormat).toMatchObject({
      name: 'exercise_safety_analysis',
      strict: true,
      schema: {
        type: 'object',
        required: ['schemaVersion', 'ratings', 'summaryReason', 'confidence'],
        additionalProperties: false,
        properties: {
          ratings: {
            type: 'object',
            required: ['shoulder_pain', 'neck_pain'],
            additionalProperties: false,
          },
        },
      },
    });
  });

  it('requires one matrix cell for every consideration and severity', async () => {
    const incompleteProvider = createProvider(completeAiCells.slice(0, -1));

    await expect(analyzeExerciseSafety(incompleteProvider, analysisInput)).rejects.toThrow();
  });

  it('preserves deterministic avoid while accepting AI explanations', async () => {
    const result = await analyzeExerciseSafety(createProvider(completeAiCells), analysisInput);

    expect(findRating(result, 'shoulder_pain', 'mild')).toMatchObject({
      rating: 'avoid',
      analysisSource: 'hybrid',
      reason: expect.stringContaining('AI explanation.'),
    });
  });

  it('keeps an AI recommendation when no deterministic restriction applies', async () => {
    const result = await analyzeExerciseSafety(
      createProvider(
        ['mild', 'moderate', 'severe'].map((severity) => ({
          considerationCode: 'knee_pain',
          severity,
          rating: 'recommended',
          reason: 'No meaningful knee loading.',
          confidence: 0.9,
        })),
      ),
      noRuleInput,
    );

    expect(findRating(result, 'knee_pain', 'mild')).toMatchObject({
      rating: 'recommended',
      analysisSource: 'ai',
    });
  });

  it('emits an auditable resolved-conflict declaration with every complete analysis', async () => {
    const result = await analyzeExerciseSafety(createProvider(completeAiCells), analysisInput);

    expect(result.evidence.conflictResolution).toEqual({
      status: 'resolved',
      analysisVersion: 'safety-v1',
      unresolvedConflicts: [],
    });
  });

  it('rejects non-monotonic severity', () => {
    expect(() =>
      assertMonotonicSeverity([
        { severity: 'mild', rating: 'avoid' },
        { severity: 'moderate', rating: 'recommended' },
        { severity: 'severe', rating: 'avoid' },
      ]),
    ).toThrow('non-monotonic');
  });
});
