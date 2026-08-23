import { useCallback, useEffect, useState, useRef, type TouchEvent } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
  CheckCircle2,
  Info,
  ChevronRight,
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
  plan: {
    schemaVersion: string;
    source?: string;
    days: WorkoutDayView[];
    progression?: PlanProgressionView;
    safetyNotes?: string[];
    warnings?: string[];
  };
  warnings?: string[];
}

function normalizeWorkoutPlanView(payload: unknown): WorkoutPlanView | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = (payload as { data?: unknown }).data ?? payload;
  if (!root || typeof root !== 'object') return null;

  const record = root as Record<string, unknown>;
  const rawPlan = (record['plan'] && typeof record['plan'] === 'object' ? record['plan'] : record) as Record<string, unknown>;
  const rawDays = Array.isArray(rawPlan['days']) ? rawPlan['days'] : Array.isArray(record['days']) ? record['days'] : [];

  const days: WorkoutDayView[] = rawDays.map((d: any, idx: number) => {
    const rawExercises = Array.isArray(d?.exercises) ? d.exercises : [];
    const exercises: WorkoutExerciseView[] = rawExercises.map((ex: any) => ({
      id: ex?.id ? String(ex.id) : undefined,
      masterExerciseId: ex?.masterExerciseId ? String(ex.masterExerciseId) : ex?.id ? String(ex.id) : null,
      name: String(ex?.name || 'Exercise'),
      muscleGroup: ex?.muscleGroup ? String(ex.muscleGroup) : undefined,
      movementPattern: ex?.movementPattern ? String(ex.movementPattern) : undefined,
      sets: typeof ex?.sets === 'number' ? ex.sets : 3,
      reps: ex?.reps !== undefined ? String(ex.reps) : '8-12',
      rpe: typeof ex?.rpe === 'number' ? ex.rpe : null,
      restSeconds: typeof ex?.restSeconds === 'number' ? ex.restSeconds : 90,
      notes: ex?.notes ? String(ex.notes) : null,
      safetyLevel: ex?.safetyLevel ? String(ex.safetyLevel) : 'safe',
    }));

    return {
      dayNumber: typeof d?.dayNumber === 'number' ? d.dayNumber : idx + 1,
      name: String(d?.name || d?.title || `Day ${idx + 1}`),
      focus: String(d?.focus || d?.name || 'Full Body & Posture'),
      exercises,
    };
  });

  if (days.length === 0) return null;

  const rawProgression = rawPlan['progression'] as Record<string, unknown> | undefined;
  const progression: PlanProgressionView | undefined = rawProgression
    ? {
        baselineIntensity: typeof rawProgression['baselineIntensity'] === 'string' ? rawProgression['baselineIntensity'] : 'low-moderate',
        progressionRule: typeof rawProgression['progressionRule'] === 'string' ? rawProgression['progressionRule'] : 'Increase load or reps by +10% after 2 pain-free sessions.',
        increasePercent: typeof rawProgression['increasePercent'] === 'number' ? rawProgression['increasePercent'] : 10,
        conditions: Array.isArray(rawProgression['conditions']) ? rawProgression['conditions'].map(String) : [],
      }
    : {
        baselineIntensity: 'low-moderate',
        progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
        increasePercent: 10,
        conditions: [],
      };

  const safetyNotes = Array.isArray(rawPlan['safetyNotes'])
    ? rawPlan['safetyNotes'].map(String)
    : [];

  const warnings = Array.isArray(record['warnings'])
    ? record['warnings'].map(String)
    : Array.isArray(rawPlan['warnings'])
    ? rawPlan['warnings'].map(String)
    : [];

  return {
    id: String(record['id'] || rawPlan['planId'] || 'active_plan'),
    source: (record['source'] === 'fallback' ? 'fallback' : record['source'] === 'repaired' ? 'repaired' : 'ai') as any,
    model: String(record['model'] || 'Google Gemini 3.7 Flash'),
    createdAt: String(record['createdAt'] || new Date().toISOString()),
    cached: Boolean(record['cached']),
    inputHash: record['inputHash'] ? String(record['inputHash']) : undefined,
    plan: {
      schemaVersion: '1.0',
      source: (record['source'] === 'fallback' ? 'fallback' : 'ai') as any,
      days,
      progression,
      safetyNotes,
      warnings,
    },
    warnings,
  };
}

const FEEDBACK_STORAGE_KEY = 'pc_plan_feedback';

