import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  Info,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { SafetyAuditModal } from '../components/ui/SafetyAuditModal';
import { apiClient } from '../services/api-client';
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
  const [, startTransition] = useTransition();

  const [title, setTitle] = useState('Custom Hypertrophy Blueprint');
  const [description, setDescription] = useState('Personalized high-frequency hypertrophy routine.');
  const [split, setSplit] = useState<SplitPreset>('ppl');
  const [days, setDays] = useState<PlanBuilderDay[]>(() => getInitialDaysForSplit('ppl'));
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  // Exercise Picker Drawer State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscleFilter, setSelectedMuscleFilter] = useState('All');
  const [catalogItems, setCatalogItems] = useState<CatalogExerciseItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Submission & Alert State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Expanded Exercise Details
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  // Safety Audit Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

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
      fetchCatalogExercises({
        q: searchQuery || undefined,
        primaryMuscle: selectedMuscleFilter !== 'All' ? selectedMuscleFilter.toLowerCase() : undefined,
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

  // Submit Plan to Backend
  const handleSaveAndActivate = async () => {
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

      const res = await apiClient.post<any>('workout-plans/custom', payload);
      if (res && (res.success || res.data?.id || res.planId)) {
        setToast({ message: 'Custom workout plan saved and activated!', type: 'success' });
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

    // 1. Save plan to obtain planId
    const saveRes = await apiClient.post<any>('workout-plans/custom', payload);
    const planId = saveRes?.planId || saveRes?.data?.id;
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#090D15] text-zinc-50 select-none selection:bg-[#10E760] selection:text-zinc-950">
      {/* 1. TOP HEADER & HUD BAR */}
      <header className="shrink-0 border-b border-zinc-800/80 bg-[#121722]/90 p-4 sm:px-6 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] w-full flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-[#10E760] text-zinc-950 font-black shadow-md shadow-[#10E760]/20">
                  <Sliders className="h-4 w-4 stroke-[2.5]" />
                </span>
                <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                  Interactive Plan Builder
                </h1>
              </div>
              <p className="text-xs text-zinc-400">
                Design custom training routines with precision sets, tempo, and RIR targets.
              </p>
            </div>

            {/* Top Action CTA */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsAuditModalOpen(true)}
                className="w-full sm:w-auto text-xs sm:text-sm font-bold border-[#10E760]/30 text-[#10E760] hover:bg-[#10E760]/10"
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" /> Run Safety Audit
              </Button>
              <Button
                type="button"
                variant="volt"
                size="md"
                loading={isSubmitting}
                onClick={handleSaveAndActivate}
                className="w-full sm:w-auto shadow-lg shadow-[#10E760]/20 text-xs sm:text-sm font-black"
              >
                <Save className="h-4 w-4 mr-1.5" /> Save & Activate Plan
              </Button>
            </div>
          </div>

          {/* Plan Metadata & Split Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            <div className="sm:col-span-7 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Program Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 4-Day Upper / Lower Hypertrophy Split"
                className="w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3.5 py-2 text-xs font-bold text-white placeholder-zinc-500 outline-none transition-colors focus:border-[#10E760]"
              />
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Split Architecture
              </label>
              <div className="flex rounded-xl border border-zinc-800 bg-[#090D15] p-1 gap-1">
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
                      className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold uppercase transition-all ${
                        isActive
                          ? 'bg-[#10E760] text-zinc-950 font-black shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {labelMap[p]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Volume HUD Tracker Strip */}
          <div className="flex items-center gap-3 overflow-x-auto rounded-2xl border border-zinc-800/80 bg-[#090D15]/80 p-3 scrollbar-none">
            <div className="flex items-center gap-2 border-r border-zinc-800 pr-3 shrink-0">
              <div className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-[#10E760]">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Weekly Sets</p>
                <p className="text-sm font-mono font-black text-white">{hudMetrics.totalWeeklySets} Sets</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-r border-zinc-800 pr-3 shrink-0">
              <div className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-cyan-400">
                <Dumbbell className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Exercises</p>
                <p className="text-sm font-mono font-black text-white">{hudMetrics.totalExercises} Total</p>
              </div>
            </div>

            {/* Muscle Volume Breakdown Pills */}
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto scrollbar-none">
              {Object.entries(hudMetrics.muscleVolume).map(([muscle, sets]) => (
                <div
                  key={muscle}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-800/90 bg-[#121722] px-2.5 py-1 text-xs shrink-0"
                >
                  <span className="font-semibold capitalize text-zinc-300">{muscle}:</span>
                  <span className="font-mono font-black text-[#10E760]">{sets} sets/wk</span>
                </div>
              ))}
              {Object.keys(hudMetrics.muscleVolume).length === 0 && (
                <span className="text-xs text-zinc-500 italic">Add exercises to view volume distribution</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE WITH DAY TABS & EXERCISE LIST */}
      <main className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 overscroll-contain">
        <div className="mx-auto max-w-[1600px] w-full space-y-6 pb-12">
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
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#10E760] text-zinc-950 shadow-lg shadow-[#10E760]/20 font-black scale-[1.02]'
                        : 'border border-zinc-800/90 bg-[#121722] text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span>Day {idx + 1}</span>
                    <span className="opacity-75 font-normal">({day.exercises.length} ex)</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleAddDay}
                className="flex items-center gap-1.5 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 px-3.5 py-2.5 text-xs font-bold text-zinc-400 hover:border-[#10E760] hover:text-[#10E760] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Day
              </button>
            </div>

            {/* Remove Day Button */}
            {days.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveDay(selectedDayIndex)}
                className="text-zinc-500 hover:text-red-400 text-xs shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Day
              </Button>
            )}
          </div>

          {/* Active Day Card Banner */}
          <div className="rounded-3xl border border-zinc-800/90 bg-[#121722] p-4 sm:p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 space-y-1">
                <span className="font-mono text-[11px] font-black uppercase tracking-widest text-[#10E760]">
                  Day {selectedDayIndex + 1} Configuration
                </span>
                <input
                  type="text"
                  value={activeDay?.dayName || ''}
                  onChange={(e) => handleRenameDay(selectedDayIndex, e.target.value)}
                  placeholder="e.g. Push Day A - Chest Focus"
                  className="w-full text-lg sm:text-xl font-black bg-transparent text-white border-b border-transparent focus:border-[#10E760] outline-none"
                />
              </div>

              <Button
                type="button"
                variant="volt"
                size="sm"
                onClick={() => setIsCatalogOpen(true)}
                className="font-black text-xs shrink-0"
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
                const isExpanded = expandedExerciseId === exercise.id || true; // Keep expanded by default for rapid setup
                return (
                  <div
                    key={exercise.id}
                    className="overflow-hidden rounded-3xl border border-zinc-800/90 bg-[#121722] p-4 sm:p-5 shadow-lg transition-all"
                  >
                    {/* Exercise Card Header */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-12 rounded-2xl bg-zinc-900/80 p-1 overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center">
                          <ExerciseVisual
                            name={exercise.exerciseName}
                            masterExerciseId={exercise.exerciseId}
                            movementPattern={exercise.movementPattern}
                            muscleGroup={exercise.muscleGroups[0]}
                            compact={true}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#10E760]">
                              #{exIdx + 1}
                            </span>
                            <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                              {exercise.exerciseName}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                              {exercise.movementPattern}
                            </span>
                            {exercise.muscleGroups.map((m) => (
                              <span
                                key={m}
                                className="rounded bg-[#10E760]/10 border border-[#10E760]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#10E760]"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Reorder & Action Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={exIdx === 0}
                          onClick={() => handleMoveExercise(selectedDayIndex, exIdx, 'up')}
                          className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={exIdx === (activeDay?.exercises.length ?? 0) - 1}
                          onClick={() => handleMoveExercise(selectedDayIndex, exIdx, 'down')}
                          className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveExercise(selectedDayIndex, exIdx)}
                          className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 ml-1"
                          title="Remove Exercise"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive Set Table */}
                    <div className="mt-4 space-y-3">
                      <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2">
                        <div className="col-span-1 text-center">Set</div>
                        <div className="col-span-3">Type</div>
                        <div className="col-span-2">Target Reps</div>
                        <div className="col-span-2">Reps in Tank</div>
                        <div className="col-span-2">Lifting Speed</div>
                        <div className="col-span-1">Rest</div>
                        <div className="col-span-1 text-right"></div>
                      </div>

                      {exercise.sets.map((set, setIdx) => {
                        const typeConfig = SET_TYPE_CONFIG[set.setType] || SET_TYPE_CONFIG.NORMAL;
                        return (
                          <div
                            key={set.id}
                            className="flex flex-col sm:grid sm:grid-cols-12 gap-2.5 sm:gap-2 items-start sm:items-center rounded-2xl border border-zinc-800/80 bg-[#090D15]/80 p-3 sm:p-2"
                          >
                            {/* Set # */}
                            <div className="flex items-center justify-between sm:justify-center w-full sm:w-auto sm:col-span-1">
                              <span className="font-mono text-xs font-black text-white">
                                {setIdx + 1}
                              </span>
                              <span className="sm:hidden text-[10px] font-bold text-zinc-500 uppercase">
                                Set #{setIdx + 1}
                              </span>
                            </div>

                            {/* Set Type Pills Selector */}
                            <div className="w-full sm:col-span-3 flex gap-1">
                              {(['NORMAL', 'WARMUP', 'DROP', 'FAILURE'] as SetType[]).map((t) => {
                                const isCurrent = set.setType === t;
                                const cfg = SET_TYPE_CONFIG[t];
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateSet(selectedDayIndex, exIdx, setIdx, 'setType', t)
                                    }
                                    className={`flex-1 rounded-lg py-1 px-1.5 text-[10px] font-black uppercase transition-all border ${
                                      isCurrent
                                        ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm`
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                                    }`}
                                  >
                                    {cfg.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Target Reps */}
                            <div className="w-full sm:col-span-2 space-y-1 sm:space-y-0">
                              <span className="sm:hidden text-[10px] font-bold text-zinc-500 uppercase">
                                Reps:
                              </span>
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
                                className="w-full rounded-xl border border-zinc-800 bg-[#121722] px-2.5 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                              />
                            </div>

                            {/* Reps in Tank Picker */}
                            <div className="w-full sm:col-span-2 space-y-1 sm:space-y-0">
                              <span className="sm:hidden text-[10px] font-bold text-zinc-500 uppercase">
                                Reps in Tank:
                              </span>
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
                                className="w-full rounded-xl border border-zinc-800 bg-[#121722] px-2 py-1 text-xs font-mono font-bold text-white outline-none focus:border-[#10E760]"
                              >
                                <option value={0}>0 in tank (Failure / Max)</option>
                                <option value={1}>1 rep left in tank</option>
                                <option value={2}>2 reps left in tank</option>
                                <option value={3}>3 reps left in tank</option>
                                <option value={4}>4 reps left in tank</option>
                              </select>
                            </div>

                            {/* Tempo */}
                            <div className="w-full sm:col-span-2 space-y-1 sm:space-y-0">
                              <span className="sm:hidden text-[10px] font-bold text-zinc-500 uppercase">
                                Tempo:
                              </span>
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
                                className="w-full rounded-xl border border-zinc-800 bg-[#121722] px-2.5 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                              />
                            </div>

                            {/* Rest Seconds */}
                            <div className="w-full sm:col-span-1 space-y-1 sm:space-y-0">
                              <span className="sm:hidden text-[10px] font-bold text-zinc-500 uppercase">
                                Rest (s):
                              </span>
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
                                className="w-full rounded-xl border border-zinc-800 bg-[#121722] px-1.5 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                              />
                            </div>

                            {/* Delete Set */}
                            <div className="w-full sm:col-span-1 flex justify-end">
                              <button
                                type="button"
                                disabled={exercise.sets.length <= 1}
                                onClick={() => handleRemoveSet(selectedDayIndex, exIdx, setIdx)}
                                className="size-7 grid place-items-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-zinc-900 disabled:opacity-20"
                                title="Remove Set"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Add Set Button */}
                      <button
                        type="button"
                        onClick={() => handleAddSet(selectedDayIndex, exIdx)}
                        className="w-full py-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 text-xs font-bold text-zinc-400 hover:border-[#10E760]/50 hover:text-[#10E760] hover:bg-zinc-900 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Set #{exercise.sets.length + 1}
                      </button>
                    </div>
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
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-[#10E760] text-zinc-950 font-black">
                  <Dumbbell className="h-4 w-4" />
                </span>
                <h3 className="text-base font-black uppercase tracking-tight text-white">
                  Add Exercise to Day {selectedDayIndex + 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
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

              {/* Muscle Filter Pills Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {MUSCLE_FILTER_OPTIONS.map((muscle) => {
                  const active = selectedMuscleFilter === muscle;
                  return (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => setSelectedMuscleFilter(muscle)}
                      className={`rounded-xl px-3 py-1 text-xs font-bold transition-all shrink-0 ${
                        active
                          ? 'bg-[#10E760] text-zinc-950 font-black shadow-sm'
                          : 'border border-zinc-800 bg-[#121722] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {muscle}
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
                      <Plus className="h-4 w-4 mr-1" /> Add &quot;{searchQuery}&quot;
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {catalogItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/90 bg-[#121722] p-3 transition-all hover:border-zinc-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-12 rounded-xl bg-zinc-900/80 p-1 overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center">
                          <ExerciseVisual
                            name={item.name}
                            masterExerciseId={item.id}
                            movementPattern={item.movementPattern}
                            muscleGroup={item.primaryMuscle}
                            compact={true}
                          />
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate capitalize">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1 pt-0.5">
                            <span className="text-[10px] font-mono text-zinc-400 capitalize">
                              {item.primaryMuscle}
                            </span>
                            <span className="text-[10px] text-zinc-600">•</span>
                            <span className="text-[10px] font-mono text-[#10E760] capitalize">
                              {item.movementPattern}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => handleAddExerciseFromCatalog(item)}
                        className="font-bold text-xs shrink-0 hover:bg-[#10E760] hover:text-zinc-950"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
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
