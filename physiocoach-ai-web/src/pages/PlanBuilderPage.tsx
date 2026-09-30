import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Dumbbell,
  Flame,
  Info,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';
import { Badge } from '../components/ui/Badge';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { SafetyAuditModal } from '../components/ui/SafetyAuditModal';
import { apiClient } from '../services/api-client';
import {
  usePlanSafetyEvaluator,
  type SafetyIssue,
} from '../hooks/usePlanSafetyEvaluator';
import {
  fetchCatalogExercises,
  type CatalogExerciseItem,
} from '../app/features/exercise-catalog/services/exercise-catalog-api';

export type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE';

export interface PlanBuilderSet {
  id: string;
  setNumber: number;
  setType: SetType;
  targetReps: string;
  targetRir: number;
  tempo: string;
  restSeconds: number;
}

export interface PlanBuilderExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  movementPattern: string;
  muscleGroups: string[];
  sets: PlanBuilderSet[];
}

export interface PlanBuilderDay {
  id: string;
  dayName: string;
  exercises: PlanBuilderExercise[];
}

type SplitPreset = 'ppl' | 'upper_lower' | 'full_body' | 'custom';

const SET_TYPE_CONFIG: Record<
  SetType,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  NORMAL: {
    label: 'Normal',
    bg: 'bg-zinc-800',
    text: 'text-zinc-200',
    border: 'border-zinc-700',
    desc: 'Standard working set with target RIR',
  },
  WARMUP: {
    label: 'Warmup',
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    desc: 'Acclimatization / submaximal prep set',
  },
  DROP: {
    label: 'Drop Set',
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    desc: 'Immediate load reduction to failure',
  },
  FAILURE: {
    label: 'Failure',
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    desc: 'Maximum exertion (0 RIR)',
  },
};

const TEMPO_PRESETS = ['3-0-1-0', '2-0-1-1', '4-1-1-0', '2-0-2-0'];
const REST_PRESETS = [60, 90, 120, 180];

const MUSCLE_FILTER_OPTIONS = [
  'All',
  'Chest',
  'Back',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Core',
  'Calves',
];

const MUSCLE_PARAM_MAP: Record<string, string> = {
  all: '',
  chest: 'pectorals',
  back: 'lats',
  shoulders: 'deltoids',
  quads: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  biceps: 'biceps',
  triceps: 'triceps',
  core: 'abs',
  calves: 'calves',
};

function formatMovementTag(tag?: string): string {
  if (!tag) return '';
  return tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function createDefaultSet(setNumber = 1, setType: SetType = 'NORMAL'): PlanBuilderSet {
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    setNumber,
    setType,
    targetReps: '8-10',
    targetRir: setType === 'FAILURE' ? 0 : setType === 'WARMUP' ? 3 : 2,
    tempo: '3-0-1-0',
    restSeconds: 90,
  };
}

