import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createWorkoutPlanRoutes } from '../src/routes/workout-plans';
import { withTransactionFallback } from '../src/routes/transactions';
import { applySettingsPatch, type UserSettingsInput } from '../src/types/settings';
import * as workoutGenerator from '../src/services/workout-generator';

describe('workout plan generation', () => {
  it('returns a targeted validation error when the generate request body is missing', async () => {
    const app = new Hono();
    app.route('/api/v1', createWorkoutPlanRoutes());

    const response = await app.request('/api/v1/workout-plans/generate', {
      method: 'POST',
    });

    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: {
        code: string;
        message: string;
        details: { issues: Array<{ path: string; message: string }> };
      };
    };

    expect(body.error.code).toBe('invalid_request');
    expect(body.error.message).toBe('Workout plan generation requires a JSON body.');
    expect(body.error.details.issues[0]).toEqual({
      path: '',
      message: 'Expected an object containing assessment and optional profile.',
    });
  });

  it('regenerates each request and never returns a cache shortcut', async () => {
    const generateSpy = vi.spyOn(workoutGenerator, 'generateWorkoutPlanWithSafety');
    generateSpy
      .mockResolvedValueOnce({
        source: 'ai',
        model: 'test-model',
        plan: buildPlanPayload(),
        warnings: ['Run A'],
      })
      .mockResolvedValueOnce({
        source: 'ai',
        model: 'test-model',
        plan: buildPlanPayload(),
        warnings: ['Run B'],
      });

    const app = new Hono();
    app.route('/api/v1', createWorkoutPlanRoutes());
    const requestBody = {
      profile: {
        age: 32,
        sex: 'male',
        heightCm: 182,
        weightKg: 88,
        lifestyle: 'desk_job',
        experienceLevel: 'beginner',
      },
      assessment: {
        goals: ['posture_improvement'],
        frequencyDays: 3,
        equipment: ['dumbbells_only'],
        limitations: ['shoulder_pain'],
        postureFlags: ['rounded_shoulders'],
      },
    };

    const firstResponse = await app.request('/api/v1/workout-plans/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const secondResponse = await app.request('/api/v1/workout-plans/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(generateSpy).toHaveBeenCalledTimes(2);
    await expect(firstResponse.json()).resolves.toMatchObject({
      data: {
        source: 'ai',
        model: 'test-model',
        warnings: ['Run A'],
        cached: false,
      },
    });
    await expect(secondResponse.json()).resolves.toMatchObject({
      data: {
        source: 'ai',
        model: 'test-model',
        warnings: ['Run B'],
        cached: false,
      },
    });

    generateSpy.mockRestore();
  });
});

describe('settings patch merge behavior', () => {
  it('preserves existing values when a patch omits fields', () => {
    const current: Partial<UserSettingsInput> = {
      theme: 'dark',
      unitSystem: 'imperial',
      defaultWorkoutView: 'byDay',
      remindersEnabled: true,
    };

    const merged = applySettingsPatch(current, { unitSystem: 'metric' });

    expect(merged).toEqual({
      theme: 'dark',
      unitSystem: 'metric',
      defaultWorkoutView: 'byDay',
      remindersEnabled: true,
      restTimerSeconds: 90,
      autoStartRestTimer: true,
      restTimerSoundEnabled: true,
    });
  });

  it('defaults only missing values from current snapshot', () => {
    const merged = applySettingsPatch({}, { remindersEnabled: true });

    expect(merged).toEqual({
      theme: 'light',
      unitSystem: 'metric',
      defaultWorkoutView: 'byExercise',
      remindersEnabled: true,
      restTimerSeconds: 90,
      autoStartRestTimer: true,
      restTimerSoundEnabled: true,
    });
  });
});

function buildPlanPayload() {
  return {
    schemaVersion: '1.0' as const,
    source: 'ai' as const,
    days: [
      {
        dayNumber: 1,
        name: 'Day 1',
        focus: 'Full body',
        exercises: [
          {
            id: 'ex_1',
            name: 'Goblet squat',
            muscleGroup: 'quads',
            movementPattern: 'squat' as const,
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
          },
          {
            id: 'ex_2',
            name: 'Incline push-up',
            muscleGroup: 'chest',
            movementPattern: 'push' as const,
            sets: 3,
            reps: '8-12',
            restSeconds: 90,
          },
        ],
      },
    ],
    progression: {
      baselineIntensity: 'low-moderate' as const,
      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.' as const,
      increasePercent: 10,
      conditions: [],
    },
    safetyNotes: [],
    warnings: [
      'Educational fitness recommendations only. Not medical advice.',
      'Stop if pain or dizziness appears.',
    ],
  };
}

describe('write fallback utility', () => {
  it('retries writes without a transaction when begin query fails', async () => {
    const db = {
      async transaction() {
        throw new Error('failed query: begin');
      },
    };

    const operation = vi.fn(async () => {});

    await withTransactionFallback(db, operation, 'test');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries writes without a transaction when legacy begin error format appears', async () => {
    const db = {
      async transaction() {
        throw new Error('query: begin');
      },
    };

    const operation = vi.fn(async () => {});

    await withTransactionFallback(db, operation, 'test');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-begin transaction errors', async () => {
    const db = {
      async transaction() {
        throw new Error('database is locked');
      },
    };

    const operation = vi.fn(async () => {});

    await expect(withTransactionFallback(db, operation, 'test')).rejects.toThrow(
      'database is locked',
    );
    expect(operation).not.toHaveBeenCalled();
  });
});