export function PlanPage() {
  const [planView, setPlanView] = useState<WorkoutPlanView | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<string>('');
  const [expandedFormCues, setExpandedFormCues] = useState<Record<number, boolean>>({});
  const [previewExercise, setPreviewExercise] = useState<ExercisePreviewItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (stored) setFeedback(stored);
  }, []);

  const handleSaveFeedback = (value: string) => {
    setFeedback(value);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, value);
    setToast({ message: 'Feedback saved!', type: 'success' });
  };

  const toggleFormCue = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFormCues((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const fetchCurrentPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<any>('workout-plans/current');
      const normalized = normalizeWorkoutPlanView(res);
      if (!normalized) throw new Error('Invalid plan structure received');
      setPlanView(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your workout plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentPlan();
  }, [fetchCurrentPlan]);

  const generateNewPlan = async () => {
    setGenerating(true);
    setError('');
    try {
      await apiClient.post('workout-plans/generate', {});
      await fetchCurrentPlan();
      setToast({ message: 'New plan generated!', type: 'success' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Plan generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const deletePlan = async () => {
    if (!confirm('Delete this plan? This cannot be undone.')) return;
    try {
      await apiClient.delete(`workout-plans/${planView?.id}`);
      setPlanView(null);
      setToast({ message: 'Plan deleted.', type: 'success' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delete failed.');
    }
  };

  const swipeDay = (direction: 'left' | 'right') => {
    if (!planView?.plan?.days) return;
    const count = planView.plan.days.length;
    if (direction === 'left') {
      setSelectedDay((prev) => (prev + 1) % count);
    } else {
      setSelectedDay((prev) => (prev === 0 ? count - 1 : prev - 1));
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) > 60) {
      swipeDay(delta > 0 ? 'left' : 'right');
    }
  };

  if (loading) {
    return <PlanSkeleton />;
  }

  if (error) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
        <Card className="mt-10 border-zinc-800 bg-zinc-900">
          <CardContent className="py-16 text-center">
            <h2 className="text-2xl font-black text-white">Error Loading Plan</h2>
            <p className="mt-2 text-sm text-zinc-400">{error}</p>
            <Button onClick={fetchCurrentPlan} variant="volt" size="md" className="mt-6">
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const dayExercises = planView?.plan?.days?.[selectedDay]?.exercises || [];
  const currentDay = planView?.plan?.days?.[selectedDay];
  const totalExercises = dayExercises.length;
  const totalSets = dayExercises.reduce((sum, ex) => sum + (ex.sets || 0), 0);
  
  // Real gym pacing formula
  const totalRestSeconds = dayExercises.reduce((sum, ex) => sum + (ex.sets || 3) * (ex.restSeconds || 60), 0);
  const totalWorkSeconds = dayExercises.reduce((sum, ex) => sum + (ex.sets || 3) * 45, 0);
  const transitionSeconds = dayExercises.length * 90;
  const warmupSeconds = 300;
  const estMinutes = Math.round((totalRestSeconds + totalWorkSeconds + transitionSeconds + warmupSeconds) / 60) || 50;

  const targetMuscles = Array.from(
    new Set(dayExercises.map((ex) => ex.muscleGroup || ex.movementPattern).filter(Boolean)),
  );

  return (
    <div
      className="h-full w-full max-w-2xl mx-auto flex flex-col overflow-hidden text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <main className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-6 sm:py-6 space-y-6 pb-6">
      {planView?.plan?.days && planView.plan.days.length > 0 ? (
        <>
          {/* Schedule Strip (Fitnest Style) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">Schedule</h1>
                <p className="text-xs text-zinc-400">Weekly Workout Routine</p>
              </div>

              <div className="flex items-center gap-1.5">
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

            {/* Vertical/Pill Day Strip */}
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {planView.plan.days.map((day, idx) => {
                const isActive = idx === selectedDay;
                return (
                  <button
                    key={day.dayNumber}
                    type="button"
                    onClick={() => setSelectedDay(idx)}
                    className={`flex min-w-[76px] flex-1 flex-col items-center justify-center rounded-2xl p-3 text-center transition-all ${
                      isActive
                        ? 'bg-lime-400 text-zinc-950 font-black shadow-lg shadow-lime-400/20 scale-[1.02]'
                        : 'bg-zinc-900 border border-zinc-800/90 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-zinc-950/70' : 'text-zinc-500'}`}>
                      Day {day.dayNumber}
                    </span>
                    <span className="mt-0.5 text-lg font-black tabular-nums">
                      {day.name.replace(/day\s*\d+:\s*/i, '').split(' ')[0] || `D${day.dayNumber}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Hero Workout Banner (Fitnest Card Style) */}
          <section className="relative overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-900 p-5 shadow-xl sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-lime-400/10 blur-3xl" />

            <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lime-400 animate-pulse" />
                  <p className="font-mono text-[11px] font-black uppercase tracking-widest text-lime-400">
                    Day {currentDay?.dayNumber} · Today Target&apos;s
                  </p>
                </div>

                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {currentDay?.name || currentDay?.focus || 'Workout Session'}
                </h2>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
                    <Timer className="h-3.5 w-3.5 text-lime-400" /> {estMinutes} MIN
                  </span>

                  {targetMuscles.slice(0, 3).map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black uppercase tracking-wider text-zinc-950"
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </div>

              {/* Start Workout Action CTA */}
              <button
                type="button"
                onClick={() => navigate('/session')}
                className="group flex items-center justify-center gap-3 rounded-full bg-lime-400 px-6 py-3.5 text-zinc-950 font-black shadow-lg shadow-lime-400/25 transition-all hover:scale-105 active:scale-95 self-start sm:self-auto shrink-0"
              >
                <span className="text-sm font-black uppercase tracking-wider">Start Workout</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-zinc-950 text-lime-400 transition-transform group-hover:scale-110">
                  <Play className="ml-0.5 size-3.5 fill-current" />
                </span>
              </button>
            </div>
          </section>

          {/* List of Exercises (Fitnest Sleek Card List) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-lg font-black text-white">List of Exercise</h3>
                <p className="text-xs text-zinc-400">
                  {totalExercises} Exercises · {totalSets} Total Sets
                </p>
              </div>
              <span className="font-mono text-[11px] font-bold text-zinc-500">Tap to inspect form</span>
            </div>

            <div className="space-y-3">
              {dayExercises.map((exercise, index) => {
                const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
                const isCueExpanded = !!expandedFormCues[index];

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
                      {/* 16:9 Rectangular Thumbnail */}
                      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:h-20 sm:w-32 flex items-center justify-center">
                        <ExerciseVisual
                          name={exercise.name}
                          masterExerciseId={exercise.masterExerciseId || exercise.id}
                          movementPattern={exercise.movementPattern}
                          muscleGroup={exercise.muscleGroup}
                          compact={true}
                        />
                      </div>

                      {/* Middle Exercise Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="truncate text-sm font-bold text-zinc-100 transition-colors group-hover:text-lime-400 sm:text-base capitalize">
                          {exercise.name}
                        </h4>

                        {/* Sets & Reps Subtitle (Lime Highlight) */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-lime-400">
                            {exercise.sets || 3} Sets × {exercise.reps || '8-12'}
                          </span>
                          <span className="text-zinc-600">·</span>
                          <span className="font-mono text-zinc-400">
                            ⏱ {exercise.restSeconds || 90}s rest
                          </span>
                        </div>

                        {/* Clinical Safeguard Indicator / Toggle */}
                        {safetyNotes.tips.length > 0 && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => toggleFormCue(index, e)}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 hover:bg-amber-500/20"
                            >
                              <ShieldCheck className="size-3 text-amber-400" />
                              <span>Clinical Cue</span>
                              {isCueExpanded ? (
                                <ChevronUp className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right Action Chevron Button */}
                      <div className="shrink-0">
                        <div className="flex size-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 transition-all group-hover:border-lime-400 group-hover:bg-lime-400 group-hover:text-zinc-950">
                          <ChevronRight className="size-4" />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Clinical Cue Drawer */}
                    {isCueExpanded && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 animate-fade-in rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
                      >
                        <ul className="space-y-1">
                          {safetyNotes.tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-amber-200">
                              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400" />
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                        {exercise.notes && (
                          <p className="mt-2 border-t border-amber-500/20 pt-2 text-xs text-amber-300/80">
                            {exercise.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Progressive Overload Protocol Card */}
          <details className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition-all">
            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-300 hover:text-white">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-lime-400" />
                Progression Rules & Safety Protocol
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
              {planView?.plan?.progression?.progressionRule && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Progression Protocol
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-200">
                    {planView.plan.progression.progressionRule}
                  </p>
                </div>
              )}

              {planView?.plan?.safetyNotes && planView.plan.safetyNotes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Clinical & Posture Safety Safeguards
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {planView.plan.safetyNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Plan Feedback */}
              <div className="border-t border-zinc-800 pt-4">
                <span className="text-xs font-bold text-zinc-400">How does this split feel?</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Optimal Balance', 'A Bit Heavy', 'Need More Rest', 'Perfect Pace'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSaveFeedback(opt)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
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
          </details>
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

      {/* 3. Anchored Bottom Action Bar */}
      {planView?.plan?.days && planView.plan.days.length > 0 && (
        <footer className="shrink-0 w-full p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
          <Button
            type="button"
            variant="volt"
            size="lg"
            pill={true}
            onClick={() => navigate('/session')}
            className="w-full text-base font-black shadow-lg shadow-lime-400/20"
          >
            <Play className="h-4 w-4 mr-2 fill-current" /> Start Day {selectedDay + 1} Workout
          </Button>
        </footer>
      )}

      {/* Full-Size Exercise Preview Modal */}
      <ExercisePreviewModal
        open={!!previewExercise}
        exercise={previewExercise}
        onClose={() => setPreviewExercise(null)}
      />

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