function createDefaultExercise(
  name: string,
  exerciseId: string,
  movementPattern = 'push',
  muscleGroup = 'chest',
): PlanBuilderExercise {
  return {
    id: `builder_ex_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    exerciseId: exerciseId || name.toLowerCase().replace(/\s+/g, '-'),
    exerciseName: name,
    movementPattern,
    muscleGroups: [muscleGroup],
    sets: [
      createDefaultSet(1, 'WARMUP'),
      createDefaultSet(2, 'NORMAL'),
      createDefaultSet(3, 'NORMAL'),
    ],
  };
}

function getInitialDaysForSplit(split: SplitPreset): PlanBuilderDay[] {
  if (split === 'ppl') {
    return [
      {
        id: 'day-push',
        dayName: 'Push Day (Chest, Shoulders, Triceps)',
        exercises: [
          createDefaultExercise('Incline Dumbbell Bench Press', 'incline-db-bench', 'push', 'chest'),
          createDefaultExercise('Barbell Overhead Press', 'barbell-ohp', 'push', 'shoulders'),
          createDefaultExercise('Cable Chest Fly', 'cable-chest-fly', 'push', 'chest'),
          createDefaultExercise('Triceps Rope Pushdown', 'triceps-rope-pushdown', 'push', 'triceps'),
        ],
      },
      {
        id: 'day-pull',
        dayName: 'Pull Day (Back, Rear Delts, Biceps)',
        exercises: [
          createDefaultExercise('Lat Pulldown', 'lat-pulldown', 'pull', 'back'),
          createDefaultExercise('Chest Supported Row', 'chest-supported-row', 'pull', 'back'),
          createDefaultExercise('Face Pull', 'face-pull', 'pull', 'shoulders'),
          createDefaultExercise('Incline Dumbbell Curl', 'incline-db-curl', 'pull', 'biceps'),
        ],
      },
      {
        id: 'day-legs',
        dayName: 'Legs Day (Quads, Hamstrings, Calves)',
        exercises: [
          createDefaultExercise('Barbell Back Squat', 'barbell-squat', 'squat', 'quads'),
          createDefaultExercise('Romanian Deadlift', 'romanian-deadlift', 'hinge', 'hamstrings'),
          createDefaultExercise('Leg Extension', 'leg-extension', 'squat', 'quads'),
          createDefaultExercise('Standing Calf Raise', 'standing-calf-raise', 'squat', 'calves'),
        ],
      },
    ];
  }

  if (split === 'upper_lower') {
    return [
      {
        id: 'day-upper-a',
        dayName: 'Upper Body A',
        exercises: [
          createDefaultExercise('Flat Barbell Bench Press', 'flat-barbell-bench', 'push', 'chest'),
          createDefaultExercise('Barbell Bent-Over Row', 'bent-over-row', 'pull', 'back'),
          createDefaultExercise('Dumbbell Lateral Raise', 'db-lateral-raise', 'push', 'shoulders'),
          createDefaultExercise('Overhead Triceps Extension', 'overhead-tricep-ext', 'push', 'triceps'),
        ],
      },
      {
        id: 'day-lower-a',
        dayName: 'Lower Body A',
        exercises: [
          createDefaultExercise('Barbell Back Squat', 'barbell-squat', 'squat', 'quads'),
          createDefaultExercise('Romanian Deadlift', 'romanian-deadlift', 'hinge', 'hamstrings'),
          createDefaultExercise('Bulgarian Split Squat', 'bulgarian-split-squat', 'lunge', 'quads'),
          createDefaultExercise('Hanging Knee Raise', 'hanging-knee-raise', 'core', 'core'),
        ],
      },
      {
        id: 'day-upper-b',
        dayName: 'Upper Body B',
        exercises: [
          createDefaultExercise('Standing Overhead Press', 'standing-ohp', 'push', 'shoulders'),
          createDefaultExercise('Neutral-Grip Pull-Up', 'neutral-pull-up', 'pull', 'back'),
          createDefaultExercise('Incline Dumbbell Press', 'incline-db-press', 'push', 'chest'),
          createDefaultExercise('Hammer Curl', 'hammer-curl', 'pull', 'biceps'),
        ],
      },
      {
        id: 'day-lower-b',
        dayName: 'Lower Body B',
        exercises: [
          createDefaultExercise('Conventional Deadlift', 'conventional-deadlift', 'hinge', 'hamstrings'),
          createDefaultExercise('Leg Press', 'leg-press', 'squat', 'quads'),
          createDefaultExercise('Lying Leg Curl', 'lying-leg-curl', 'hinge', 'hamstrings'),
          createDefaultExercise('Standing Calf Raise', 'standing-calf-raise', 'squat', 'calves'),
        ],
      },
    ];
  }

  if (split === 'full_body') {
    return [
      {
        id: 'day-fb-1',
        dayName: 'Full Body A',
        exercises: [
          createDefaultExercise('Barbell Back Squat', 'barbell-squat', 'squat', 'quads'),
          createDefaultExercise('Flat Bench Press', 'flat-bench-press', 'push', 'chest'),
          createDefaultExercise('Lat Pulldown', 'lat-pulldown', 'pull', 'back'),
          createDefaultExercise('Dumbbell Lateral Raise', 'db-lateral-raise', 'push', 'shoulders'),
        ],
      },
      {
        id: 'day-fb-2',
        dayName: 'Full Body B',
        exercises: [
          createDefaultExercise('Romanian Deadlift', 'romanian-deadlift', 'hinge', 'hamstrings'),
          createDefaultExercise('Overhead Press', 'overhead-press', 'push', 'shoulders'),
          createDefaultExercise('Chest Supported Row', 'chest-supported-row', 'pull', 'back'),
          createDefaultExercise('Incline Dumbbell Curl', 'incline-db-curl', 'pull', 'biceps'),
        ],
      },
      {
        id: 'day-fb-3',
        dayName: 'Full Body C',
        exercises: [
          createDefaultExercise('Leg Press', 'leg-press', 'squat', 'quads'),
          createDefaultExercise('Incline Dumbbell Bench', 'incline-db-bench', 'push', 'chest'),
          createDefaultExercise('Seated Cable Row', 'seated-cable-row', 'pull', 'back'),
          createDefaultExercise('Plank', 'plank', 'core', 'core'),
        ],
      },
    ];
  }

  return [
    {
      id: 'day-custom-1',
      dayName: 'Workout Day 1',
      exercises: [
        createDefaultExercise('Incline Dumbbell Bench Press', 'incline-db-bench', 'push', 'chest'),
        createDefaultExercise('Lat Pulldown', 'lat-pulldown', 'pull', 'back'),
      ],
    },
  ];
}

export function PlanBuilderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [, startTransition] = useTransition();

  const [searchParams] = useSearchParams();
  const incomingPlan = location.state?.plan;
  const incomingPlanId = location.state?.planId || searchParams.get('planId') || null;

  // Initialize title, split, and days from incomingPlan if available
  const initialData = useMemo(() => {
    if (incomingPlan && Array.isArray(incomingPlan.days) && incomingPlan.days.length > 0) {
      const parsedDays: PlanBuilderDay[] = incomingPlan.days.map((d: any, dIdx: number) => ({
        id: d.id || `day_${dIdx + 1}`,
        dayName: d.name || d.dayName || d.title || `Day ${dIdx + 1}`,
        exercises: (d.exercises || []).map((ex: any, exIdx: number) => {
          const rawSets = ex.customSets || ex.sets;
          let parsedSets: PlanBuilderSet[] = [];
          if (Array.isArray(rawSets) && rawSets.length > 0 && typeof rawSets[0] === 'object') {
            parsedSets = rawSets.map((s: any, sIdx: number) => ({
              id: s.id || `set_${dIdx}_${exIdx}_${sIdx}`,
              setNumber: s.setNumber || sIdx + 1,
              setType: (s.setType as SetType) || 'NORMAL',
              targetReps: String(s.targetReps || s.reps || '8-10'),
              targetRir: Number(s.targetRir ?? s.rir ?? 2),
              tempo: s.tempo || '3-0-1-0',
              restSeconds: Number(s.restSeconds || s.rest || 90),
            }));
          } else {
            const count = typeof rawSets === 'number' ? rawSets : 3;
            parsedSets = Array.from({ length: count }, (_, sIdx) =>
              createDefaultSet(sIdx + 1, sIdx === 0 ? 'WARMUP' : 'NORMAL')
            );
          }

          return {
            id: ex.id || `builder_ex_${dIdx}_${exIdx}`,
            exerciseId: ex.masterExerciseId || ex.exerciseId || ex.id || String(exIdx + 1),
            exerciseName: ex.name || ex.exerciseName || 'Exercise',
            movementPattern: ex.movementPattern || 'push',
            muscleGroups: ex.muscleGroup ? [ex.muscleGroup] : ex.muscleGroups || ['chest'],
            sets: parsedSets,
          };
        }),
      }));

      return {
        title: incomingPlan.title || incomingPlan.name || 'Custom Hypertrophy Blueprint',
        description: incomingPlan.description || 'Personalized routine.',
        split: (incomingPlan.split as SplitPreset) || 'custom',
        days: parsedDays,
      };
    }

    return {
      title: 'Custom Hypertrophy Blueprint',
      description: 'Personalized high-frequency hypertrophy routine.',
      split: 'ppl' as SplitPreset,
      days: getInitialDaysForSplit('ppl'),
    };
  }, [incomingPlan]);

  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description);
  const [split, setSplit] = useState<SplitPreset>(initialData.split);
  const [days, setDays] = useState<PlanBuilderDay[]>(initialData.days);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [showPlanDetails, setShowPlanDetails] = useState(false);

  // If opening builder with a planId and no cached plan in location state, fetch from API
  useEffect(() => {
    if (incomingPlanId && !incomingPlan) {
      let active = true;
      apiClient
        .get<any>(`workout-plans/${incomingPlanId}`)
        .then((res) => {
          if (!active) return;
          const payload = res?.data || res;
          const planData = payload?.plan || (payload?.days ? payload : null);
          if (planData && Array.isArray(planData.days)) {
            setTitle(planData.name || planData.title || 'Custom Hypertrophy Blueprint');
            setDescription(planData.description || '');
            if (planData.scheduleType) {
              setSplit(planData.scheduleType as SplitPreset);
            }
            const parsedDays: PlanBuilderDay[] = planData.days.map((d: any, dIdx: number) => ({
              id: d.id || `day_${dIdx + 1}`,
              dayName: d.name || d.dayName || d.title || `Day ${dIdx + 1}`,
              exercises: (d.exercises || []).map((ex: any, exIdx: number) => {
                const rawSets = ex.customSets || ex.sets;
                let parsedSets: PlanBuilderSet[] = [];
                if (Array.isArray(rawSets) && rawSets.length > 0 && typeof rawSets[0] === 'object') {
                  parsedSets = rawSets.map((s: any, sIdx: number) => ({
                    id: s.id || `set_${dIdx}_${exIdx}_${sIdx}`,
                    setNumber: s.setNumber || sIdx + 1,
                    setType: (s.setType as SetType) || 'NORMAL',
                    targetReps: String(s.targetReps || s.reps || '8-10'),
                    targetRir: Number(s.targetRir ?? s.rir ?? 2),
                    tempo: s.tempo || '3-0-1-0',
                    restSeconds: Number(s.restSeconds || s.rest || 90),
                  }));
                } else {
                  const count = typeof rawSets === 'number' ? rawSets : 3;
                  parsedSets = Array.from({ length: count }, (_, sIdx) =>
                    createDefaultSet(sIdx + 1, sIdx === 0 ? 'WARMUP' : 'NORMAL')
                  );
                }
                return {
                  id: ex.id || `builder_ex_${dIdx}_${exIdx}`,
                  exerciseId: ex.masterExerciseId || ex.exerciseId || ex.id || String(exIdx + 1),
                  exerciseName: ex.name || ex.exerciseName || 'Exercise',
                  movementPattern: ex.movementPattern || 'push',
                  muscleGroups: ex.muscleGroup ? [ex.muscleGroup] : ex.muscleGroups || ['chest'],
                  sets: parsedSets,
                };
              }),
            }));
            setDays(parsedDays);
          }
        })
        .catch((err) => {
          console.warn('Failed to load plan for editing in builder:', err);
        });
      return () => {
        active = false;
      };
    }
  }, [incomingPlanId, incomingPlan]);

  // Exercise Picker Drawer State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState('All');
  const [catalogItems, setCatalogItems] = useState<CatalogExerciseItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Submission & Alert State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Replace / Swap Exercise State
  const [replacingExercise, setReplacingExercise] = useState<{
    dayIdx: number;
    exIdx: number;
    exercise: PlanBuilderExercise;
  } | null>(null);

  // Expanded Exercise Details (Accordion State - Collapsed by default)
  const [expandedExerciseIds, setExpandedExerciseIds] = useState<Record<string, boolean>>({});

  const toggleExerciseExpand = (id: string) => {
    setExpandedExerciseIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Safety Audit Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Real-Time Dynamic AI Safety Evaluation
  const {
    safetyScore,
    status: safetyStatus,
    summary: safetySummary,
    issues: safetyIssues,
    isEvaluating: isEvaluatingSafety,
    getIssuesForExercise,
  } = usePlanSafetyEvaluator(days, split);

  // Advisory Non-blocking Confirmation Modal State
  const [showAdvisoryConfirmModal, setShowAdvisoryConfirmModal] = useState(false);

  // 1-Click Apply Swap from AI Safety Warning
  const handleApplySwap = (dayIdx: number, exIdx: number, issue: SafetyIssue) => {
    if (!issue.suggestedExerciseName) return;
    const targetDay = days[dayIdx];
    if (!targetDay) return;
    const targetEx = targetDay.exercises[exIdx];
    if (!targetEx) return;

    const updatedEx: PlanBuilderExercise = {
      ...targetEx,
      exerciseName: issue.suggestedExerciseName,
      exerciseId:
        issue.suggestedExerciseId ||
        issue.suggestedExerciseName.toLowerCase().replace(/\s+/g, '-'),
    };

    const updatedExercises = [...targetDay.exercises];
    updatedExercises[exIdx] = updatedEx;

    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
    setDays(updatedDays);

    setToast({
      message: `Switched to ${issue.suggestedExerciseName}!`,
      type: 'success',
    });
  };

  // 1-Click Apply Set Reduction from AI Safety Warning
  const handleApplyReduceSets = (dayIdx: number, exIdx: number, suggestedSets = 3) => {
    const targetDay = days[dayIdx];
    if (!targetDay) return;
    const targetEx = targetDay.exercises[exIdx];
    if (!targetEx) return;

    if (targetEx.sets.length <= suggestedSets) return;

    const updatedSets = targetEx.sets.slice(0, suggestedSets);
    const updatedEx: PlanBuilderExercise = {
      ...targetEx,
      sets: updatedSets,
    };

    const updatedExercises = [...targetDay.exercises];
    updatedExercises[exIdx] = updatedEx;

    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
    setDays(updatedDays);

    setToast({
      message: `Reduced ${targetEx.exerciseName} to ${suggestedSets} sets!`,
      type: 'success',
    });
  };

  // Switch Split Preset
  const handleSplitChange = (newSplit: SplitPreset) => {
    setSplit(newSplit);
    const newDays = getInitialDaysForSplit(newSplit);
    setDays(newDays);
    setSelectedDayIndex(0);
  };

  // Day Management
  const handleAddDay = () => {
    const nextDayNum = days.length + 1;
    const newDay: PlanBuilderDay = {
      id: `day_${Date.now()}`,
      dayName: `Day ${nextDayNum} - Custom Routine`,
      exercises: [],
    };
    setDays([...days, newDay]);
    setSelectedDayIndex(days.length);
  };

  const handleRemoveDay = (dayIndex: number) => {
    if (days.length <= 1) {
      setToast({ message: 'A plan must contain at least one training day.', type: 'error' });
      return;
    }
    const updated = days.filter((_, idx) => idx !== dayIndex);
    setDays(updated);
    if (selectedDayIndex >= updated.length) {
      setSelectedDayIndex(updated.length - 1);
    }
  };

  const handleRenameDay = (dayIndex: number, newName: string) => {
    const updated = [...days];
    if (updated[dayIndex]) {
      updated[dayIndex].dayName = newName;
      setDays(updated);
    }
  };

  // Exercise Management within active day
  const activeDay = days[selectedDayIndex] || days[0];

  const handleMoveExercise = (dayIdx: number, exIdx: number, direction: 'up' | 'down') => {
    const targetDay = days[dayIdx];
    if (!targetDay) return;
    const exList = [...targetDay.exercises];
    const newIdx = direction === 'up' ? exIdx - 1 : exIdx + 1;
    if (newIdx < 0 || newIdx >= exList.length) return;

    const [moved] = exList.splice(exIdx, 1);
    exList.splice(newIdx, 0, moved);

    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: exList };
    setDays(updatedDays);
  };

  const handleRemoveExercise = (dayIdx: number, exIdx: number) => {
    const targetDay = days[dayIdx];
    if (!targetDay) return;
    const exList = targetDay.exercises.filter((_, i) => i !== exIdx);
    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: exList };
    setDays(updatedDays);
  };

  // Set Management
  const handleAddSet = (dayIdx: number, exIdx: number) => {
    const targetDay = days[dayIdx];
    const targetEx = targetDay?.exercises[exIdx];
    if (!targetEx) return;

    const lastSet = targetEx.sets[targetEx.sets.length - 1];
    const newSet = createDefaultSet(
      targetEx.sets.length + 1,
      lastSet ? lastSet.setType : 'NORMAL',
    );
    if (lastSet) {
      newSet.targetReps = lastSet.targetReps;
      newSet.targetRir = lastSet.targetRir;
      newSet.tempo = lastSet.tempo;
      newSet.restSeconds = lastSet.restSeconds;
    }

    const updatedExercises = [...targetDay.exercises];
    updatedExercises[exIdx] = {
      ...targetEx,
      sets: [...targetEx.sets, newSet],
    };

    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
    setDays(updatedDays);
  };

  const handleRemoveSet = (dayIdx: number, exIdx: number, setIdx: number) => {
    const targetDay = days[dayIdx];
    const targetEx = targetDay?.exercises[exIdx];
    if (!targetEx || targetEx.sets.length <= 1) {
      setToast({ message: 'An exercise must have at least one set.', type: 'error' });
      return;
    }

    const updatedSets = targetEx.sets
      .filter((_, i) => i !== setIdx)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));

    const updatedExercises = [...targetDay.exercises];
    updatedExercises[exIdx] = { ...targetEx, sets: updatedSets };

    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
    setDays(updatedDays);
  };

  const handleUpdateSet = (
    dayIdx: number,
    exIdx: number,
    setIdx: number,
    field: keyof PlanBuilderSet,
    val: any,
  ) => {
    const targetDay = days[dayIdx];
    const targetEx = targetDay?.exercises[exIdx];
    if (!targetEx) return;

    const updatedSets = targetEx.sets.map((s, i) => (i === setIdx ? { ...s, [field]: val } : s));
    const updatedExercises = [...targetDay.exercises];
    updatedExercises[exIdx] = { ...targetEx, sets: updatedSets };

    const updatedDays = [...days];
    updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
    setDays(updatedDays);
  };

  // Start Replace Exercise flow
  const handleStartReplaceExercise = (exIdx: number, exercise: PlanBuilderExercise) => {
    setReplacingExercise({
      dayIdx: selectedDayIndex,
      exIdx,
      exercise,
    });
    const primaryMuscle = exercise.muscleGroups[0];
    if (primaryMuscle) {
      const matchedFilter = MUSCLE_FILTER_OPTIONS.find(
        (m) =>
          m.toLowerCase() === primaryMuscle.toLowerCase() ||
          MUSCLE_PARAM_MAP[m.toLowerCase()] === primaryMuscle.toLowerCase(),
      );
      setSelectedMuscleFilter(matchedFilter || 'All');
    } else {
      setSelectedMuscleFilter('All');
    }
    setSearchQuery('');
    setIsCatalogOpen(true);
  };

  // Add or Replace Exercise from Catalog
  const handleSelectCatalogItem = (catalogItem: CatalogExerciseItem) => {
    if (replacingExercise) {
      const { dayIdx, exIdx } = replacingExercise;
      const targetDay = days[dayIdx];
      if (!targetDay) return;

      const existingEx = targetDay.exercises[exIdx];
      const updatedEx: PlanBuilderExercise = {
        id: existingEx?.id || `builder_ex_${Date.now()}`,
        exerciseId: catalogItem.id || catalogItem.canonicalId,
        exerciseName: catalogItem.name,
        movementPattern: catalogItem.movementPattern || existingEx?.movementPattern || 'push',
        muscleGroups: [catalogItem.primaryMuscle || 'chest'],
        // Keep existing customized sets
        sets: existingEx?.sets?.length
          ? existingEx.sets
          : [
              createDefaultSet(1, 'WARMUP'),
              createDefaultSet(2, 'NORMAL'),
              createDefaultSet(3, 'NORMAL'),
            ],
      };

      const updatedExercises = [...targetDay.exercises];
      updatedExercises[exIdx] = updatedEx;

      const updatedDays = [...days];
      updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
      setDays(updatedDays);

      setToast({
        message: `Replaced with "${catalogItem.name}"`,
        type: 'success',
      });
      setReplacingExercise(null);
      setIsCatalogOpen(false);
    } else {
      handleAddExerciseFromCatalog(catalogItem);
      setIsCatalogOpen(false);
    }
  };

  // Add Exercise from Catalog into active day
  const handleAddExerciseFromCatalog = (catalogItem: CatalogExerciseItem) => {
    const newEx = createDefaultExercise(
      catalogItem.name,
      catalogItem.id || catalogItem.canonicalId,
      catalogItem.movementPattern || 'push',
      catalogItem.primaryMuscle || 'chest',
    );

    const targetDay = days[selectedDayIndex];
    if (!targetDay) return;

    const updatedDays = [...days];
    updatedDays[selectedDayIndex] = {
      ...targetDay,
      exercises: [...targetDay.exercises, newEx],
    };
    setDays(updatedDays);
    setToast({ message: `Added ${catalogItem.name} to Day ${selectedDayIndex + 1}`, type: 'success' });
  };

  // Quick Add Custom Exercise
  const handleAddCustomExercise = (customName: string) => {
    if (!customName.trim()) return;
    if (replacingExercise) {
      const { dayIdx, exIdx } = replacingExercise;
      const targetDay = days[dayIdx];
      if (!targetDay) return;
      const existingEx = targetDay.exercises[exIdx];
      const updatedEx: PlanBuilderExercise = {
        ...existingEx,
        exerciseName: customName.trim(),
        exerciseId: `custom_${Date.now()}`,
      };
      const updatedExercises = [...targetDay.exercises];
      updatedExercises[exIdx] = updatedEx;
      const updatedDays = [...days];
      updatedDays[dayIdx] = { ...targetDay, exercises: updatedExercises };
      setDays(updatedDays);
      setToast({ message: `Replaced with "${customName}"`, type: 'success' });
      setReplacingExercise(null);
      setIsCatalogOpen(false);
      setSearchQuery('');
      return;
    }

    const newEx = createDefaultExercise(customName.trim(), `custom_${Date.now()}`, 'push', 'chest');
    const targetDay = days[selectedDayIndex];
    if (!targetDay) return;

    const updatedDays = [...days];
    updatedDays[selectedDayIndex] = {
      ...targetDay,
      exercises: [...targetDay.exercises, newEx],
    };
    setDays(updatedDays);
    setSearchQuery('');
    setToast({ message: `Added custom exercise: ${customName}`, type: 'success' });
  };

  // Fetch Catalog Exercises for Picker
  useEffect(() => {
    let active = true;
    if (isCatalogOpen) {
      setCatalogLoading(true);
      const mappedMuscle =
        selectedMuscleFilter !== 'All'
          ? MUSCLE_PARAM_MAP[selectedMuscleFilter.toLowerCase()] ||
            selectedMuscleFilter.toLowerCase()
          : undefined;

      fetchCatalogExercises({
        q: searchQuery || undefined,
        primaryMuscle: mappedMuscle,
        limit: 30,
      })
        .then((res) => {
          if (!active) return;
          setCatalogItems(res.data || []);
        })
        .catch((err) => console.error('Failed to search catalog:', err))
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [isCatalogOpen, searchQuery, selectedMuscleFilter]);

  // Weekly Volume & Plan HUD Metrics
  const hudMetrics = useMemo(() => {
    let totalExercises = 0;
    let totalWeeklySets = 0;
    const muscleVolume: Record<string, number> = {};

    days.forEach((day) => {
      totalExercises += day.exercises.length;
      day.exercises.forEach((ex) => {
        const workingSets = ex.sets.filter((s) => s.setType !== 'WARMUP').length;
        totalWeeklySets += workingSets;

        ex.muscleGroups.forEach((muscle) => {
          const normMuscle = muscle.toLowerCase().replace(/_/g, ' ');
          muscleVolume[normMuscle] = (muscleVolume[normMuscle] || 0) + workingSets;
        });
      });
    });

    return {
      totalDays: days.length,
      totalExercises,
      totalWeeklySets,
      muscleVolume,
    };
  }, [days]);

  // Submit Plan to Backend (Actual Persistence)
  const executeSavePlan = async () => {
    if (!title.trim() || title.trim().length < 3) {
      setToast({ message: 'Please enter a plan title (at least 3 characters).', type: 'error' });
      return;
    }

    // Ensure all days have at least 1 exercise and sets
    for (let i = 0; i < days.length; i++) {
      if (days[i].exercises.length === 0) {
        setToast({
          message: `Day ${i + 1} (${days[i].dayName}) has no exercises. Add exercises before saving.`,
          type: 'error',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        split: split === 'ppl' || split === 'upper_lower' || split === 'full_body' ? split : 'custom',
        frequencyDays: Math.min(7, Math.max(1, days.length)),
        days: days.map((day) => ({
          dayName: day.dayName,
          exercises: day.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
            movementPattern: ex.movementPattern,
            muscleGroups: ex.muscleGroups,
            sets: ex.sets.map((s, idx) => ({
              setNumber: idx + 1,
              setType: s.setType,
              targetReps: s.targetReps,
              targetRir: s.targetRir,
              tempo: s.tempo,
              restSeconds: Number(s.restSeconds) || 90,
            })),
          })),
        })),
      };

      let res: any;
      if (incomingPlanId) {
        res = await apiClient.put<any>(`workout-plans/${incomingPlanId}`, payload);
      } else {
        res = await apiClient.post<any>('workout-plans/custom', payload);
      }

      if (res && (res.success || res.data?.id || res.planId)) {
        setToast({
          message: incomingPlanId ? 'Workout routine updated successfully!' : 'Custom workout plan saved and activated!',
          type: 'success',
        });
        setTimeout(() => {
          navigate('/plan');
        }, 600);
      } else {
        throw new Error(res?.error?.message || 'Failed to save workout plan');
      }
    } catch (cause) {
      console.error('Plan save error:', cause);
      setToast({
        message: cause instanceof Error ? cause.message : 'Could not save custom plan.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advisory Non-Blocking Save Trigger
  const handleSaveAndActivate = async () => {
    // If plan has safety recommendations, show friendly advisory prompt
    if (safetyIssues.length > 0) {
      setShowAdvisoryConfirmModal(true);
      return;
    }
    await executeSavePlan();
  };

  // Publish Plan to Explore Hub
  const handlePublishPlan = async () => {
    if (!title.trim() || title.trim().length < 3) {
      setToast({ message: 'Please enter a plan title (at least 3 characters).', type: 'error' });
      return null;
    }

    for (let i = 0; i < days.length; i++) {
      if (days[i].exercises.length === 0) {
        setToast({
          message: `Day ${i + 1} (${days[i].dayName}) has no exercises. Add exercises before publishing.`,
          type: 'error',
        });
        return null;
      }
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      split: split === 'ppl' || split === 'upper_lower' || split === 'full_body' ? split : 'custom',
      frequencyDays: Math.min(7, Math.max(1, days.length)),
      days: days.map((day) => ({
        dayName: day.dayName,
        exercises: day.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          movementPattern: ex.movementPattern,
          muscleGroups: ex.muscleGroups,
          sets: ex.sets.map((s, idx) => ({
            setNumber: idx + 1,
            setType: s.setType,
            targetReps: s.targetReps,
            targetRir: s.targetRir,
            tempo: s.tempo,
            restSeconds: Number(s.restSeconds) || 90,
          })),
        })),
      })),
    };

    // 1. Save or update plan to obtain planId
    let planId = incomingPlanId;
    if (incomingPlanId) {
      await apiClient.put<any>(`workout-plans/${incomingPlanId}`, payload);
    } else {
      const saveRes = await apiClient.post<any>('workout-plans/custom', payload);
      planId = saveRes?.planId || saveRes?.data?.id;
    }

    if (!planId) {
      throw new Error('Could not save routine before publishing.');
    }

    // 2. Publish plan to Explore Hub
    const pubRes = await apiClient.post<{
      success: boolean;
      publishedPlanId: string;
      personas: string[];
      exploreUrl: string;
    }>(`workout-plans/${planId}/publish`);

    setToast({
      message: `Plan "${title}" published to Community Hub with candidate persona matches!`,
      type: 'success',
    });

    return pubRes;
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#090D15] text-zinc-50 select-none">
      {/* 1. COMPACT STICKY TOP APP BAR (~52px) */}
      <header className="shrink-0 z-30 border-b border-zinc-800/80 bg-[#121722]/95 px-3 sm:px-6 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          {/* Left: Back button to /plan */}
          <button
            type="button"
            onClick={() => navigate('/plan')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-bold text-zinc-400 hover:border-zinc-700 hover:text-white transition-all shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Center: Program Title Input */}
          <div className="flex-1 max-w-xs sm:max-w-md mx-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Routine Title"
              className="w-full text-center text-xs sm:text-sm font-black text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-[#10E760] outline-none truncate transition-colors"
            />
          </div>

          {/* Right Actions: Audit & Save CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip content="Safety & Volume Audit" position="bottom">
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(true)}
                className="grid size-8 place-items-center rounded-xl border border-zinc-800 bg-zinc-900 text-[#10E760] hover:bg-[#10E760]/10 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
              </button>
            </Tooltip>

            <Button
              type="button"
              variant="volt"
              size="sm"
              loading={isSubmitting}
              onClick={handleSaveAndActivate}
              className="h-8 px-3 text-xs font-black shadow-md shadow-[#10E760]/20"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              <span>{incomingPlanId ? 'Update Routine' : 'Save'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. MAIN NATURAL-SCROLL WORKSPACE */}
      <main className="flex-1 overflow-y-auto min-h-0 p-3.5 sm:p-6 pb-32 overscroll-contain">
        <div className="mx-auto max-w-5xl space-y-4">
          {/* REAL-TIME AI SAFETY SCORE HUD BAR */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#121722]/90 p-3.5 sm:p-4 shadow-sm backdrop-blur-sm transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Score Number / Ring */}
                <div
                  className={`flex items-center justify-center size-11 sm:size-12 rounded-xl font-mono font-black text-base sm:text-lg border shrink-0 transition-colors ${
                    safetyStatus === 'safe'
                      ? 'bg-[#10E760]/10 border-[#10E760]/40 text-[#10E760]'
                      : safetyStatus === 'caution'
                        ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  }`}
                >
                  {safetyScore}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
                      AI Safety Evaluation
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        safetyStatus === 'safe'
                          ? 'bg-[#10E760]/15 text-[#10E760]'
                          : safetyStatus === 'caution'
                            ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                            : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {safetyStatus === 'safe' ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : safetyStatus === 'caution' ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" />
                      )}
                      {safetyStatus === 'safe'
                        ? 'Safe for Your Body'
                        : safetyStatus === 'caution'
                          ? 'Needs a Few Tweaks'
                          : 'High Strain Risk'}
                    </span>
                    {isEvaluatingSafety && (
                      <span className="text-[10px] font-mono text-zinc-500 animate-pulse">
                        • Checking updates...
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-300 font-medium">
                    {safetySummary}
                  </p>
                </div>
              </div>

              {safetyIssues.length > 0 && (
                <div className="shrink-0 self-start sm:self-center">
                  <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      {safetyIssues.length} recommendation{safetyIssues.length > 1 ? 's' : ''} below
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Plan Settings & Volume Stats */}
          <div className="rounded-2xl border border-zinc-800/80 bg-[#121722]/80 overflow-hidden shadow-sm transition-all">
            <div
              onClick={() => setShowPlanDetails((prev) => !prev)}
              className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 cursor-pointer hover:bg-zinc-800/40 select-none transition-colors"
            >
              <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono text-zinc-400 truncate">
                <span className="font-bold text-[#10E760] uppercase">{split.replace(/_/g, ' ')} Split</span>
                <span className="text-zinc-600">•</span>
                <span>{hudMetrics.totalWeeklySets} Weekly Sets</span>
                <span className="text-zinc-600">•</span>
                <span>{hudMetrics.totalExercises} Exercises</span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 shrink-0">
                <span className="hidden sm:inline">{showPlanDetails ? 'Hide Details' : 'Split & Stats'}</span>
                {showPlanDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>

            {/* Expanded Split Selector & Muscle Volume Breakdown */}
            {showPlanDetails && (
              <div className="p-3.5 sm:p-4 border-t border-zinc-800/70 space-y-3.5 bg-[#090D15]/50 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Split Architecture Preset
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['ppl', 'upper_lower', 'full_body', 'custom'] as SplitPreset[]).map((p) => {
                      const isActive = split === p;
                      const labelMap: Record<SplitPreset, string> = {
                        ppl: 'PPL',
                        upper_lower: 'Upper/Lower',
                        full_body: 'Full Body',
                        custom: 'Custom',
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSplitChange(p)}
                          className={`rounded-xl py-1.5 text-[11px] sm:text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-[#10E760] text-zinc-950 font-black shadow-sm'
                              : 'border border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {labelMap[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Muscle Volume Distribution
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(hudMetrics.muscleVolume).map(([muscle, sets]) => (
                      <Badge key={muscle} variant="lime" pill className="text-[10px] px-2 py-0.5">
                        <span className="capitalize text-zinc-200">{muscle}</span>
                        <span className="font-mono font-black text-[#10E760] ml-1">{sets}s</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Day Navigation Tabs Strip */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-2">
              {days.map((day, idx) => {
                const isActive = idx === selectedDayIndex;
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-[#10E760] text-zinc-950 shadow-md shadow-[#10E760]/20 font-black scale-[1.02]'
                        : 'border border-zinc-800/90 bg-[#121722] text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span>Day {idx + 1}</span>
                    <span className="opacity-75 font-normal text-[10px]">({day.exercises.length})</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddDay}
                className="flex items-center gap-1 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs font-bold text-zinc-400 hover:border-[#10E760] hover:text-[#10E760] transition-colors shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Day</span>
              </button>
            </div>

            {days.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveDay(selectedDayIndex)}
                className="text-zinc-500 hover:text-red-400 text-xs shrink-0 h-8 px-2"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Day
              </Button>
            )}
          </div>

          {/* Active Day Configuration Bar */}
          <div className="rounded-2xl border border-zinc-800/90 bg-[#121722] p-3.5 sm:p-4 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-[10px] font-black uppercase tracking-widest text-[#10E760] block">
                  Day {selectedDayIndex + 1} Focus
                </span>
                <input
                  type="text"
                  value={activeDay?.dayName || ''}
                  onChange={(e) => handleRenameDay(selectedDayIndex, e.target.value)}
                  placeholder="e.g. Push Day A - Chest Focus"
                  className="w-full text-base sm:text-lg font-black bg-transparent text-white border-b border-transparent focus:border-[#10E760] outline-none truncate"
                />
              </div>

              <Button
                type="button"
                variant="volt"
                size="sm"
                onClick={() => setIsCatalogOpen(true)}
                className="font-black text-xs shrink-0 shadow-md shadow-[#10E760]/20"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Exercise
              </Button>
            </div>
          </div>

          {/* Exercise List for Active Day */}
          <div className="space-y-4">
            {activeDay?.exercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-[#121722]/40 p-12 text-center">
                <div className="size-12 grid place-items-center rounded-2xl bg-zinc-900 text-zinc-500">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-white uppercase tracking-wider">
                  No Exercises Added Yet
                </h3>
                <p className="mt-1 max-w-sm text-xs text-zinc-400">
                  Select exercises from the library to configure sets, reps, target RIR, and rest intervals.
                </p>
                <Button
                  type="button"
                  variant="volt"
                  size="md"
                  onClick={() => setIsCatalogOpen(true)}
                  className="mt-4 font-black"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Browse Exercise Catalog
                </Button>
              </div>
            ) : (
              activeDay?.exercises.map((exercise, exIdx) => {
                const isExpanded = !!expandedExerciseIds[exercise.id];
                const setsCount = exercise.sets.length;
                const firstSet = exercise.sets[0];
                const repsPreview = firstSet?.targetReps ? `${firstSet.targetReps} Reps` : '8-10 Reps';
                const restPreview = firstSet?.restSeconds ? `${firstSet.restSeconds}s Rest` : '90s Rest';
                const summaryBadgeText = `${setsCount} ${setsCount === 1 ? 'Set' : 'Sets'} · ${repsPreview} · ${restPreview}`;

                return (
                  <div
                    key={exercise.id}
                    className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#121722] shadow-md transition-all"
                  >
                    {/* Exercise Card Header */}
                    <div
                      onClick={() => toggleExerciseExpand(exercise.id)}
                      className="p-3 sm:p-4 cursor-pointer select-none transition-colors hover:bg-zinc-800/20"
                    >
                      {/* Top Row: Thumbnail + Full Name + Chevron */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                          {/* Exercise Thumbnail - Bigger White Box Frame */}
                          <div
                            className="size-16 sm:size-20 rounded-xl bg-white p-1 shrink-0 border border-zinc-700/60 flex items-center justify-center overflow-hidden shadow-sm mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExerciseVisual
                              name={exercise.exerciseName}
                              masterExerciseId={exercise.exerciseId}
                              movementPattern={exercise.movementPattern}
                              muscleGroup={exercise.muscleGroups[0]}
                              compact={true}
                            />
                          </div>

                          {/* Full Title & Set Summary - Compact Typography */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-black text-[#10E760]">
                                #{exIdx + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug break-words">
                                {exercise.exerciseName}
                              </h4>
                            </div>
                            <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                              {summaryBadgeText}
                            </p>
                          </div>
                        </div>

                        {/* Expand / Collapse Chevron Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExerciseExpand(exercise.id);
                          }}
                          className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors shrink-0"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* Inline AI Safety Warning Badges with 1-Click Fix */}
                      {getIssuesForExercise(selectedDayIndex, exIdx).map((issue, issueIdx) => (
                        <div
                          key={`safety_issue_${selectedDayIndex}_${exIdx}_${issueIdx}`}
                          className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left animate-in fade-in duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[11px] font-bold text-amber-300">
                                Safety Note:
                              </span>{' '}
                              <span className="text-[11px] text-zinc-200">
                                {issue.problemText}
                              </span>
                            </div>
                          </div>

                          {issue.actionType === 'SWAP' && issue.suggestedExerciseName && (
                            <button
                              type="button"
                              onClick={() => handleApplySwap(selectedDayIndex, exIdx, issue)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#10E760] text-zinc-950 font-bold text-[11px] hover:bg-[#10E760]/90 transition-all shrink-0 self-start sm:self-auto shadow-sm"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                              <span>Switch to {issue.suggestedExerciseName}</span>
                            </button>
                          )}

                          {issue.actionType === 'REDUCE_SETS' && issue.suggestedSets !== undefined && (
                            <button
                              type="button"
                              onClick={() =>
                                handleApplyReduceSets(selectedDayIndex, exIdx, issue.suggestedSets)
                              }
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400 text-zinc-950 font-bold text-[11px] hover:bg-amber-300 transition-all shrink-0 self-start sm:self-auto shadow-sm"
                            >
                              <Sliders className="h-3 w-3" />
                              <span>Lower to {issue.suggestedSets} sets</span>
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Bottom Row: Muscle/Pattern Badges & Action Toolbar */}
                      <div
                        className="mt-2.5 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between gap-2 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Muscle & Pattern tags */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                            {formatMovementTag(exercise.movementPattern)}
                          </span>
                          {exercise.muscleGroups.map((m) => (
                            <span
                              key={m}
                              className="rounded-md bg-[#10E760]/10 border border-[#10E760]/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#10E760]"
                            >
                              {m}
                            </span>
                          ))}
                        </div>

                        {/* Action Toolbar */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Replace / Swap Button */}
                          <Tooltip content="Replace exercise with alternative or catalog movement">
                            <button
                              type="button"
                              onClick={() => handleStartReplaceExercise(exIdx, exercise)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs font-bold text-zinc-200 hover:border-[#10E760] hover:text-[#10E760] transition-all shadow-sm"
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5 text-[#10E760]" />
                              <span>Replace</span>
                            </button>
                          </Tooltip>

                          {/* Move Up */}
                          <Tooltip content="Move Up">
                            <button
                              type="button"
                              disabled={exIdx === 0}
                              onClick={() => handleMoveExercise(selectedDayIndex, exIdx, 'up')}
                              className="size-7 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                          </Tooltip>

                          {/* Move Down */}
                          <Tooltip content="Move Down">
                            <button
                              type="button"
                              disabled={exIdx === (activeDay?.exercises.length ?? 0) - 1}
                              onClick={() => handleMoveExercise(selectedDayIndex, exIdx, 'down')}
                              className="size-7 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </Tooltip>

                          {/* Delete */}
                          <Tooltip content="Remove Exercise">
                            <button
                              type="button"
                              onClick={() => handleRemoveExercise(selectedDayIndex, exIdx)}
                              className="size-7 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Sets Table (Compact, clean single-row per set) */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800/80 bg-[#090D15]/50 p-3 sm:p-4 space-y-2.5 animate-in fade-in duration-200">
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-1.5 sm:gap-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 items-center">
                          <div className="col-span-1 text-center font-mono">#</div>
                          <div className="col-span-3 sm:col-span-3">Type</div>
                          <div className="col-span-2 sm:col-span-2 text-center">Reps</div>
                          <div className="col-span-3 sm:col-span-2 text-center">
                            <Tooltip content="Reps In Reserve (Intensity): How many more reps you could do before muscle failure. E.g. 2 RIR = stop when you have 2 reps left in the tank.">
                              <span className="cursor-help inline-flex items-center gap-0.5 border-b border-dotted border-zinc-500">
                                RIR
                              </span>
                            </Tooltip>
                          </div>
                          <div className="hidden sm:block sm:col-span-2 text-center">Tempo</div>
                          <div className="col-span-2 sm:col-span-1 text-center">Rest</div>
                          <div className="col-span-1 text-right"></div>
                        </div>

                        {/* Sets Rows */}
                        <div className="space-y-1.5">
                          {exercise.sets.map((set, setIdx) => {
                            const typeConfig = SET_TYPE_CONFIG[set.setType] || SET_TYPE_CONFIG.NORMAL;

                            return (
                              <div
                                key={set.id}
                                className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center rounded-xl border border-zinc-800/80 bg-[#121722] px-2 py-1.5 hover:border-zinc-700 transition-colors"
                              >
                                {/* Set # */}
                                <div className="col-span-1 text-center font-mono text-xs font-bold text-zinc-400">
                                  {setIdx + 1}
                                </div>

                                {/* Set Type */}
                                <div className="col-span-3 sm:col-span-3">
                                  <select
                                    value={set.setType}
                                    onChange={(e) =>
                                      handleUpdateSet(
                                        selectedDayIndex,
                                        exIdx,
                                        setIdx,
                                        'setType',
                                        e.target.value as SetType,
                                      )
                                    }
                                    className={`w-full rounded-lg border px-1 py-1 text-[10px] font-bold outline-none cursor-pointer ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}
                                  >
                                    <option value="NORMAL" className="bg-[#121722] text-zinc-200">Normal</option>
                                    <option value="WARMUP" className="bg-[#121722] text-amber-400">Warmup</option>
                                    <option value="DROP" className="bg-[#121722] text-cyan-400">Drop</option>
                                    <option value="FAILURE" className="bg-[#121722] text-rose-400">Fail</option>
                                  </select>
                                </div>

                                {/* Target Reps */}
                                <div className="col-span-2 sm:col-span-2">
                                  <input
                                    type="text"
                                    value={set.targetReps}
                                    onChange={(e) =>
                                      handleUpdateSet(
                                        selectedDayIndex,
                                        exIdx,
                                        setIdx,
                                        'targetReps',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="8-10"
                                    className="w-full rounded-lg border border-zinc-800 bg-[#090D15] px-1 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                                  />
                                </div>

                                {/* Target RIR */}
                                <div className="col-span-3 sm:col-span-2">
                                  <select
                                    value={set.targetRir}
                                    onChange={(e) =>
                                      handleUpdateSet(
                                        selectedDayIndex,
                                        exIdx,
                                        setIdx,
                                        'targetRir',
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-full rounded-lg border border-zinc-800 bg-[#090D15] px-1 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760] cursor-pointer"
                                  >
                                    <option value={0}>0 RIR (Failure · 0 left)</option>
                                    <option value={1}>1 RIR (1 rep in tank)</option>
                                    <option value={2}>2 RIR (2 reps in tank)</option>
                                    <option value={3}>3 RIR (3 reps in tank)</option>
                                    <option value={4}>4 RIR (4+ reps · Easy)</option>
                                  </select>
                                </div>

                                {/* Tempo (visible on sm+) */}
                                <div className="hidden sm:block sm:col-span-2">
                                  <input
                                    type="text"
                                    value={set.tempo}
                                    onChange={(e) =>
                                      handleUpdateSet(
                                        selectedDayIndex,
                                        exIdx,
                                        setIdx,
                                        'tempo',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="3-0-1-0"
                                    className="w-full rounded-lg border border-zinc-800 bg-[#090D15] px-1 py-1 text-xs font-mono font-bold text-zinc-300 text-center outline-none focus:border-[#10E760]"
                                  />
                                </div>

                                {/* Rest (s) */}
                                <div className="col-span-2 sm:col-span-1">
                                  <input
                                    type="number"
                                    value={set.restSeconds}
                                    onChange={(e) =>
                                      handleUpdateSet(
                                        selectedDayIndex,
                                        exIdx,
                                        setIdx,
                                        'restSeconds',
                                        Number(e.target.value) || 90,
                                      )
                                    }
                                    className="w-full rounded-lg border border-zinc-800 bg-[#090D15] px-1 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                                  />
                                </div>

                                {/* Delete Set */}
                                <div className="col-span-1 flex justify-end">
                                  <button
                                    type="button"
                                    disabled={exercise.sets.length <= 1}
                                    onClick={() => handleRemoveSet(selectedDayIndex, exIdx, setIdx)}
                                    className="size-7 grid place-items-center rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-20 transition-colors"
                                    title="Delete set"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Add Set Button */}
                        <div className="pt-1 flex justify-start">
                          <button
                            type="button"
                            onClick={() => handleAddSet(selectedDayIndex, exIdx)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:border-[#10E760]/50 hover:text-[#10E760] transition-all"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Set #{exercise.sets.length + 1}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* 3. EXERCISE CATALOG PICKER DRAWER / MODAL */}
      {isCatalogOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md">
          <div className="flex h-[85vh] flex-col rounded-t-3xl border-t border-zinc-800 bg-[#090D15] p-4 sm:p-6 overflow-hidden">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="grid size-8 place-items-center rounded-xl bg-[#10E760] text-zinc-950 font-black shrink-0">
                  {replacingExercise ? <ArrowLeftRight className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white truncate">
                    {replacingExercise ? 'Replace Exercise' : `Add Exercise to Day ${selectedDayIndex + 1}`}
                  </h3>
                  {replacingExercise && (
                    <p className="text-[11px] text-zinc-400 truncate">
                      Replacing: <span className="font-bold text-[#10E760]">{replacingExercise.exercise.exerciseName}</span>
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCatalogOpen(false);
                  setReplacingExercise(null);
                }}
                className="grid size-8 place-items-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="space-y-3 py-3 shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 7,000+ movements (e.g. Bench, Incline, Squat, Lat Pulldown)..."
                  className="w-full rounded-xl border border-zinc-800 bg-[#121722] py-2.5 pl-10 pr-10 text-xs font-bold text-white placeholder-zinc-500 outline-none focus:border-[#10E760]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Muscle Filter Pills Strip with Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {MUSCLE_FILTER_OPTIONS.map((muscle) => {
                  const active = selectedMuscleFilter === muscle;
                  return (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => setSelectedMuscleFilter(muscle)}
                      className="shrink-0 transition-transform active:scale-95"
                    >
                      <Badge
                        variant={active ? 'lime' : 'dark'}
                        pill
                        className={`cursor-pointer px-3 py-1 text-xs font-bold transition-all ${
                          active
                            ? 'bg-[#10E760] text-zinc-950 font-black shadow-sm shadow-[#10E760]/20'
                            : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        {muscle}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Catalog List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {catalogLoading ? (
                <div className="grid place-items-center py-12">
                  <div className="size-8 animate-spin rounded-full border-2 border-[#10E760] border-r-transparent" />
                  <p className="mt-3 text-xs font-bold text-zinc-400">Searching movements…</p>
                </div>
              ) : catalogItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm font-bold text-zinc-300">No catalog exercises found</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Want to add &quot;{searchQuery}&quot; as a custom exercise?
                  </p>
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="volt"
                      size="sm"
                      onClick={() => handleAddCustomExercise(searchQuery)}
                      className="mt-4 font-black"
                    >
                      {replacingExercise ? (
                        <>
                          <ArrowLeftRight className="h-4 w-4 mr-1" /> Use &quot;{searchQuery}&quot;
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" /> Add &quot;{searchQuery}&quot;
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {catalogItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectCatalogItem(item)}
                      className="flex items-center justify-between gap-3.5 rounded-2xl border border-zinc-800/80 bg-[#121722] p-2.5 sm:p-3 transition-all hover:border-zinc-700 hover:bg-zinc-800/30 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* Big Clear White Frame Thumbnail */}
                        <div className="size-16 sm:size-20 rounded-xl bg-white p-1 overflow-hidden shrink-0 border border-zinc-700/60 flex items-center justify-center shadow-sm group-hover:scale-[1.02] transition-transform">
                          <ExerciseVisual
                            name={item.name}
                            masterExerciseId={item.id}
                            movementPattern={item.movementPattern}
                            muscleGroup={item.primaryMuscle}
                            compact={true}
                          />
                        </div>

                        {/* Compact Clear Text */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-bold text-white capitalize leading-tight line-clamp-2">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                            <span className="rounded bg-zinc-800/90 border border-zinc-700/60 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                              {item.primaryMuscle}
                            </span>
                            {item.movementPattern && (
                              <span className="rounded bg-[#10E760]/10 border border-[#10E760]/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-[#10E760]">
                                {formatMovementTag(item.movementPattern)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Compact Action Button */}
                      <Button
                        type="button"
                        variant={replacingExercise ? 'volt' : 'secondary'}
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCatalogItem(item);
                        }}
                        className="h-7 px-2.5 text-[10px] font-black rounded-lg shrink-0 shadow-sm"
                      >
                        {replacingExercise ? (
                          <>
                            <ArrowLeftRight className="h-3 w-3 mr-1" /> Replace
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" /> Add
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}

      {/* Advisory Non-Blocking Save Confirmation Modal */}
      {showAdvisoryConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121722] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Routine Safety Check</h3>
                <p className="text-xs text-zinc-400">
                  {safetyIssues.length} recommendation{safetyIssues.length > 1 ? 's' : ''} for your
                  joints
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">{safetySummary}</p>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {safetyIssues.map((issue, idx) => (
                <div
                  key={`modal_issue_${idx}`}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-400">{issue.exerciseName}</span>
                    <span className="text-[10px] font-mono uppercase text-zinc-500">
                      Day {issue.dayIndex + 1}
                    </span>
                  </div>
                  <p className="text-zinc-300">{issue.problemText}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAdvisoryConfirmModal(false)}
              >
                Review Fixes
              </Button>
              <Button
                type="button"
                variant="volt"
                size="sm"
                loading={isSubmitting}
                onClick={async () => {
                  setShowAdvisoryConfirmModal(false);
                  await executeSavePlan();
                }}
              >
                Keep My Choices & Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Audit Modal */}
      {isAuditModalOpen && (
        <SafetyAuditModal
          planJson={{
            days: days.map((day) => ({
              exercises: day.exercises.map((ex) => ({
                name: ex.exerciseName,
                movementPattern: ex.movementPattern,
                muscleGroup: ex.muscleGroups[0] ?? 'general',
                sets: ex.sets.filter((s) => s.setType !== 'WARMUP').length,
              })),
            })),
          }}
          onClose={() => setIsAuditModalOpen(false)}
          onSavePlan={handleSaveAndActivate}
          onPublishPlan={handlePublishPlan}
        />
      )}
    </div>
  );
}
