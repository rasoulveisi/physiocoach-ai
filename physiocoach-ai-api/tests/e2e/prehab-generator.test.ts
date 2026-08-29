import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
  WORKOUT_MODEL_PRIMARY: 'meta-llama/llama-3.1-8b-instruct',
} as const;

describe('Behavior-Driven E2E: Smart Warm-up & Prehab Generator API', () => {
  it('generates customized prehab routine for lower body squat session with knee limitations', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-sessions/prehab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Barbell Back Squat', movementPattern: 'squat', muscleGroups: ['quadriceps', 'glutes'] },
            { name: 'Bulgarian Split Squat', movementPattern: 'lunge', muscleGroups: ['quadriceps', 'glutes'] },
          ],
          limitations: ['knee_pain'],
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      totalMinutes: number;
      targetJoints: string[];
      routine: Array<{
        id: string;
        name: string;
        targetJoint: string;
        purpose: string;
        movementCue: string;
        mediaUrl?: string;
        durationSeconds?: number;
        reps?: number;
      }>;
    };

    expect(json.success).toBe(true);
    expect(json.totalMinutes).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(json.targetJoints)).toBe(true);
    expect(json.targetJoints.length).toBeGreaterThan(0);
    expect(json.routine.length).toBeGreaterThanOrEqual(3);
    expect(json.routine.length).toBeLessThanOrEqual(5);

    // Verify each routine exercise has required clinical properties
    for (const ex of json.routine) {
      expect(ex.id).toBeTruthy();
      expect(ex.name).toBeTruthy();
      expect(ex.targetJoint).toBeTruthy();
      expect(ex.purpose).toBeTruthy();
      expect(ex.movementCue).toBeTruthy();
      expect(ex.durationSeconds || ex.reps).toBeDefined();
    }

    // Should include hip/knee/ankle priming exercises
    const routineNames = json.routine.map((r) => r.name);
    const hasLowerBodyPrehab =
      routineNames.some((n) => n.includes('Hip') || n.includes('Ankle') || n.includes('Glute') || n.includes('Squat'));
    expect(hasLowerBodyPrehab).toBe(true);
  });

  it('generates customized prehab routine for upper body pressing and pulling session with shoulder limitations', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-sessions/prehab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Barbell Bench Press', movementPattern: 'push', muscleGroups: ['chest', 'triceps'] },
            { name: 'Barbell Overhead Press', movementPattern: 'overhead', muscleGroups: ['shoulders'] },
            { name: 'Barbell Bent Over Row', movementPattern: 'pull', muscleGroups: ['lats', 'upper_back'] },
          ],
          limitations: ['shoulder_pain', 'rounded_shoulders'],
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      totalMinutes: number;
      targetJoints: string[];
      routine: Array<{
        id: string;
        name: string;
        targetJoint: string;
        purpose: string;
        movementCue: string;
      }>;
    };

    expect(json.success).toBe(true);
    expect(json.routine.length).toBeGreaterThanOrEqual(3);

    const routineNames = json.routine.map((r) => r.name);
    const hasShoulderScapularPrehab =
      routineNames.some((n) => n.includes('Band Pull-Aparts') || n.includes('Scapular') || n.includes('Face Pull'));
    expect(hasShoulderScapularPrehab).toBe(true);
  });

  it('generates customized prehab routine for deadlift and hinge session with lumbar back limitations', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-sessions/prehab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [
            { name: 'Conventional Deadlift', movementPattern: 'hinge', muscleGroups: ['hamstrings', 'lower_back', 'glutes'] },
          ],
          limitations: ['lower_back_pain'],
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      totalMinutes: number;
      targetJoints: string[];
      routine: Array<{
        id: string;
        name: string;
        targetJoint: string;
      }>;
    };

    expect(json.success).toBe(true);
    expect(json.routine.length).toBeGreaterThanOrEqual(3);
    const routineNames = json.routine.map((r) => r.name);
    const hasSpineGlutePrehab =
      routineNames.some((n) => n.includes('Cat-Cow') || n.includes('Glute') || n.includes('Stretch') || n.includes('Deadbug'));
    expect(hasSpineGlutePrehab).toBe(true);
  });

  it('handles empty input gracefully and defaults to balanced mobility routine', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-sessions/prehab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: [],
          limitations: [],
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      success: boolean;
      totalMinutes: number;
      targetJoints: string[];
      routine: Array<{ id: string; name: string }>;
    };

    expect(json.success).toBe(true);
    expect(json.routine.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects invalid request payloads with 400 Bad Request', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/workout-sessions/prehab',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exercises: 'not-an-array',
        }),
      },
      mockEnv,
    );

    expect(response.status).toBe(400);
  });
});
