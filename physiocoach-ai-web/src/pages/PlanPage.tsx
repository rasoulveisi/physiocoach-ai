import { useCallback, useEffect, useState, useRef, type TouchEvent } from 'react';
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Globe,
  GitFork,
  Info,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { ExercisePreviewModal, type ExercisePreviewItem } from '../components/ui/ExercisePreviewModal';
import { PlanSkeleton } from '../components/ui/Skeleton';
import { resolveExerciseSafetyNotes } from '../services/exercise-safety-notes';
import { apiClient } from '../services/api-client';
import { usePreferences } from '../context/PreferencesContext';
import { calculateProgressiveOverload } from '../services/progressive-overload';

export interface WorkoutExerciseView {
  id?: string;
  masterExerciseId?: string | null;
  name: string;
  muscleGroup?: string;
  movementPattern?: string;
  sets: number;
  reps: string | number;
  rpe?: number | null;
  restSeconds?: number;
  notes?: string | null;
  safetyLevel?: string;
}

export interface WorkoutDayView {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: WorkoutExerciseView[];
}

export interface PlanProgressionView {
  baselineIntensity?: string;
  progressionRule?: string;
  increasePercent?: number;
  conditions?: string[];
}

export interface WorkoutPlanView {
  id: string;
  source: 'ai' | 'fallback' | 'repaired';
  model: string;
  createdAt: string;
  cached?: boolean;
  inputHash?: string;
  rating?: number;
  reviewsCount?: number;
  forkedFrom?: {
    planId: string;
    authorName: string;
    planTitle?: string;
  };
  plan: {
    name?: string;
    description?: string;
    scheduleType?: string;
    summary?: string;
    progression?: PlanProgressionView;
    safetyNotes?: string[];
    days: WorkoutDayView[];
  };
}

export interface UserSavedPlanItem {
  id: string;
  title: string;
  description: string;
  split: string;
  frequencyDays: number;
  status: string;
  isPublished: boolean;
  totalSets: number;
  createdAt: string;
  dayCount: number;
  exerciseCount: number;
  primaryExercise?: {
    name: string;
    masterExerciseId?: string;
    movementPattern?: string;
    muscleGroup?: string;
  };
}

