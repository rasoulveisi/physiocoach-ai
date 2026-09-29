import { describe, expect, it } from 'vitest';
import {
  buildUnifiedApprovedCandidateCatalog,
  buildWorkoutPlanPrompt,
  getDaySlotBlueprint,
  getDayTrainingType,
  getPromptCandidateTargets,
  getSessionSizingGuidance,
  getSlotArchitecture,
  normalizePostureFlags,
} from '../src/services/workout-generator/prompt-builder';
import {
  hydratePlanFromCatalog,
  injectRequiredCandidateModifications,
  isCandidateEligibleForSlot,
  leanAiDaySchema,
  leanAiExerciseSchema,
  validateAiGenerationQuality,
  validateBlueprintSlotFeasibility,
} from '../src/services/workout-generator/plan-hydration';
import { calculateWorkoutDayDurationMinutes } from '../src/services/workout-duration';
import type { WorkoutPlanGenerationContext } from '../src/types/ai';
import {
  getUserEquipmentTokens,
  type CandidateBuildResult,
} from '../src/services/workout-generator/candidates';
import type { WorkoutPlan } from '../src/types/workout';
import type { CatalogCandidate } from '../src/types/workout-generator';

describe('Workout Plan Duration, Sizing & Reliability', () => {
  const baseContext: WorkoutPlanGenerationContext = {
    goal: 'strength',
    goals: ['strength', 'hypertrophy'],
    archetype: 'powerbuilding_hypertrophy',
    frequencyDays: 3,
    sessionMinutes: 60,
    experienceLevel: 'intermediate',
    equipment: ['full_gym'],
    limitations: [],
    postureFlags: {
      roundedShoulders: false,
      shoulderPain: false,
      kneePain: false,
      lowerBackPain: false,
      neckPain: false,
    },
    age: 30,
    sex: 'male',
    heightCm: 173,
    weightKg: 77,
    lifestyle: 'desk_job',
  };

  describe('getSessionSizingGuidance', () => {
    it('calibrates a 60-minute session to 6-7 exercises and 20-24 working sets', () => {
      const sizing = getSessionSizingGuidance(60);
      expect(sizing.sessionMinutes).toBe(60);
      expect(sizing.minExercisesPerDay).toBe(6);
      expect(sizing.maxExercisesPerDay).toBe(7);
      expect(sizing.targetExercisesPerDay).toBe(6);
      expect(sizing.minTotalSets).toBe(20);
      expect(sizing.maxTotalSets).toBe(24);
    });

    it('calibrates a 30-minute session to 4-5 exercises and 12-15 sets', () => {
      const sizing = getSessionSizingGuidance(30);
      expect(sizing.minExercisesPerDay).toBe(4);
      expect(sizing.maxExercisesPerDay).toBe(5);
      expect(sizing.minTotalSets).toBe(12);
      expect(sizing.maxTotalSets).toBe(15);
    });

    it('scales prompt candidate targets based on session duration', () => {
      const targets60 = getPromptCandidateTargets(3, 60);
      const targets30 = getPromptCandidateTargets(3, 30);
      expect(targets60.finalExerciseCount).toBe(18); // 3 days * 6 exercises
      expect(targets30.finalExerciseCount).toBe(12); // 3 days * 4 exercises
      expect(targets60.minimumPromptCandidateCount).toBeGreaterThan(targets30.minimumPromptCandidateCount);
    });
  });

  describe('getSlotArchitecture', () => {
    it('defines exactly 6 slots and 20 working sets for 60m session', () => {
      const slotArch = getSlotArchitecture(60);
      expect(slotArch.slotCount).toBe(6);
      expect(slotArch.targetWorkingSets).toBe('exactly 20');
      expect(slotArch.slots).toHaveLength(6);
      expect(slotArch.slots[0]?.label).toBe('Primary Compound Lift');
      expect(slotArch.slots[0]?.sets).toBe(4);
      expect(slotArch.slots[1]?.label).toBe('Secondary Compound Lift');
      expect(slotArch.slots[1]?.sets).toBe(4);
      expect(slotArch.slots[2]?.sets).toBe(3);
      expect(slotArch.slots[3]?.sets).toBe(3);
      expect(slotArch.slots[4]?.sets).toBe(3);
      expect(slotArch.slots[5]?.sets).toBe(3);
    });

    it('supports 30m, 45m, and 75-90m session slot configurations', () => {
      const arch30 = getSlotArchitecture(30);
      expect(arch30.slotCount).toBe(4);
      expect(arch30.targetWorkingSets).toBe('11-12');

      const arch45 = getSlotArchitecture(45);
      expect(arch45.slotCount).toBe(5);
      expect(arch45.targetWorkingSets).toBe('15-16');

      const arch75 = getSlotArchitecture(75);
      expect(arch75.slotCount).toBe(7);
      expect(arch75.targetWorkingSets).toBe('24');

      const arch90 = getSlotArchitecture(90);
      expect(arch90.slotCount).toBe(8);
      expect(arch90.targetWorkingSets).toBe('27-28');
    });
  });

  describe('getDaySlotBlueprint & getDayTrainingType', () => {
    it('resolves correct training type for each frequency', () => {
      expect(getDayTrainingType(1, 1)).toBe('full_body');

      expect(getDayTrainingType(1, 2)).toBe('upper');
      expect(getDayTrainingType(2, 2)).toBe('lower');

      expect(getDayTrainingType(1, 3)).toBe('upper');
      expect(getDayTrainingType(2, 3)).toBe('lower');
      expect(getDayTrainingType(3, 3)).toBe('full_body');

      expect(getDayTrainingType(1, 4)).toBe('upper');
      expect(getDayTrainingType(2, 4)).toBe('lower');
      expect(getDayTrainingType(3, 4)).toBe('upper');
      expect(getDayTrainingType(4, 4)).toBe('lower');

      expect(getDayTrainingType(1, 5)).toBe('upper');
      expect(getDayTrainingType(2, 5)).toBe('lower');
      expect(getDayTrainingType(3, 5)).toBe('upper');
      expect(getDayTrainingType(4, 5)).toBe('lower');
      expect(getDayTrainingType(5, 5)).toBe('full_body');
    });

    it('generates day-specific 60m blueprints for upper, lower, and full body', () => {
      const upper = getDaySlotBlueprint('upper', 1, 60);
      expect(upper.slotCount).toBe(6);
      expect(upper.targetWorkingSets).toBe('exactly 20');
      expect(upper.slots[0]?.label).toBe('Primary Upper Push/Pull Compound');
      expect(upper.slots[0]?.sets).toBe(4);
      expect(upper.slots[1]?.label).toBe('Secondary Upper Push/Pull Compound');
      expect(upper.slots[1]?.sets).toBe(4);
      expect(upper.slots[2]?.label).toBe('Upper Compound / Unilateral');
      expect(upper.slots[2]?.sets).toBe(3);
      expect(upper.slots[3]?.label).toBe('Upper Hypertrophy Accessory');
      expect(upper.slots[3]?.description).toBe(
        '3 sets, 10-12 reps, 60s rest (Lateral Raise, Biceps Curl, or Triceps Pushdown from the catalog)',
      );
      expect(upper.slots[4]?.label).toBe('Postural Support / Rear Delt / Upper Back');
      expect(upper.slots[5]?.label).toBe('Core Anti-Rotation / Trunk Stability');

      const lower = getDaySlotBlueprint('lower', 2, 60);
      expect(lower.slotCount).toBe(6);
      expect(lower.targetWorkingSets).toBe('exactly 20');
      expect(lower.slots[0]?.label).toBe('Primary Lower Compound (Squat or Hinge)');
      expect(lower.slots[0]?.sets).toBe(4);
      expect(lower.slots[1]?.label).toBe('Secondary Lower Compound (Hinge or Squat)');
      expect(lower.slots[1]?.sets).toBe(4);
      expect(lower.slots[2]?.label).toBe('Unilateral Lower (Lunge / Split Squat / Step-Up)');
      expect(lower.slots[3]?.label).toBe('Lower Hypertrophy Isolation');
      expect(lower.slots[3]?.description).toBe(
        '3 sets, 10-12 reps, 60s rest (Leg Curl, Leg Extension, or Calf Raise from the catalog)',
      );
      expect(lower.slots[4]?.label).toBe('Hip / Pelvic / Glute Postural Stability');
      expect(lower.slots[4]?.description).toBe(
        '3 sets, 12-15 reps, 60s rest (Glute Bridge, Hip Thrust, or Hip Abduction from the catalog)',
      );
      expect(lower.slots[5]?.label).toBe('Core Anti-Extension / Pelvic Stability');
      expect(lower.slots[5]?.description).toBe(
        '3 sets, 12-15 reps or hold, 60s rest (Plank, Dead Bug, or Pallof Press from the catalog)',
      );

      const fullBody = getDaySlotBlueprint('full_body', 3, 60);
      expect(fullBody.slotCount).toBe(6);
      expect(fullBody.targetWorkingSets).toBe('exactly 20');
      expect(fullBody.slots[0]?.label).toBe('Primary Lower Compound (Squat or Hinge)');
      expect(fullBody.slots[1]?.label).toBe('Primary Upper Compound (Press or Row)');
      expect(fullBody.slots[2]?.label).toBe('Unilateral / Secondary Compound');
      expect(fullBody.slots[3]?.label).toBe('Hypertrophy Accessory');
      expect(fullBody.slots[4]?.label).toBe('Upper Back / Postural Support');
      expect(fullBody.slots[5]?.label).toBe('Core Stability / Loaded Carry');
    });

    it('scales day-specific blueprints to 30m, 45m, and 75-90m', () => {
      const upper30 = getDaySlotBlueprint('upper', 1, 30);
      expect(upper30.slotCount).toBe(4);
      expect(upper30.targetWorkingSets).toBe('11-12');

      const lower45 = getDaySlotBlueprint('lower', 2, 45);
      expect(lower45.slotCount).toBe(5);
      expect(lower45.targetWorkingSets).toBe('15-16');

      const fb75 = getDaySlotBlueprint('full_body', 3, 75);
      expect(fb75.slotCount).toBe(7);
      expect(fb75.targetWorkingSets).toBe('24');

      const upper90 = getDaySlotBlueprint('upper', 1, 90);
      expect(upper90.slotCount).toBe(8);
      expect(upper90.targetWorkingSets).toBe('27-28');
    });
  });

  describe('validateBlueprintSlotFeasibility', () => {
    const fullCoverageCandidates: CatalogCandidate[] = [
      // Upper push/pull/isolation
      {
        masterExerciseId: 'ex_bench',
        name: 'Barbell Bench Press',
        movementPattern: 'push',
        primaryMuscleGroup: 'chest',
        allowedEquipment: ['barbell'],
      },
      {
        masterExerciseId: 'ex_row',
        name: 'Barbell Row',
        movementPattern: 'pull',
        primaryMuscleGroup: 'back',
        allowedEquipment: ['barbell'],
      },
      {
        masterExerciseId: 'ex_lat_raise',
        name: 'Dumbbell Lateral Raise',
        movementPattern: 'isolation',
        primaryMuscleGroup: 'deltoids',
        allowedEquipment: ['dumbbells'],
      },
      // Lower squat/hinge/lunge/isolation/glute
      {
        masterExerciseId: 'ex_squat',
        name: 'Barbell Squat',
        movementPattern: 'squat',
        primaryMuscleGroup: 'quadriceps',
        allowedEquipment: ['barbell'],
      },
      {
        masterExerciseId: 'ex_rdl',
        name: 'Romanian Deadlift',
        movementPattern: 'hinge',
        primaryMuscleGroup: 'hamstrings',
        allowedEquipment: ['barbell'],
      },
      {
        masterExerciseId: 'ex_split_squat',
        name: 'Bulgarian Split Squat',
        movementPattern: 'lunge',
        primaryMuscleGroup: 'quadriceps',
        allowedEquipment: ['dumbbells'],
      },
      {
        masterExerciseId: 'ex_leg_curl',
        name: 'Lying Leg Curl',
        movementPattern: 'isolation',
        primaryMuscleGroup: 'hamstrings',
        allowedEquipment: ['machine'],
      },
      {
        masterExerciseId: 'ex_glute_bridge',
        name: 'Barbell Glute Bridge',
        movementPattern: 'hinge',
        primaryMuscleGroup: 'glutes',
        allowedEquipment: ['barbell'],
      },
      // Core & Carry
      {
        masterExerciseId: 'ex_plank',
        name: 'Forearm Plank',
        movementPattern: 'core',
        primaryMuscleGroup: 'abdominals',
        allowedEquipment: ['bodyweight'],
      },
      {
        masterExerciseId: 'ex_carry',
        name: 'Farmer Walk',
        movementPattern: 'carry',
        primaryMuscleGroup: 'core',
        allowedEquipment: ['dumbbells'],
      },
    ];

    it('passes when candidates cover all required blueprint slots across all days', () => {
      const blueprints = [
        getDaySlotBlueprint('upper', 1, 60),
        getDaySlotBlueprint('lower', 2, 60),
        getDaySlotBlueprint('full_body', 3, 60),
      ];

      const result = validateBlueprintSlotFeasibility(blueprints, fullCoverageCandidates);
      expect(result.ok).toBe(true);
    });

    it('fails with missing slot diagnostics when a slot has 0 eligible candidates', () => {
      const blueprints = [
        getDaySlotBlueprint('upper', 1, 60),
        getDaySlotBlueprint('lower', 2, 60),
        getDaySlotBlueprint('full_body', 3, 60),
      ];

      // Exclude core and carry candidates
      const candidatesWithoutCoreOrCarry = fullCoverageCandidates.filter(
        (c) => c.movementPattern !== 'core' && c.movementPattern !== 'carry',
      );

      const result = validateBlueprintSlotFeasibility(blueprints, candidatesWithoutCoreOrCarry);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.missingSlots.length).toBeGreaterThanOrEqual(3);
        // Day 1 Slot 6 (Core), Day 2 Slot 6 (Core or carry), Day 3 Slot 6 (Core or carry)
        expect(result.missingSlots.some((s) => s.dayIndex === 1 && s.slot === 6)).toBe(true);
        expect(result.missingSlots.some((s) => s.dayIndex === 2 && s.slot === 6)).toBe(true);
        expect(result.missingSlots.some((s) => s.dayIndex === 3 && s.slot === 6)).toBe(true);
      }
    });

    describe('isCandidateEligibleForSlot', () => {
      const bench = { masterExerciseId: '1', name: 'Barbell Bench Press', movementPattern: 'push' as const, allowedEquipment: ['barbell'] };
      const row = { masterExerciseId: '2', name: 'Barbell Row', movementPattern: 'pull' as const, allowedEquipment: ['barbell'] };
      const latRaise = { masterExerciseId: '3', name: 'Dumbbell Lateral Raise', movementPattern: 'isolation' as const, primaryMuscleGroup: 'deltoids', allowedEquipment: ['dumbbells'] };
      const squat = { masterExerciseId: '4', name: 'Barbell Squat', movementPattern: 'squat' as const, primaryMuscleGroup: 'quadriceps', allowedEquipment: ['barbell'] };
      const rdl = { masterExerciseId: '5', name: 'Romanian Deadlift', movementPattern: 'hinge' as const, primaryMuscleGroup: 'hamstrings', allowedEquipment: ['barbell'] };
      const splitSquat = { masterExerciseId: '6', name: 'Bulgarian Split Squat', movementPattern: 'lunge' as const, allowedEquipment: ['dumbbells'] };
      const legCurl = { masterExerciseId: '7', name: 'Lying Leg Curl', movementPattern: 'isolation' as const, primaryMuscleGroup: 'hamstrings', allowedEquipment: ['machine'] };
      const gluteBridge = { masterExerciseId: '8', name: 'Glute Bridge', movementPattern: 'hinge' as const, primaryMuscleGroup: 'glutes', allowedEquipment: ['barbell'] };
      const plank = { masterExerciseId: '9', name: 'Plank', movementPattern: 'core' as const, allowedEquipment: ['bodyweight'] };
      const farmerCarry = { masterExerciseId: '10', name: 'Farmers Walk', movementPattern: 'carry' as const, allowedEquipment: ['dumbbells'] };

      it('evaluates Upper Day slot eligibility accurately', () => {
        expect(isCandidateEligibleForSlot(bench, 1, 'upper')).toBe(true);
        expect(isCandidateEligibleForSlot(row, 2, 'upper')).toBe(true);
        expect(isCandidateEligibleForSlot(latRaise, 4, 'upper')).toBe(true);
        expect(isCandidateEligibleForSlot(squat, 1, 'upper')).toBe(false);
        expect(isCandidateEligibleForSlot(plank, 1, 'upper')).toBe(false);

        expect(isCandidateEligibleForSlot(row, 5, 'upper')).toBe(true);
        expect(isCandidateEligibleForSlot(latRaise, 5, 'upper')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 5, 'upper')).toBe(false);

        expect(isCandidateEligibleForSlot(plank, 6, 'upper')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 6, 'upper')).toBe(false);
      });

      it('evaluates Lower Day slot eligibility accurately', () => {
        expect(isCandidateEligibleForSlot(squat, 1, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(rdl, 2, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 1, 'lower')).toBe(false);

        expect(isCandidateEligibleForSlot(splitSquat, 3, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(squat, 3, 'lower')).toBe(false);

        expect(isCandidateEligibleForSlot(legCurl, 4, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 4, 'lower')).toBe(false);

        expect(isCandidateEligibleForSlot(gluteBridge, 5, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 5, 'lower')).toBe(false);

        expect(isCandidateEligibleForSlot(plank, 6, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(farmerCarry, 6, 'lower')).toBe(true);
        expect(isCandidateEligibleForSlot(squat, 6, 'lower')).toBe(false);
      });

      it('evaluates Full Body Day slot eligibility accurately', () => {
        expect(isCandidateEligibleForSlot(squat, 1, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(rdl, 1, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 1, 'full_body')).toBe(false);

        expect(isCandidateEligibleForSlot(bench, 2, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(row, 2, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(squat, 2, 'full_body')).toBe(false);

        expect(isCandidateEligibleForSlot(splitSquat, 3, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(bench, 3, 'full_body')).toBe(true);

        expect(isCandidateEligibleForSlot(latRaise, 4, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(legCurl, 4, 'full_body')).toBe(true);

        expect(isCandidateEligibleForSlot(row, 5, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(latRaise, 5, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(squat, 5, 'full_body')).toBe(false);

        expect(isCandidateEligibleForSlot(plank, 6, 'full_body')).toBe(true);
        expect(isCandidateEligibleForSlot(farmerCarry, 6, 'full_body')).toBe(true);
      });
    });
  });

  describe('normalizePostureFlags taxonomy cleanliness', () => {
    it('excludes pain symptoms from posture flags and retains genuine posture traits', () => {
      const inputFlags = {
        roundedShoulders: true,
        anteriorPelvicTilt: true,
        tightHips: true,
        shoulderPain: true,
        kneePain: true,
        lowerBackPain: true,
        neckPain: true,
        knee_pain: true,
      };

      const normalized = normalizePostureFlags(inputFlags);
      expect(normalized).toEqual(['anterior_pelvic_tilt', 'rounded_shoulders', 'tight_hips']);
      expect(normalized).not.toContain('shoulder_pain');
      expect(normalized).not.toContain('knee_pain');
      expect(normalized).not.toContain('lower_back_pain');
      expect(normalized).not.toContain('neck_pain');
    });
  });

  describe('buildUnifiedApprovedCandidateCatalog', () => {
    it('groups candidates by movement pattern and classifies green vs amber tiers', () => {
      const candidates = [
        {
          masterExerciseId: 'ex_squat',
          name: 'Barbell Back Squat',
          movementPattern: 'squat',
          cluster: 'green' as const,
        },
        {
          masterExerciseId: 'ex_rdl',
          name: 'Romanian Deadlift',
          movementPattern: 'hinge',
          cluster: 'amber' as const,
          requiredModifications: ['Limit ROM to mid-shin', 'Use light dumbbells'],
        },
      ];

      const catalog = buildUnifiedApprovedCandidateCatalog(
        candidates as unknown as CatalogCandidate[],
      );
      expect(catalog.squat).toEqual([
        {
          id: 'ex_squat',
          name: 'Barbell Back Squat',
          tier: 'green',
        },
      ]);
      expect(catalog.hinge).toEqual([
        {
          id: 'ex_rdl',
          name: 'Romanian Deadlift',
          tier: 'amber',
          modification: 'Limit ROM to mid-shin; Use light dumbbells',
        },
      ]);
    });
  });

  describe('buildWorkoutPlanPrompt', () => {
    it('generates a 3-day split with Full Body Compound & Posterior Chain on Day 3 for strength/hypertrophy', () => {
      const prompt = buildWorkoutPlanPrompt(baseContext, ['squat', 'hinge', 'push', 'pull'], []);

      // Verify Day 3 is not a throwaway core day
      expect(prompt).toContain('Day 3 Full Body Compound & Posterior Chain');
      expect(prompt).not.toContain('Day 3 torso & core stability');

      // Verify split integrity requires compound movements on Day 3
      expect(prompt).toContain('NEVER output an entire workout day consisting exclusively of isolated mat/core exercises');

      // Verify split integrity day-specific rules
      expect(prompt).toContain('SPLIT INTEGRITY (Upper Body): Slots 1-5 MUST strictly contain UPPER BODY exercises');
      expect(prompt).toContain('SPLIT INTEGRITY (Lower Body): Slots 1-4 MUST strictly contain LOWER BODY exercises');
      expect(prompt).toContain('SPLIT INTEGRITY (Full Body): Must feature both lower-body and upper-body compound movements');

      // Verify slot architecture and day-specific blueprints
      expect(prompt).toContain('6-slot blueprint');
      expect(prompt).toContain('exactly 20 working sets');
      expect(prompt).toContain('Day 1 (Upper Body) Blueprint (6 slots, exactly 20 working sets):');
      expect(prompt).toContain('Slot 1: Primary Upper Push/Pull Compound — 4 sets, 6-8 reps, 120s rest');
      expect(prompt).toContain('Day 2 (Lower Body) Blueprint (6 slots, exactly 20 working sets):');
      expect(prompt).toContain('Slot 1: Primary Lower Compound (Squat or Hinge) — 4 sets, 6-8 reps, 120s rest');
      expect(prompt).toContain('Day 3 (Full Body) Blueprint (6 slots, exactly 20 working sets):');
      expect(prompt).toContain(
        'Every exercise within a single workout day must have a unique masterExerciseId. Exercise IDs may repeat across different days unless an explicit cross-day reuse limit prohibits this. Variety is a preference. Do not sacrifice slot eligibility or required training coverage merely to avoid cross-day repetition.',
      );
      expect(prompt).toContain(
        'Movement patterns may repeat across days. Satisfy the explicit daily coverage requirements in the slot blueprints.',
      );

      // Verify minimal JSON output specification
      expect(prompt).toContain('"slot": integer (1 to 6)');
      expect(prompt).toContain(
        'Day-level name and focus are required. Do not output exercise-level name, movementPattern, sets, reps, restSeconds, or estimatedDurationMinutes; these will be deterministically populated from the catalog.',
      );
    });

    it('formats athlete biometrics with BMI, desk_job occupational context, and archetype', () => {
      const prompt = buildWorkoutPlanPrompt(baseContext, ['squat', 'hinge', 'push', 'pull'], []);

      expect(prompt).toContain(
        'Athlete Biometrics: Age 30; Sex male; Stature 173cm, 77kg (BMI 25.7); Experience intermediate',
      );
      expect(prompt).toContain(
        'Occupational context: prolonged sitting. Program balanced posterior chain engagement and hip extension.',
      );
      expect(prompt).toContain('Training Archetype: powerbuilding_hypertrophy');
      expect(prompt).toContain(
        'STRICT EQUIPMENT BOUNDARY: Athlete ONLY has access to: full_gym. NEVER prescribe exercises requiring equipment outside this list.',
      );
    });

    it('handles unspecified biometrics and active lifestyle gracefully without archetype', () => {
      const minimalContext: WorkoutPlanGenerationContext = {
        goal: 'strength',
        goals: ['strength'],
        frequencyDays: 3,
        experienceLevel: 'beginner',
        equipment: [],
        limitations: [],
        postureFlags: {},
        lifestyle: 'active',
      };

      const prompt = buildWorkoutPlanPrompt(minimalContext, ['squat'], []);

      expect(prompt).toContain(
        'Athlete Biometrics: Age unspecified; Sex unspecified; Stature unspecified, unspecified; Experience beginner',
      );
      expect(prompt).not.toContain('(BMI');
      expect(prompt).toContain('Occupational Lifestyle: active');
      expect(prompt).not.toContain('Training Archetype:');
      expect(prompt).toContain(
        'STRICT EQUIPMENT BOUNDARY: Athlete ONLY has access to: bodyweight. NEVER prescribe exercises requiring equipment outside this list.',
      );
    });

    it('formats clinical considerations with code, severity, and side', () => {
      const clinicalContext: WorkoutPlanGenerationContext = {
        ...baseContext,
        considerations: [
          { code: 'knee_pain', severity: 'moderate', side: 'bilateral' },
          { code: 'shoulder_pain', severity: 'mild', side: 'right' },
          { code: 'lower_back_pain', severity: 'mild' },
        ],
      };

      const prompt = buildWorkoutPlanPrompt(clinicalContext, ['squat'], []);

      expect(prompt).toContain(
        'Clinical Considerations: knee_pain (moderate, bilateral), shoulder_pain (mild, right), lower_back_pain (mild)',
      );
    });

    it('enforces Day 1 pull-biased definition, Day 2 compound rules, and Day 3 Core Stability / Loaded Carry', () => {
      const postureContext: WorkoutPlanGenerationContext = {
        ...baseContext,
        postureFlags: {
          roundedShoulders: true,
        },
      };

      const prompt = buildWorkoutPlanPrompt(postureContext, ['squat', 'hinge', 'push', 'pull'], []);

      // Day 1 pull-biased definition
      expect(prompt).toContain(
        'Day 1 Upper Body Pull-Biased (Two of Slots 1–3 must contain designated upper-body pulling compounds like rows or pulldowns, and one must contain an upper-body pushing compound like bench press or overhead press)',
      );

      // Day 2 compound requirements
      expect(prompt).toContain('Slots 1–2 must include one squat-pattern option and one hinge-pattern option.');

      // Day 3 Core / Carry consistency in Rule 2 and Rule 5
      expect(prompt).toContain(
        'Day 3 Full Body Compound & Posterior Chain (Multi-joint Squat/Hinge or Compound Push/Pull with Core Stability / Loaded Carry)',
      );
      expect(prompt).toContain('Slot 6 is Core Stability / Loaded Carry.');

      // Blueprint descriptions
      expect(prompt).toContain(
        'Slot 4: Upper Hypertrophy Accessory — 3 sets, 10-12 reps, 60s rest (Lateral Raise, Biceps Curl, or Triceps Pushdown from the catalog)',
      );
      expect(prompt).toContain(
        'Slot 4: Lower Hypertrophy Isolation — 3 sets, 10-12 reps, 60s rest (Leg Curl, Leg Extension, or Calf Raise from the catalog)',
      );
      expect(prompt).toContain(
        'Slot 5: Hip / Pelvic / Glute Postural Stability — 3 sets, 12-15 reps, 60s rest (Glute Bridge, Hip Thrust, or Hip Abduction from the catalog)',
      );
      expect(prompt).toContain(
        'Slot 6: Core Anti-Extension / Pelvic Stability — 3 sets, 12-15 reps or hold, 60s rest (Plank, Dead Bug, or Pallof Press from the catalog)',
      );
      expect(prompt).toContain(
        'Slot 6: Core Stability / Loaded Carry — 3 sets, 12-15 reps or 30-45s carry, 60s rest',
      );
    });
  });

  describe('validateAiGenerationQuality guardrails', () => {
    const mockCandidateBuild: CandidateBuildResult = {
      candidates: [],
      allCandidates: [],
      clusters: { green: [], amber: [], red: [], exclusions: [] },
      requiredMovementPatterns: ['push', 'pull', 'squat', 'hinge'],
      missingSafeMovementPatterns: [],
    };

    it('rejects an undersized plan with only 5 exercises when 60 minutes was requested', () => {
      const undersizedPlan: WorkoutPlan = {
        schemaVersion: '1.0',
        source: 'ai',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1: Upper',
            focus: 'Upper Body',
            exercises: [
              { id: '1', masterExerciseId: '1', name: 'Bench', muscleGroup: 'Chest', movementPattern: 'push', sets: 4, reps: '6-8', restSeconds: 120 },
              { id: '2', masterExerciseId: '2', name: 'Row', muscleGroup: 'Back', movementPattern: 'pull', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '3', masterExerciseId: '3', name: 'Incline Press', muscleGroup: 'Chest', movementPattern: 'push', sets: 3, reps: '8-10', restSeconds: 90 },
              { id: '4', masterExerciseId: '4', name: 'Pulldown', muscleGroup: 'Back', movementPattern: 'pull', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '5', masterExerciseId: '5', name: 'Triceps', muscleGroup: 'Triceps', movementPattern: 'push', sets: 3, reps: '10-12', restSeconds: 60 },
            ],
          },
          {
            dayNumber: 2,
            name: 'Day 2: Lower',
            focus: 'Lower Body',
            exercises: [
              { id: '6', masterExerciseId: '6', name: 'Squat', muscleGroup: 'Quads', movementPattern: 'squat', sets: 4, reps: '6-8', restSeconds: 120 },
              { id: '7', masterExerciseId: '7', name: 'RDL', muscleGroup: 'Hamstrings', movementPattern: 'hinge', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '8', masterExerciseId: '8', name: 'Lunge', muscleGroup: 'Quads', movementPattern: 'lunge', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '9', masterExerciseId: '9', name: 'Leg Press', muscleGroup: 'Quads', movementPattern: 'squat', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '10', masterExerciseId: '10', name: 'Calf Raise', muscleGroup: 'Calves', movementPattern: 'squat', sets: 3, reps: '12-15', restSeconds: 60 },
            ],
          },
          {
            dayNumber: 3,
            name: 'Day 3: Full Body',
            focus: 'Compound',
            exercises: [
              { id: '11', masterExerciseId: '11', name: 'Deadlift', muscleGroup: 'Posterior', movementPattern: 'hinge', sets: 4, reps: '5', restSeconds: 120 },
              { id: '12', masterExerciseId: '12', name: 'Overhead Press', muscleGroup: 'Shoulders', movementPattern: 'push', sets: 4, reps: '6-8', restSeconds: 90 },
              { id: '13', masterExerciseId: '13', name: 'Chin-Up', muscleGroup: 'Back', movementPattern: 'pull', sets: 3, reps: '8-10', restSeconds: 90 },
              { id: '14', masterExerciseId: '14', name: 'Lateral Raise', muscleGroup: 'Shoulders', movementPattern: 'push', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '15', masterExerciseId: '15', name: 'Face Pull', muscleGroup: 'Upper Back', movementPattern: 'pull', sets: 3, reps: '12-15', restSeconds: 60 },
            ],
          },
        ],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['Two pain-free sessions'],
        },
        safetyNotes: [],
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
      };

      const result = validateAiGenerationQuality(undersizedPlan, baseContext, mockCandidateBuild);
      expect(result.ok).toBe(false);
      expect(result.corrections.some((c) => c.includes('minimum 6 exercises required'))).toBe(true);
    });

    it('rejects a core-only day in a multi-day plan', () => {
      const coreOnlyPlan: WorkoutPlan = {
        schemaVersion: '1.0',
        source: 'ai',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1: Upper',
            focus: 'Upper Body',
            exercises: [
              { id: '1', masterExerciseId: '1', name: 'Bench', muscleGroup: 'Chest', movementPattern: 'push', sets: 4, reps: '6-8', restSeconds: 120 },
              { id: '2', masterExerciseId: '2', name: 'Row', muscleGroup: 'Back', movementPattern: 'pull', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '3', masterExerciseId: '3', name: 'Incline Press', muscleGroup: 'Chest', movementPattern: 'push', sets: 3, reps: '8-10', restSeconds: 90 },
              { id: '4', masterExerciseId: '4', name: 'Pulldown', muscleGroup: 'Back', movementPattern: 'pull', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '5', masterExerciseId: '5', name: 'Triceps', muscleGroup: 'Triceps', movementPattern: 'push', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '6', masterExerciseId: '6', name: 'Face Pull', muscleGroup: 'Back', movementPattern: 'pull', sets: 3, reps: '12-15', restSeconds: 60 },
            ],
          },
          {
            dayNumber: 2,
            name: 'Day 2: Lower',
            focus: 'Lower Body',
            exercises: [
              { id: '7', masterExerciseId: '7', name: 'Squat', muscleGroup: 'Quads', movementPattern: 'squat', sets: 4, reps: '6-8', restSeconds: 120 },
              { id: '8', masterExerciseId: '8', name: 'RDL', muscleGroup: 'Hamstrings', movementPattern: 'hinge', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '9', masterExerciseId: '9', name: 'Lunge', muscleGroup: 'Quads', movementPattern: 'lunge', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '10', masterExerciseId: '10', name: 'Leg Press', muscleGroup: 'Quads', movementPattern: 'squat', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '11', masterExerciseId: '11', name: 'Calf Raise', muscleGroup: 'Calves', movementPattern: 'squat', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '12', masterExerciseId: '12', name: 'Plank', muscleGroup: 'Core', movementPattern: 'core', sets: 3, reps: '45s', restSeconds: 60 },
            ],
          },
          {
            dayNumber: 3,
            name: 'Day 3: Throwaway Core',
            focus: 'Core only',
            exercises: [
              { id: '13', masterExerciseId: '13', name: 'Farmers Walk', muscleGroup: 'Core', movementPattern: 'carry', sets: 4, reps: '40s', restSeconds: 60 },
              { id: '14', masterExerciseId: '14', name: 'Hanging Knee Raise', muscleGroup: 'Core', movementPattern: 'core', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '15', masterExerciseId: '15', name: 'Crunch', muscleGroup: 'Core', movementPattern: 'core', sets: 3, reps: '15-20', restSeconds: 60 },
              { id: '16', masterExerciseId: '16', name: 'Sit-Up', muscleGroup: 'Core', movementPattern: 'core', sets: 3, reps: '15-20', restSeconds: 60 },
              { id: '17', masterExerciseId: '17', name: 'Balance Board', muscleGroup: 'Balance', movementPattern: 'mobility', sets: 3, reps: '30s', restSeconds: 60 },
              { id: '18', masterExerciseId: '18', name: 'Side Plank', muscleGroup: 'Core', movementPattern: 'core', sets: 3, reps: '30s', restSeconds: 60 },
            ],
          },
        ],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['Two pain-free sessions'],
        },
        safetyNotes: [],
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
      };

      const result = validateAiGenerationQuality(coreOnlyPlan, baseContext, mockCandidateBuild);
      expect(result.ok).toBe(false);
      expect(result.corrections.some((c) => c.includes('multi-joint compound resistance movements'))).toBe(true);
    });

    it('passes a properly structured 6-exercise workout plan for 60 minutes', () => {
      const properPlan: WorkoutPlan = {
        schemaVersion: '1.0',
        source: 'ai',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1: Upper Body Push & Pull',
            focus: 'Hypertrophy',
            exercises: [
              { id: '1', masterExerciseId: '1', name: 'Barbell Bench Press', muscleGroup: 'Pectorals', movementPattern: 'push', sets: 4, reps: '6-8', restSeconds: 120 },
              { id: '2', masterExerciseId: '2', name: 'Barbell Row', muscleGroup: 'Lats', movementPattern: 'pull', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '3', masterExerciseId: '3', name: 'Incline Dumbbell Press', muscleGroup: 'Pectorals', movementPattern: 'push', sets: 3, reps: '8-10', restSeconds: 90 },
              { id: '4', masterExerciseId: '4', name: 'Lat Pulldown', muscleGroup: 'Lats', movementPattern: 'pull', sets: 3, reps: '10-12', restSeconds: 75 },
              { id: '5', masterExerciseId: '5', name: 'Dumbbell Lateral Raise', muscleGroup: 'Deltoids', movementPattern: 'push', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '6', masterExerciseId: '6', name: 'Triceps Rope Pushdown', muscleGroup: 'Triceps', movementPattern: 'push', sets: 3, reps: '10-12', restSeconds: 60 },
            ],
          },
          {
            dayNumber: 2,
            name: 'Day 2: Lower Body Strength',
            focus: 'Strength',
            exercises: [
              { id: '7', masterExerciseId: '7', name: 'Barbell Squat', muscleGroup: 'Quadriceps', movementPattern: 'squat', sets: 4, reps: '5-8', restSeconds: 120 },
              { id: '8', masterExerciseId: '8', name: 'Romanian Deadlift', muscleGroup: 'Hamstrings', movementPattern: 'hinge', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '9', masterExerciseId: '9', name: 'Bulgarian Split Squat', muscleGroup: 'Quadriceps', movementPattern: 'lunge', sets: 3, reps: '8-10', restSeconds: 75 },
              { id: '10', masterExerciseId: '10', name: 'Leg Press', muscleGroup: 'Quadriceps', movementPattern: 'squat', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '11', masterExerciseId: '11', name: 'Standing Calf Raise', muscleGroup: 'Calves', movementPattern: 'squat', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '12', masterExerciseId: '12', name: 'Hanging Knee Raise', muscleGroup: 'Abdominals', movementPattern: 'core', sets: 3, reps: '12-15', restSeconds: 60 },
            ],
          },
          {
            dayNumber: 3,
            name: 'Day 3: Full Body Overload & Stability',
            focus: 'Power & Core',
            exercises: [
              { id: '13', masterExerciseId: '13', name: 'Barbell Deadlift', muscleGroup: 'Hamstrings', movementPattern: 'hinge', sets: 4, reps: '5', restSeconds: 150 },
              { id: '14', masterExerciseId: '14', name: 'Overhead Press', muscleGroup: 'Deltoids', movementPattern: 'push', sets: 4, reps: '6-8', restSeconds: 90 },
              { id: '15', masterExerciseId: '15', name: 'Pull-Up', muscleGroup: 'Lats', movementPattern: 'pull', sets: 3, reps: '6-10', restSeconds: 90 },
              { id: '16', masterExerciseId: '16', name: 'Dumbbell Walking Lunge', muscleGroup: 'Glutes', movementPattern: 'lunge', sets: 3, reps: '10-12', restSeconds: 60 },
              { id: '17', masterExerciseId: '17', name: 'Face Pull', muscleGroup: 'Upper Back', movementPattern: 'pull', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '18', masterExerciseId: '18', name: 'Farmers Walk', muscleGroup: 'Abdominals', movementPattern: 'carry', sets: 3, reps: '40s', restSeconds: 60 },
            ],
          },
        ],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['Two pain-free sessions'],
        },
        safetyNotes: [],
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
      };

      const result = validateAiGenerationQuality(properPlan, baseContext, mockCandidateBuild);
      expect(result.ok).toBe(true);
      expect(result.corrections).toEqual([]);
    });

    it('rejects duplicate slots [1, 2, 3, 4, 5, 5]', () => {
      const planWithDuplicateSlots: WorkoutPlan = {
        schemaVersion: '1.0',
        source: 'ai',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1: Upper Body Push & Pull',
            focus: 'Hypertrophy',
            exercises: [
              { id: '1', masterExerciseId: '1', slot: 1, name: 'Barbell Bench Press', muscleGroup: 'Pectorals', movementPattern: 'push', sets: 4, reps: '6-8', restSeconds: 120 },
              { id: '2', masterExerciseId: '2', slot: 2, name: 'Barbell Row', muscleGroup: 'Lats', movementPattern: 'pull', sets: 4, reps: '8-10', restSeconds: 90 },
              { id: '3', masterExerciseId: '3', slot: 3, name: 'Incline Dumbbell Press', muscleGroup: 'Pectorals', movementPattern: 'push', sets: 3, reps: '8-10', restSeconds: 90 },
              { id: '4', masterExerciseId: '4', slot: 4, name: 'Lat Pulldown', muscleGroup: 'Lats', movementPattern: 'pull', sets: 3, reps: '10-12', restSeconds: 75 },
              { id: '5', masterExerciseId: '5', slot: 5, name: 'Dumbbell Lateral Raise', muscleGroup: 'Deltoids', movementPattern: 'push', sets: 3, reps: '12-15', restSeconds: 60 },
              { id: '6', masterExerciseId: '6', slot: 5, name: 'Triceps Rope Pushdown', muscleGroup: 'Triceps', movementPattern: 'push', sets: 3, reps: '10-12', restSeconds: 60 },
            ],
          },
        ],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['Two pain-free sessions'],
        },
        safetyNotes: [],
        warnings: ['Educational fitness recommendations only. Not medical advice.'],
      };

      const result = validateAiGenerationQuality(planWithDuplicateSlots, {
        ...baseContext,
        frequencyDays: 1,
      });
      expect(result.ok).toBe(false);
      expect(result.warnings.some((w) => w.includes('duplicate slot 5'))).toBe(true);
      expect(result.corrections.some((c) => c.includes('duplicate slot 5'))).toBe(true);
    });
  });

  describe('hydratePlanFromCatalog duration computation', () => {
    it('populates estimatedDurationMinutes on each day during catalog hydration', () => {
      const rawAiResponse = {
        days: [
          {
            dayNumber: 1,
            name: 'Day 1: Upper Body Focus',
            focus: 'Strength',
            exercises: [
              { masterExerciseId: 'ex_bench', name: 'bench press', sets: 4, reps: '6-8', restSeconds: 120 },
              { masterExerciseId: 'ex_row', name: 'cable row', sets: 3, reps: '8-10', restSeconds: 90 },
            ],
          },
        ],
      };

      const candidates = [
        { masterExerciseId: 'ex_bench', name: 'bench press', movementPattern: 'push', allowedEquipment: ['barbell'] },
        { masterExerciseId: 'ex_row', name: 'cable row', movementPattern: 'pull', allowedEquipment: ['cable'] },
      ] as unknown as CandidateBuildResult['candidates'];

      const candidateBuild = {
        candidates,
        allCandidates: candidates,
        clusters: { green: candidates, amber: [], red: [], exclusions: [] },
        requiredMovementPatterns: ['push', 'pull'],
        missingSafeMovementPatterns: [],
      } as unknown as CandidateBuildResult;

      const hydration = hydratePlanFromCatalog(rawAiResponse, candidateBuild);
      expect(hydration.ok).toBe(true);
      expect(hydration.plan.days[0]?.estimatedDurationMinutes).toBeGreaterThanOrEqual(15);
      expect(hydration.plan.days[0]?.estimatedDurationMinutes).toBe(
        calculateWorkoutDayDurationMinutes(hydration.plan.days[0]!)
      );
    });
  });

  describe('granular equipment tokens and catalog matching', () => {
    it('correctly expands granular equipment from Settings and enforces boundaries', () => {
      const contextWithSettingsEquipment: WorkoutPlanGenerationContext = {
        ...baseContext,
        equipment: ['Dumbbells', 'Bench'],
      };

      const tokens = getUserEquipmentTokens(contextWithSettingsEquipment);
      expect(tokens.has('dumbbells')).toBe(true);
      expect(tokens.has('dumbbell')).toBe(true);
      expect(tokens.has('bench')).toBe(true);
      expect(tokens.has('flat_bench')).toBe(true);
      expect(tokens.has('bodyweight')).toBe(true);
      // Barbells and cables must not be present
      expect(tokens.has('barbell')).toBe(false);
      expect(tokens.has('cable')).toBe(false);
      expect(tokens.has('machine')).toBe(false);

      const prompt = buildWorkoutPlanPrompt(contextWithSettingsEquipment, ['push', 'pull'], []);
      expect(prompt).toContain('STRICT EQUIPMENT BOUNDARY: Athlete ONLY has access to: Dumbbells, Bench.');
      expect(prompt).toContain('NEVER prescribe exercises requiring equipment outside this list.');
      expect(prompt).toContain('Athlete Biometrics: Age 30; Sex male; Stature 173cm, 77kg (BMI 25.7); Experience intermediate');
      expect(prompt).toContain('Occupational context: prolonged sitting. Program balanced posterior chain engagement and hip extension.');
      expect(prompt).toContain('Training Archetype: powerbuilding_hypertrophy');
    });
  });

  describe('leanAiExerciseSchema and leanAiDaySchema token optimization', () => {
    it('allows exercise raw output with ONLY masterExerciseId (no name or movementPattern)', () => {
      const parsed = leanAiExerciseSchema.parse({
        masterExerciseId: 'ex_squat_123',
        sets: 4,
        reps: '6-8',
        restSeconds: 120,
      });

      expect(parsed.masterExerciseId).toBe('ex_squat_123');
      expect(parsed.name).toBeUndefined();
      expect(parsed.movementPattern).toBeUndefined();
      expect(parsed.sets).toBe(4);
      expect(parsed.reps).toBe('6-8');
      expect(parsed.restSeconds).toBe(120);
    });

    it('allows exercise raw output with id or name', () => {
      const parsedWithId = leanAiExerciseSchema.parse({
        id: 'ex_bench_456',
        sets: 3,
        reps: 10,
      });
      expect(parsedWithId.id).toBe('ex_bench_456');
      expect(parsedWithId.restSeconds).toBeUndefined();

      const parsedWithName = leanAiExerciseSchema.parse({
        name: 'Dumbbell Row',
        sets: 3,
        reps: '8-10',
      });
      expect(parsedWithName.name).toBe('Dumbbell Row');
    });

    it('normalizes slot keys (slot, slotNumber, slot_number, slotId, slot_id)', () => {
      expect(leanAiExerciseSchema.parse({ slot: 1, masterExerciseId: 'ex_1' }).slot).toBe(1);
      expect(leanAiExerciseSchema.parse({ slotNumber: 2, masterExerciseId: 'ex_1' }).slot).toBe(2);
      expect(leanAiExerciseSchema.parse({ slot_number: '3', masterExerciseId: 'ex_1' }).slot).toBe(3);
      expect(leanAiExerciseSchema.parse({ slotId: 4, masterExerciseId: 'ex_1' }).slot).toBe(4);
      expect(leanAiExerciseSchema.parse({ slot_id: '5', masterExerciseId: 'ex_1' }).slot).toBe(5);
    });

    it('passes refine when only slot and masterExerciseId are provided', () => {
      const minimal = leanAiExerciseSchema.parse({
        slot: 1,
        masterExerciseId: 'ex_squat',
      });
      expect(minimal.slot).toBe(1);
      expect(minimal.masterExerciseId).toBe('ex_squat');
      expect(minimal.sets).toBeUndefined();
      expect(minimal.reps).toBeUndefined();
      expect(minimal.restSeconds).toBeUndefined();
    });

    it('rejects exercise raw output without masterExerciseId, id, or name', () => {
      expect(() =>
        leanAiExerciseSchema.parse({
          sets: 3,
          reps: '10',
          restSeconds: 60,
        }),
      ).toThrow();
    });

    it('allows day raw output with or without estimatedDurationMinutes', () => {
      const dayWithoutDuration = leanAiDaySchema.parse({
        dayNumber: 1,
        name: 'Day 1',
        focus: 'Strength',
        exercises: [
          { masterExerciseId: 'ex_squat', sets: 4, reps: '5' },
        ],
      });
      expect(dayWithoutDuration.estimatedDurationMinutes).toBeUndefined();

      const dayWithDuration = leanAiDaySchema.parse({
        dayNumber: 2,
        estimatedDurationMinutes: 55,
        exercises: [
          { masterExerciseId: 'ex_bench', sets: 3, reps: '8' },
        ],
      });
      expect(dayWithDuration.estimatedDurationMinutes).toBe(55);
    });
  });

  describe('deterministic catalog hydration and amber candidate modifications', () => {
    const candidates: CatalogCandidate[] = [
      {
        masterExerciseId: 'ex_barbell_squat',
        name: 'Barbell Back Squat',
        movementPattern: 'squat',
        primaryMuscleGroup: 'quads',
        allowedEquipment: ['barbell', 'squat_rack'],
        cluster: 'green',
      },
      {
        masterExerciseId: 'ex_romanian_deadlift',
        name: 'Romanian Deadlift',
        movementPattern: 'hinge',
        primaryMuscleGroup: 'hamstrings',
        allowedEquipment: ['barbell'],
        cluster: 'amber',
        requiredModifications: ['Hinge to knee height only', 'Keep spine neutral'],
      },
    ];

    const candidateBuild: CandidateBuildResult = {
      candidates,
      allCandidates: candidates,
      clusters: {
        green: [candidates[0]!],
        amber: [candidates[1]!],
        red: [],
        exclusions: [],
      },
      requiredMovementPatterns: ['squat', 'hinge'],
      missingSafeMovementPatterns: [],
    };

    it('guarantees canonical name, movementPattern, muscleGroup from catalog when only masterExerciseId is provided', () => {
      const rawAiResponse = {
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            focus: 'Lower body',
            exercises: [
              {
                masterExerciseId: 'ex_barbell_squat',
                sets: 4,
                reps: '6-8',
                restSeconds: 120,
              },
            ],
          },
        ],
      };

      const hydrated = hydratePlanFromCatalog(rawAiResponse, candidateBuild);
      expect(hydrated.ok).toBe(true);

      const exercise = hydrated.plan.days[0]?.exercises[0];
      expect(exercise).toBeDefined();
      expect(exercise?.masterExerciseId).toBe('ex_barbell_squat');
      expect(exercise?.name).toBe('Barbell Back Squat');
      expect(exercise?.movementPattern).toBe('squat');
      expect(exercise?.muscleGroup).toBe('quads');
    });

    it('always assigns calculatedDuration deterministically to estimatedDurationMinutes even if AI provides raw duration', () => {
      const rawAiResponse = {
        days: [
          {
            dayNumber: 1,
            estimatedDurationMinutes: 180, // AI returned unrealistic duration
            exercises: [
              { masterExerciseId: 'ex_barbell_squat', sets: 4, reps: '6-8', restSeconds: 120 },
            ],
          },
        ],
      };

      const hydrated = hydratePlanFromCatalog(rawAiResponse, candidateBuild);
      const expectedDuration = calculateWorkoutDayDurationMinutes(hydrated.plan.days[0]!);
      expect(hydrated.plan.days[0]?.estimatedDurationMinutes).toBe(expectedDuration);
      expect(hydrated.plan.days[0]?.estimatedDurationMinutes).not.toBe(180);
    });

    it('guarantees requiredModifications for amber candidates in exercise notes', () => {
      const rawAiResponse = {
        days: [
          {
            dayNumber: 1,
            exercises: [
              {
                masterExerciseId: 'ex_romanian_deadlift',
                sets: 3,
                reps: '10',
                restSeconds: 90,
                // AI omitted required modifications in notes
              },
            ],
          },
        ],
      };

      const hydrated = hydratePlanFromCatalog(rawAiResponse, candidateBuild);
      const exercise = hydrated.plan.days[0]?.exercises[0];
      expect(exercise?.notes).toContain('Hinge to knee height only');
      expect(exercise?.notes).toContain('Keep spine neutral');
    });

    it('injectRequiredCandidateModifications appends missing modifications to existing notes', () => {
      const testPlan: WorkoutPlan = {
        schemaVersion: '1.0',
        source: 'ai',
        days: [
          {
            dayNumber: 1,
            name: 'Day 1',
            focus: 'Hinge focus',
            exercises: [
              {
                id: 'ex_romanian_deadlift',
                masterExerciseId: 'ex_romanian_deadlift',
                name: 'Romanian Deadlift',
                muscleGroup: 'hamstrings',
                movementPattern: 'hinge',
                sets: 3,
                reps: '10',
                restSeconds: 90,
                notes: 'Focus on hamstring stretch',
              },
            ],
          },
        ],
        progression: {
          baselineIntensity: 'low-moderate',
          progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
          increasePercent: 10,
          conditions: ['Two pain-free sessions'],
        },
        safetyNotes: [],
        warnings: [],
      };

      const injected = injectRequiredCandidateModifications(testPlan, candidates);
      expect(injected).toBe(true);
      const notes = testPlan.days[0]?.exercises[0]?.notes;
      expect(notes).toContain('Focus on hamstring stretch');
      expect(notes).toContain('Hinge to knee height only');
      expect(notes).toContain('Keep spine neutral');
    });

    it('populates sets, reps, restSeconds, canonical details, calculated duration, and amber modifications when AI provides minimal { slot, masterExerciseId }', () => {
      const rawAiResponse = {
        days: [
          {
            dayNumber: 1,
            exercises: [
              {
                slot: 1,
                masterExerciseId: 'ex_barbell_squat',
              },
              {
                slot: 2,
                masterExerciseId: 'ex_romanian_deadlift',
              },
            ],
          },
        ],
      };

      const context: WorkoutPlanGenerationContext = {
        frequencyDays: 1,
        sessionMinutes: 60,
        goal: 'strength',
        equipment: ['barbell', 'squat_rack'],
        experienceLevel: 'intermediate',
        limitations: [],
        postureFlags: {
          roundedShoulders: false,
          shoulderPain: false,
          kneePain: false,
          lowerBackPain: false,
          neckPain: false,
        },
      };

      const blueprint = getDaySlotBlueprint('full_body', 1, 60);
      const slot1 = blueprint.slots.find((s) => s.slot === 1)!;
      const slot2 = blueprint.slots.find((s) => s.slot === 2)!;

      const hydrated = hydratePlanFromCatalog(rawAiResponse, candidateBuild, context);
      expect(hydrated.ok).toBe(true);

      const day = hydrated.plan.days[0]!;
      expect(day).toBeDefined();
      expect(day.exercises).toHaveLength(2);

      // Exercise 1: Green candidate in slot 1
      const ex1 = day.exercises[0]!;
      expect(ex1.masterExerciseId).toBe('ex_barbell_squat');
      expect(ex1.name).toBe('Barbell Back Squat');
      expect(ex1.movementPattern).toBe('squat');
      expect(ex1.muscleGroup).toBe('quads');
      const expectedSlot1Sets =
        typeof slot1.sets === 'number' ? slot1.sets : parseInt(String(slot1.sets), 10);
      expect(ex1.sets).toBe(expectedSlot1Sets);
      expect(ex1.reps).toBe(slot1.reps);
      expect(ex1.restSeconds).toBe(slot1.restSeconds);

      // Exercise 2: Amber candidate in slot 2
      const ex2 = day.exercises[1]!;
      expect(ex2.masterExerciseId).toBe('ex_romanian_deadlift');
      expect(ex2.name).toBe('Romanian Deadlift');
      expect(ex2.movementPattern).toBe('hinge');
      expect(ex2.muscleGroup).toBe('hamstrings');
      const expectedSlot2Sets =
        typeof slot2.sets === 'number' ? slot2.sets : parseInt(String(slot2.sets), 10);
      expect(ex2.sets).toBe(expectedSlot2Sets);
      expect(ex2.reps).toBe(slot2.reps);
      expect(ex2.restSeconds).toBe(slot2.restSeconds);
      // Amber modification auto-injected
      expect(ex2.notes).toContain('Hinge to knee height only');
      expect(ex2.notes).toContain('Keep spine neutral');

      // Duration calculated deterministically
      const expectedDuration = calculateWorkoutDayDurationMinutes(day);
      expect(day.estimatedDurationMinutes).toBe(expectedDuration);
      expect(day.estimatedDurationMinutes).toBeGreaterThan(0);
    });
  });
});

