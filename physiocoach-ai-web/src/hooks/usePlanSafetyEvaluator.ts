import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../services/api-client';
import type { PlanBuilderDay } from '../pages/PlanBuilderPage';

export interface SafetyIssue {
  dayIndex: number;
  exerciseIndex: number;
  exerciseName: string;
  problemText: string;
  actionType: 'SWAP' | 'REDUCE_SETS';
  suggestedExerciseName?: string;
  suggestedExerciseId?: string;
  suggestedSets?: number;
}

export interface SafetyEvaluationResult {
  safetyScore: number;
  status: 'safe' | 'caution' | 'unsafe';
  summary: string;
  issues: SafetyIssue[];
  traceId: string;
  auditLogId: string;
}

export function usePlanSafetyEvaluator(days: PlanBuilderDay[], split?: string) {
  const [safetyScore, setSafetyScore] = useState<number>(96);
  const [status, setStatus] = useState<'safe' | 'caution' | 'unsafe'>('safe');
  const [summary, setSummary] = useState<string>('Evaluating your routine for safety...');
  const [issues, setIssues] = useState<SafetyIssue[]>([]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  const lastEvaluatedHash = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Quick signature of the days & exercises to avoid duplicate requests
  const computePlanSignature = useCallback((daysList: PlanBuilderDay[]): string => {
    return daysList
      .map(
        (d, dIdx) =>
          `d${dIdx}:` +
          d.exercises
            .map((e, eIdx) => `${eIdx}_${e.exerciseName}_${e.sets.length}`)
            .join('|'),
      )
      .join(';');
  }, []);

  const evaluateSafety = useCallback(
    async (currentDays: PlanBuilderDay[]) => {
      const signature = computePlanSignature(currentDays);
      if (signature === lastEvaluatedHash.current && signature !== '') {
        return;
      }

      // Check if plan has exercises
      const totalExercises = currentDays.reduce((acc, d) => acc + d.exercises.length, 0);
      if (totalExercises === 0) {
        setSafetyScore(100);
        setStatus('safe');
        setSummary('Add exercises to see your AI Safety Score.');
        setIssues([]);
        setIsEvaluating(false);
        return;
      }

      setIsEvaluating(true);
      try {
        const payload = {
          days: currentDays.map((d) => ({
            dayName: d.dayName,
            exercises: d.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              movementPattern: e.movementPattern,
              muscleGroups: e.muscleGroups,
              sets: e.sets.map((s) => ({
                setNumber: s.setNumber,
                setType: s.setType,
                targetReps: s.targetReps,
                targetRir: s.targetRir,
                tempo: s.tempo,
                restSeconds: s.restSeconds,
              })),
            })),
          })),
          split,
        };

        const result = await apiClient.post<SafetyEvaluationResult>(
          'workout-plans/evaluate-safety',
          payload,
        );

        lastEvaluatedHash.current = signature;
        setSafetyScore(result.safetyScore);
        setStatus(result.status);
        setSummary(result.summary);
        setIssues(result.issues || []);
      } catch (err) {
        console.warn('usePlanSafetyEvaluator.error', err);
        // Do not crash UI; maintain existing score or friendly status
      } finally {
        setIsEvaluating(false);
      }
    },
    [computePlanSignature, split],
  );

  // Trigger debounced evaluation whenever days change
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      evaluateSafety(days);
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [days, evaluateSafety]);

  const getIssuesForExercise = useCallback(
    (dayIndex: number, exerciseIndex: number): SafetyIssue[] => {
      return issues.filter(
        (issue) => issue.dayIndex === dayIndex && issue.exerciseIndex === exerciseIndex,
      );
    },
    [issues],
  );

  return {
    safetyScore,
    status,
    summary,
    issues,
    isEvaluating,
    getIssuesForExercise,
    reEvaluate: () => evaluateSafety(days),
  };
}