export function PlanPage() {
  const { unitSystem } = usePreferences();
  const [planView, setPlanView] = useState<WorkoutPlanView | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [expandedFormCues, setExpandedFormCues] = useState<Record<string, boolean>>({});
  const [previewExercise, setPreviewExercise] = useState<ExercisePreviewItem | null>(null);

  // Star Rating & Review State
  const [ratingVal, setRatingVal] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [planRatingStats, setPlanRatingStats] = useState<{ rating: number; reviewsCount: number }>({
    rating: 5.0,
    reviewsCount: 0,
  });

  // Multi-Plan Library States
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [myPlans, setMyPlans] = useState<UserSavedPlanItem[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);
  const [publishingPlanId, setPublishingPlanId] = useState<string | null>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const navigate = useNavigate();

  const fetchCurrentPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<any>('workout-plans/current');
      const payload = res?.data || res;
      if (payload && payload.plan && Array.isArray(payload.plan.days)) {
        setPlanView(payload);
        if (typeof payload.rating === 'number') {
          setPlanRatingStats({
            rating: payload.rating,
            reviewsCount: payload.reviewsCount ?? 0,
          });
        }
        const storedFeedback = localStorage.getItem(`plan_feedback_${payload.id}`);
        if (storedFeedback) setFeedback(storedFeedback);
      } else {
        setPlanView(null);
      }
    } catch (cause) {
      console.warn('Could not fetch active plan:', cause);
      setPlanView(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyPlans = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const res = await apiClient.get<any>('workout-plans/my-plans');
      const payload = res?.data || (Array.isArray(res) ? res : []);
      setMyPlans(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.warn('Could not fetch user plans library:', err);
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  const handleActivatePlan = async (planId: string, title?: string) => {
    setActivatingPlanId(planId);
    try {
      const res = await apiClient.post<any>(`workout-plans/${planId}/activate`);
      const payload = res?.data || res;
      if (payload && payload.plan) {
        setPlanView(payload);
        setSelectedDay(0);
      } else {
        await fetchCurrentPlan();
      }
      setToast({
        message: `Switched active routine to "${title || 'Selected Plan'}"!`,
        type: 'success',
      });
      setLibraryOpen(false);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Could not activate plan.',
        type: 'error',
      });
    } finally {
      setActivatingPlanId(null);
    }
  };

  const handlePublishPlan = async (planId: string, title?: string) => {
    setPublishingPlanId(planId);
    try {
      await apiClient.post<any>(`workout-plans/${planId}/publish`);
      setToast({
        message: `Plan "${title || 'Routine'}" published to Explore Hub!`,
        type: 'success',
      });
      await fetchMyPlans();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Could not publish plan to Explore.',
        type: 'error',
      });
    } finally {
      setPublishingPlanId(null);
    }
  };

  const handleRatePlan = async () => {
    if (!planView) return;
    setIsSubmittingRating(true);
    try {
      const res = await apiClient.post<any>(`workout-plans/${planView.id}/rate`, {
        rating: ratingVal,
        review: reviewNote.trim() || undefined,
      });
      const data = res?.data || res;
      if (data?.rating) {
        setPlanRatingStats({
          rating: data.rating,
          reviewsCount: data.reviewsCount ?? (planRatingStats.reviewsCount + 1),
        });
      }
      setToast({
        message: `Thanks! You rated this routine ${ratingVal} stars ⭐`,
        type: 'success',
      });
      setReviewNote('');
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Could not submit rating.',
        type: 'error',
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDeleteSavedPlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this plan from your library?')) return;
    try {
      await apiClient.delete(`workout-plans/${planId}`);
      setToast({ message: 'Plan removed from library.', type: 'info' });
      await fetchMyPlans();
      if (planView?.id === planId) {
        await fetchCurrentPlan();
      }
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Could not delete plan.',
        type: 'error',
      });
    }
  };

  useEffect(() => {
    fetchCurrentPlan();
  }, [fetchCurrentPlan]);

  const generateNewPlan = async () => {
    setGenerating(true);
    setError('');
    try {
      const assessmentRes = await apiClient.get<any>('assessments/latest');
      const assessment = assessmentRes?.data || null;

      const profileRes = await apiClient.get<any>('profile');
      const profile = profileRes?.data || null;

      const res = await apiClient.post<any>('workout-plans/generate', {
        profile: {
          age: profile?.age || 30,
          sex: profile?.sex || 'prefer_not_to_say',
          heightCm: profile?.heightCm || 178,
          weightKg: profile?.weightKg || 75,
          lifestyle: profile?.lifestyle || 'active',
          experienceLevel: profile?.experienceLevel || 'intermediate',
        },
        assessment: {
          archetype: assessment?.archetype || 'powerbuilding_hypertrophy',
          frequencyDays: assessment?.frequencyDays || 4,
          sessionMinutes: assessment?.sessionMinutes || 60,
          availableEquipment: assessment?.availableEquipment || profile?.availableEquipment || [
            'barbell',
            'dumbbells',
            'bench',
            'cable_machine',
          ],
          limitations: assessment?.limitations || [],
          postureFlags: assessment?.postureFlags || [],
          goals: assessment?.goals || ['muscle_gain', 'strength', 'posture_improvement'],
        },
      });

      const payload = res?.data || res;
      if (payload && payload.plan && Array.isArray(payload.plan.days)) {
        setPlanView(payload);
        setSelectedDay(0);
        setToast({ message: 'Personalized AI workout plan generated.', type: 'success' });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate workout plan.');
    } finally {
      setGenerating(false);
    }
  };

  const deletePlan = async () => {
    if (!planView) return;
    if (!window.confirm('Delete this active workout plan? You can synthesize a new one immediately.')) return;
    try {
      await apiClient.delete(`workout-plans/${planView.id}`);
      setPlanView(null);
      setToast({ message: 'Workout plan deleted.', type: 'info' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete plan.');
    }
  };

  const handleSaveFeedback = (type: string) => {
    if (!planView) return;
    setFeedback(type);
    localStorage.setItem(`plan_feedback_${planView.id}`, type);
    setToast({ message: 'Feedback recorded.', type: 'success' });
  };

  const toggleCue = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFormCues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Direction-Locked Touch Gesture Handler
  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - endX;
    const deltaY = touchStartY.current - endY;

    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.8) {
      const daysCount = planView?.plan?.days?.length ?? 0;
      if (daysCount > 0) {
        if (deltaX > 0 && selectedDay < daysCount - 1) {
          setSelectedDay((prev) => prev + 1);
        } else if (deltaX < 0 && selectedDay > 0) {
          setSelectedDay((prev) => prev - 1);
        }
      }
    }
  };

  if (loading) {
    return <PlanSkeleton />;
  }

  if (error) {
    return (
      <div className="flex h-full w-full overflow-hidden bg-zinc-950 px-4 py-6 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1600px] mx-auto">
          <Card className="mt-10 border-zinc-800 bg-zinc-900">
            <CardContent className="py-16 text-center">
              <h2 className="text-2xl font-black text-white">Error Loading Plan</h2>
              <p className="mt-2 text-sm text-zinc-400">{error}</p>
              <Button onClick={fetchCurrentPlan} variant="volt" size="md" className="mt-6">
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const days = planView?.plan?.days || [];
  const daysCount = days.length;
  const currentDay = days[selectedDay] || days[0];

  return (
    <div
      className="flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-8 overscroll-contain">
        {daysCount > 0 ? (
          <>
            {/* Schedule Top Header & Action Controls */}
            <section className="space-y-4 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      {planView?.plan.name || 'Workout Schedule'}
                    </h1>
                    {planView?.forkedFrom && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                        <GitFork className="h-3 w-3" /> Forked from {planView.forkedFrom.planTitle || planView.forkedFrom.authorName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {planView?.plan.description || 'Weekly Biomechanical Training Split'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setLibraryOpen(true);
                      fetchMyPlans();
                    }}
                    title="My Plans Library (Switch Active Routine)"
                    className="h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200 hover:border-lime-400 hover:text-lime-400 shadow-sm"
                  >
                    <Layers className="h-3.5 w-3.5 mr-1 text-[#10E760]" />
                    My Library
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/plans/builder')}
                    title="Create Custom Plan"
                    className="h-9 px-3 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-300 hover:border-lime-400 hover:text-lime-400"
                  >
                    <Sliders className="h-3.5 w-3.5 mr-1" />
                    Builder
                  </Button>

                  {planView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      loading={publishingPlanId === planView.id}
                      onClick={() => handlePublishPlan(planView.id, planView.plan.name)}
                      title="Publish to Explore Community Hub"
                      className="size-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-cyan-400 hover:text-cyan-400"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={generateNewPlan}
                    loading={generating}
                    title="Regenerate Plan"
                    className="size-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={deletePlan}
                    title="Delete Plan"
                    className="size-9 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Day Selection Strip */}
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {days.map((day, idx) => {
                  const isActive = idx === selectedDay;
                  return (
                    <button
                      key={day.dayNumber}
                      type="button"
                      onClick={() => setSelectedDay(idx)}
                      className={`flex min-w-[84px] sm:min-w-[100px] flex-1 flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-200 ${
                        isActive
                          ? 'bg-lime-400 text-zinc-950 font-black shadow-lg shadow-lime-400/20 scale-[1.02]'
                          : 'bg-zinc-900 border border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-white'
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-zinc-950/70' : 'text-zinc-500'}`}>
                        Day {day.dayNumber}
                      </span>
                      <span className="mt-0.5 text-base sm:text-lg font-black tabular-nums truncate max-w-full">
                        {day.name.replace(/day\s*\d+:\s*/i, '').split(' ')[0] || `D${day.dayNumber}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Balanced 2-Column Desktop Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column (8 cols): Day Exercises List */}
              <div className="lg:col-span-8 space-y-6">
                {/* Horizontal Day Carousel Track */}
                <div className="overflow-hidden w-full">
                  <div
                    className="flex transition-transform duration-300 ease-out w-full"
                    style={{ transform: `translateX(-${selectedDay * 100}%)` }}
                  >
                    {days.map((day, dayIndex) => {
                      const dayExercises = day.exercises || [];
                      const totalExercises = dayExercises.length;
                      const totalSets = dayExercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);

                      const totalRestSeconds = dayExercises.reduce((sum, ex) => sum + (ex.sets || 3) * (ex.restSeconds || 60), 0);
                      const totalWorkSeconds = dayExercises.reduce((sum, ex) => sum + (ex.sets || 3) * 45, 0);
                      const transitionSeconds = dayExercises.length * 90;
                      const warmupSeconds = 300;
                      const estMinutes = Math.round((totalRestSeconds + totalWorkSeconds + transitionSeconds + warmupSeconds) / 60) || 50;

                      const targetMuscles = Array.from(
                        new Set(dayExercises.map((ex) => ex.muscleGroup || ex.movementPattern).filter(Boolean)),
                      );

                      return (
                        <div key={day.dayNumber} className="w-full shrink-0 space-y-6 px-0.5">
                          {/* Hero Workout Banner */}
                          <section className="relative overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-900 p-5 shadow-xl sm:p-6">
                            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-400/10 blur-3xl" />

                            <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-lime-400 animate-pulse" />
                                  <p className="font-mono text-[11px] font-black uppercase tracking-widest text-lime-400">
                                    Day {day.dayNumber} · Focus Target
                                  </p>
                                </div>

                                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                  {day.name || day.focus || 'Workout Session'}
                                </h2>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <span className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
                                    <Timer className="h-3.5 w-3.5 text-lime-400" /> {estMinutes} MIN
                                  </span>

                                  {targetMuscles.slice(0, 4).map((muscle) => (
                                    <span
                                      key={muscle}
                                      className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-zinc-950"
                                    >
                                      {muscle}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </section>

                          {/* List of Exercises */}
                          <section className="space-y-3">
                            <div className="flex items-center justify-between pt-1">
                              <div>
                                <h3 className="text-lg font-black text-white">List of Exercises</h3>
                                <p className="text-xs text-zinc-400">
                                  {totalExercises} Exercises · {totalSets} Total Sets
                                </p>
                              </div>
                              <span className="font-mono text-[11px] font-bold text-zinc-500">Tap to inspect form</span>
                            </div>

                            <div className="space-y-3">
                              {dayExercises.map((exercise, index) => {
                                const safetyNotes = resolveExerciseSafetyNotes(exercise.name).tips || [];
                                const cueKey = `${dayIndex}-${index}`;
                                const isCueExpanded = !!expandedFormCues[cueKey];

                                return (
                                  <div
                                    key={exercise.id || `${exercise.name}-${index}`}
                                    onClick={() =>
                                      setPreviewExercise({
                                        id: exercise.masterExerciseId || exercise.id || '',
                                        masterExerciseId: exercise.masterExerciseId,
                                        name: exercise.name,
                                        movementPattern: exercise.movementPattern,
                                        muscleGroup: exercise.muscleGroup,
                                      })
                                    }
                                    className="group relative cursor-pointer overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900 p-3.5 transition-all hover:border-zinc-700 hover:bg-zinc-900/80 active:scale-[0.99] sm:p-4"
                                  >
                                    <div className="flex items-center gap-3.5 sm:gap-4">
                                      {/* Thumbnail */}
                                      <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 flex items-center justify-center p-1 shadow-sm">
                                        <ExerciseVisual
                                          name={exercise.name}
                                          masterExerciseId={exercise.masterExerciseId || exercise.id}
                                          movementPattern={exercise.movementPattern}
                                          muscleGroup={exercise.muscleGroup}
                                          compact={true}
                                        />
                                      </div>

                                      {/* Info */}
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <h4 className="truncate text-sm font-bold text-zinc-100 transition-colors group-hover:text-lime-400 sm:text-base capitalize">
                                          {exercise.name}
                                        </h4>

                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                          <span className="font-mono font-black text-lime-400">
                                            {exercise.sets} Sets × {exercise.reps} Reps
                                          </span>
                                          {exercise.rpe && (
                                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                                              Effort: {exercise.rpe}/10
                                            </span>
                                          )}
                                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                            {exercise.restSeconds || 60}s Rest
                                          </span>
                                        </div>

                                        {exercise.notes && (
                                          <p className="text-[11px] text-zinc-400 line-clamp-1 italic">
                                            {exercise.notes}
                                          </p>
                                        )}
                                      </div>

                    <div className="flex shrink-0 items-center">
                                        <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-lime-400 transition-colors" />
                                      </div>
                                    </div>

                                    {/* Progressive Overload Recommendation Chip */}
                                    {(() => {
                                      const overloadRec = calculateProgressiveOverload({
                                        exerciseName: exercise.name,
                                        currentWeightKg: 20,
                                        currentReps: typeof exercise.reps === 'number' ? exercise.reps : Number(exercise.reps) || 10,
                                        targetReps: exercise.reps,
                                        previousPerformance: {
                                          weight: 20,
                                          reps: typeof exercise.reps === 'number' ? exercise.reps : Number(exercise.reps) || 10,
                                          rpe: exercise.rpe || 7.5,
                                        },
                                        unitSystem,
                                      });

                                      return (
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 text-xs">
                                          <span
                                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                              overloadRec.badgeVariant === 'lime'
                                                ? 'bg-lime-400/15 text-lime-300 border border-lime-400/30'
                                                : 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                                            }`}
                                            title={overloadRec.reason}
                                          >
                                            <Zap className="h-3 w-3" />
                                            {overloadRec.chipLabel}
                                          </span>

                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="volt"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate('/session');
                                            }}
                                            className="h-6 text-[10px] font-black px-2 rounded-md shrink-0"
                                          >
                                            Apply & Train
                                          </Button>
                                        </div>
                                      );
                                    })()}

                                    {/* Expandable Posture & Safety Cues */}
                                    {safetyNotes.length > 0 && (
                                      <div className="mt-3 border-t border-zinc-800/80 pt-2.5">
                                        <button
                                          type="button"
                                          onClick={(e) => toggleCue(cueKey, e)}
                                          className="flex items-center gap-1.5 text-[11px] font-bold text-lime-400 hover:text-lime-300"
                                        >
                                          <ShieldCheck className="h-3.5 w-3.5" />
                                          <span>Biomechanical Form Safeguards</span>
                                          {isCueExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                        </button>

                                        {isCueExpanded && (
                                          <ul className="mt-2 space-y-1 rounded-xl bg-zinc-950 p-2.5 text-[11px] text-zinc-300">
                                            {safetyNotes.map((note, nIdx) => (
                                              <li key={nIdx} className="flex items-start gap-1.5">
                                                <span className="text-lime-400 font-bold">•</span>
                                                <span>{note}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column (4 cols): Star Ratings, Progression, Safeguards & Action */}
              <div className="lg:col-span-4 space-y-6">
                {/* 1. Real Interactive Star Rating & Reviews Widget */}
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        Community Rating & Feedback
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Rate this workout routine (1-5 stars)
                      </p>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-lg font-black text-amber-300">
                        {planRatingStats.reviewsCount === 0 ? '5.0' : planRatingStats.rating.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block">
                        {planRatingStats.reviewsCount === 0
                          ? '(New)'
                          : `(${planRatingStats.reviewsCount} ${planRatingStats.reviewsCount === 1 ? 'review' : 'reviews'})`}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Star Buttons */}
                  <div className="flex items-center justify-center gap-2 py-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (hoverRating ?? ratingVal) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(null)}
                          onClick={() => setRatingVal(star)}
                          className="p-1 transition-transform hover:scale-125 focus:outline-none"
                          title={`Rate ${star} star${star === 1 ? '' : 's'}`}
                        >
                          <Star
                            className={`size-7 transition-colors ${
                              active
                                ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                : 'text-zinc-700 hover:text-zinc-500'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Optional Review Input Note */}
                  <div className="space-y-2">
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Optional feedback: joint feel, recovery, effectiveness..."
                      rows={2}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-400 transition-colors"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={isSubmittingRating}
                      onClick={handleRatePlan}
                      className="w-full text-xs font-bold border-zinc-700 hover:border-amber-400 hover:text-amber-400"
                    >
                      Submit Rating ({ratingVal} ⭐)
                    </Button>
                  </div>
                </div>

                {/* 2. Plan Progression & Safeguard Details */}
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg space-y-4">
                  <div className="flex items-center gap-2 text-sm font-black text-white">
                    <BrainCircuit className="h-4 w-4 text-lime-400" />
                    <span>AI Overload & Safeguards</span>
                  </div>

                  {planView?.plan?.summary && (
                    <p className="text-xs leading-relaxed text-zinc-400">{planView.plan.summary}</p>
                  )}

                  {planView?.plan?.progression && (
                    <div className="space-y-1 rounded-2xl bg-zinc-950 p-3 border border-zinc-800/80 text-xs">
                      <span className="font-bold text-white text-[11px] uppercase tracking-wider text-lime-400">
                        Overload Rule
                      </span>
                      <p className="text-zinc-300 text-xs mt-0.5">
                        {planView.plan.progression.progressionRule || 'Standard progressive overload (+5–10% volume on pain-free lifts)'}
                      </p>
                    </div>
                  )}

                  {planView?.plan?.safetyNotes && planView.plan.safetyNotes.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-white">Posture Safeguards:</span>
                      <ul className="space-y-1 text-xs text-zinc-400 pl-1">
                        {planView.plan.safetyNotes.map((note, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-lime-400 font-bold">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Plan Feedback */}
                  <div className="border-t border-zinc-800 pt-4">
                    <span className="text-xs font-bold text-zinc-400">How does this split feel?</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {['Optimal Balance', 'A Bit Heavy', 'Need More Rest', 'Perfect Pace'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSaveFeedback(opt)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                            feedback === opt
                              ? 'border-lime-400 bg-lime-400/10 text-lime-400'
                              : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {feedback === opt && <CheckCircle2 className="h-3.5 w-3.5 text-lime-400" />}
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Quick Action Card */}
                <div className="rounded-3xl border border-lime-400/30 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-xl space-y-3 text-center">
                  <h4 className="text-sm font-black text-white">Ready for Day {currentDay?.dayNumber || selectedDay + 1}?</h4>
                  <p className="text-xs text-zinc-400">
                    Live set logging, rest timer audio cues, and plate calculations.
                  </p>
                  <Button
                    type="button"
                    variant="volt"
                    size="lg"
                    pill={true}
                    onClick={() => navigate('/session')}
                    className="w-full text-base font-black shadow-lg shadow-lime-400/20"
                  >
                    <Play className="h-4 w-4 mr-2 fill-current" /> Start Session Now
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          !loading &&
          !error && (
            <Card className="mt-10 border-zinc-800 bg-zinc-900">
              <CardContent className="py-20 text-center">
                <RefreshCw className="mx-auto h-12 w-12 animate-pulse text-zinc-600" />
                <h2 className="mt-4 text-2xl font-black text-white">No active workout plan</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Generate an intelligent, posture-aware training plan tailored to your profile.
                </p>
                <Button onClick={generateNewPlan} loading={generating} variant="volt" size="md" className="mt-6">
                  <BrainCircuit className="h-4 w-4" /> Generate Plan Now
                </Button>
              </CardContent>
            </Card>
          )
        )}
      </main>

      {/* Full-Size Exercise Preview Modal */}
      <ExercisePreviewModal
        open={!!previewExercise}
        exercise={previewExercise}
        onClose={() => setPreviewExercise(null)}
      />

      {/* 4. MY PLANS LIBRARY SWITCHER MODAL */}
      {libraryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setLibraryOpen(false)}
        >
          <div
            className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl border border-zinc-800 bg-[#0E131F] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 bg-zinc-950/70">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-xl bg-lime-400/20 text-[#10E760]">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">My Plans Library</h3>
                  <p className="text-xs text-zinc-400">
                    {myPlans.length} Saved {myPlans.length === 1 ? 'Routine' : 'Routines'} · 1 Active
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="size-8 rounded-full border border-zinc-800 bg-zinc-900 grid place-items-center text-zinc-400 hover:text-white hover:border-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body: List of Plans */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 overscroll-contain">
              {loadingLibrary ? (
                <div className="py-12 text-center text-xs font-mono text-zinc-400 animate-pulse">
                  Loading your saved routines...
                </div>
              ) : myPlans.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-xs text-zinc-400">No saved routines found in your account.</p>
                  <Button
                    variant="volt"
                    size="sm"
                    onClick={() => {
                      setLibraryOpen(false);
                      navigate('/explore');
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" /> Explore Community Plans
                  </Button>
                </div>
              ) : (
                myPlans.map((plan) => {
                  const isActive = plan.status === 'active' || (planView && planView.id === plan.id);
                  const isActivating = activatingPlanId === plan.id;
                  const isPublishing = publishingPlanId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                        isActive
                          ? 'border-[#10E760]/60 bg-[#14201A] shadow-md shadow-[#10E760]/5'
                          : 'border-zinc-800/80 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Exercise Visual Thumbnail */}
                        <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 flex items-center justify-center p-1">
                          <ExerciseVisual
                            name={plan.primaryExercise?.name || plan.title}
                            masterExerciseId={plan.primaryExercise?.masterExerciseId}
                            movementPattern={plan.primaryExercise?.movementPattern}
                            muscleGroup={plan.primaryExercise?.muscleGroup}
                            compact={true}
                          />
                        </div>

                        {/* Plan Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="truncate text-sm font-black text-white">{plan.title}</h4>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#10E760]/20 text-[#10E760] border border-[#10E760]/40">
                                <Check className="h-3 w-3" /> Active
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-zinc-400 line-clamp-1">{plan.description}</p>

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                            <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-300">
                              {plan.frequencyDays} Days/Wk
                            </span>
                            <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-lime-400 font-bold">
                              {plan.totalSets} Sets
                            </span>
                            <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-zinc-400 capitalize">
                              {plan.split.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Row */}
                      <div className="mt-3.5 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs">
                        <div className="flex items-center gap-2">
                          {plan.isPublished ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                              <Globe className="h-3 w-3" /> Shared on Explore
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              loading={isPublishing}
                              onClick={() => handlePublishPlan(plan.id, plan.title)}
                              className="h-7 px-2 text-[11px] font-bold text-zinc-400 hover:text-cyan-400 hover:border-cyan-400"
                            >
                              <Share2 className="h-3 w-3 mr-1" /> Publish to Explore
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteSavedPlan(plan.id, e)}
                            title="Delete routine from library"
                            className="h-7 px-2 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>

                          {!isActive && (
                            <Button
                              type="button"
                              variant="volt"
                              size="sm"
                              loading={isActivating}
                              onClick={() => handleActivatePlan(plan.id, plan.title)}
                              className="h-7 px-3 text-xs font-black shadow-sm"
                            >
                              <Zap className="h-3 w-3 mr-1" /> Set as Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Quick Shortcuts */}
            <div className="flex items-center justify-between gap-3 border-t border-zinc-800/80 p-3.5 sm:p-4 bg-zinc-950/90 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLibraryOpen(false);
                  navigate('/explore');
                }}
                className="text-xs font-bold text-zinc-300 hover:text-white"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-[#10E760]" /> Browse Explore Hub
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLibraryOpen(false);
                  navigate('/plans/builder');
                }}
                className="text-xs font-bold border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Custom Routine
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}
