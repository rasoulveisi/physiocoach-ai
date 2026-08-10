import { describe, expect, it, vi } from 'vitest';
import { OpenRouterProvider } from '../src/services/openrouter-provider';
import { workoutPlanStrictSchema } from '../src/types/workout-plan-contract';

describe('OpenRouterProvider structured response hardening', () => {
  it('parses strict structured response content and returns provider metadata', async () => {
    const fetchCalls: Array<{
      model: string;
      body: { model: string; messages: Array<{ role: string; content: string }> };
    }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
        };
        fetchCalls.push({ model: body.model, body });

        return Response.json({
          id: 'or-req-123',
          model: body.model,
          usage: {
            prompt_tokens: 120,
            completion_tokens: 300,
            total_tokens: 420,
          },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  schemaVersion: '1.0',
                  source: 'ai',
                  days: [
                    {
                      dayNumber: 1,
                      name: 'Day 1',
                      focus: 'Full body',
                      exercises: [
                        {
                          id: 'ex_1',
                          name: 'Goblet squat',
                          muscleGroup: 'legs',
                          movementPattern: 'squat',
                          sets: 3,
                          reps: '8-10',
                          rpe: 6,
                          restSeconds: 90,
                        },
                      ],
                    },
                  ],
                  progression: {
                    baselineIntensity: 'low-moderate',
                    progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
                    increasePercent: 10,
                    conditions: [],
                  },
                  safetyNotes: [],
                  warnings: [
                    'Educational fitness recommendations only. Not medical advice.',
                    'Stop if pain or dizziness appears.',
                  ],
                }),
              },
            },
          ],
        });
      }),
    );

    const provider = new OpenRouterProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.test/api/v1',
    });

    const response = await provider.generateStructured({
      task: 'workout_plan_generation',
      inputHash: 'abc',
      prompt: JSON.stringify({ task: 'workout_plan_generation' }),
      schema: workoutPlanStrictSchema,
      primaryModel: 'test/model',
      timeoutMs: 1000,
    });

    expect(response.model).toBe('test/model');
    expect(response.metadata?.providerRequestId).toBe('or-req-123');
    expect(response.metadata?.usage).toMatchObject({
      promptTokens: 120,
      completionTokens: 300,
      totalTokens: 420,
    });
    expect(response.payload.schemaVersion).toBe('1.0');
    expect(fetchCalls[0]?.body?.messages?.[0]).toMatchObject({
      role: 'system',
    });
    expect(fetchCalls[0]?.body?.messages?.[1]).toMatchObject({
      role: 'user',
    });
  });
});
