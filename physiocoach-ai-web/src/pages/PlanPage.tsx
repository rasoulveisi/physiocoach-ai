import { useCallback, useEffect, useState, useRef, type TouchEvent } from 'react';
import {
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Play,
  RefreshCw,
  ShieldCheck,
  Timer,
  Flame,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { ExercisePreviewModal, type ExercisePreviewItem } from '../components/ui/ExercisePreviewModal';
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
  const [slideDirection, setSlideDirection] = useState<'right' | 'left'>('right');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [expandedFormCues, setExpandedFormCues] = useState<Record<number, boolean>>({});
  const [previewExercise, setPreviewExercise] = useState<ExercisePreviewItem | null>(null);
  const [feedback, setFeedback] = useState<string>(() => localStorage.getItem(FEEDBACK_STORAGE_KEY) || '');

  const touchStartXRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<unknown>('workout-plans/current');
      const normalized = normalizeWorkoutPlanView(res);
      setPlanView(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load active workout plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const generateNewPlan = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await apiClient.post<unknown>('workout-plans/generate', {});
      const normalized = normalizeWorkoutPlanView(res);
      setPlanView(normalized);
      setSelectedDay(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AI workout plan generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const deleteCurrentPlan = async () => {
    if (!window.confirm('Are you sure you want to delete your current workout plan?')) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await apiClient.delete('workout-plans/current');
      setPlanView(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete current plan.');
    } finally {
      setDeleting(false);
    }
  };

  const days = planView?.plan?.days || [];
  const currentDay = days[selectedDay];

  const handleSelectDay = (index: number) => {
    if (index === selectedDay) return;
    setSlideDirection(index > selectedDay ? 'right' : 'left');
    setSelectedDay(index);
    setExpandedFormCues({});
  };

  // Touch Swipe Carousel Navigation
  const handleTouchStart = (e: TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0 && selectedDay < days.length - 1) {
        // Swipe left -> Next day
        handleSelectDay(selectedDay + 1);
      } else if (diff < 0 && selectedDay > 0) {
        // Swipe right -> Previous day
        handleSelectDay(selectedDay - 1);
      }
    }
    touchStartXRef.current = null;
  };

  const toggleFormCue = (index: number) => {
    setExpandedFormCues((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleSaveFeedback = (val: string) => {
    setFeedback(val);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, val);
  };

  const dayExercises = currentDay?.exercises || [];
  const totalSets = dayExercises.reduce((sum, ex) => sum + (ex.sets || 3), 0);
  const estMinutes = Math.max(25, Math.round(totalSets * 2.5));
  const targetMuscles = Array.from(
    new Set(dayExercises.map((e) => e.muscleGroup || e.movementPattern).filter(Boolean)),
  );

  return (
    <main
      className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 lg:p-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header & AI Plan Action */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-volt" />
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-volt">
              Precision Programming
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {currentDay?.name ? `Personalized Split · ${days.length} Days` : 'Weekly Workout Split'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Swipe or select days to review exercises, clinical cues, and target loads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {planView && (
            <Badge variant={planView.source === 'ai' ? 'volt' : 'amber'}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              {planView.source === 'ai' ? 'AI GENERATED' : 'VERIFIED SPLIT'} · {planView.model}
            </Badge>
          )}

          {planView && (
            <Button
              onClick={deleteCurrentPlan}
              loading={deleting}
              variant="outline"
              size="md"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button onClick={generateNewPlan} loading={generating} variant="volt" size="md">
            <BrainCircuit className="h-4 w-4" />
            {planView ? 'Regenerate AI Plan' : 'Generate AI Workout Plan'}
          </Button>
        </div>
      </header>

      {error && (
        <div className="mt-6">
          <Toast type="error" message={error} onClose={() => setError('')} />
        </div>
      )}

      {days.length > 0 ? (
        <>
          {/* Animated Weekly Split Day Navigation Strip */}
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectedDay > 0 && handleSelectDay(selectedDay - 1)}
              disabled={selectedDay === 0}
              className="hidden size-10 shrink-0 place-items-center rounded-xl border border-obsidian-700 bg-obsidian-900 text-slate-400 hover:border-volt hover:text-volt disabled:opacity-30 sm:grid"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex flex-1 gap-2 overflow-x-auto pb-2 scrollbar-none">
              {days.map((item, index) => {
                const isActive = selectedDay === index;
                return (
                  <button
                    key={item.dayNumber || index}
                    type="button"
                    onClick={() => handleSelectDay(index)}
                    className={`relative min-w-32 flex-1 rounded-xl border p-3.5 text-left transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? 'border-volt bg-volt/10'
                        : 'border-obsidian-700 bg-obsidian-900/80 hover:border-obsidian-600 hover:bg-obsidian-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-[11px] font-extrabold uppercase ${
                          isActive ? 'text-volt' : 'text-slate-400'
                        }`}
                      >
                        DAY {item.dayNumber || index + 1}
                      </span>
                      {isActive && <span className="size-1.5 rounded-full bg-volt" />}
                    </div>
                    <span className="mt-1 block truncate text-sm font-extrabold text-white">
                      {item.focus || item.name || `Session ${index + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => selectedDay < days.length - 1 && handleSelectDay(selectedDay + 1)}
              disabled={selectedDay === days.length - 1}
              className="hidden size-10 shrink-0 place-items-center rounded-xl border border-obsidian-700 bg-obsidian-900 text-slate-400 hover:border-volt hover:text-volt disabled:opacity-30 sm:grid"
              aria-label="Next day"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Active Day Telemetry Header */}
          <div
            key={`header-${selectedDay}`}
            className={`mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-obsidian-700 bg-obsidian-900 p-5 ${
              slideDirection === 'right' ? 'pc-slide-right' : 'pc-slide-left'
            }`}
          >
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-volt">
                Day {currentDay?.dayNumber || selectedDay + 1} of {days.length}
              </span>
              <h2 className="mt-1 text-2xl font-black text-white">
                {currentDay?.focus || currentDay?.name || 'Workout Session'}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-obsidian-700 bg-obsidian-950 px-2.5 py-1 font-mono text-xs font-bold text-slate-300">
                  {dayExercises.length} Exercises
                </span>
                <span className="rounded-md border border-obsidian-700 bg-obsidian-950 px-2.5 py-1 font-mono text-xs font-bold text-slate-300">
                  {totalSets} Total Sets
                </span>
                <span className="flex items-center gap-1 rounded-md border border-obsidian-700 bg-obsidian-950 px-2.5 py-1 font-mono text-xs font-bold text-cyan-400">
                  <Timer className="h-3.5 w-3.5" /> ~{estMinutes} Mins
                </span>
                {targetMuscles.slice(0, 3).map((m) => (
                  <Badge key={m} variant="neutral">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              variant="volt"
              size="md"
              onClick={() => navigate('/session')}
              className="w-full sm:w-auto"
            >
              <Play className="h-4 w-4 fill-current" /> Start This Workout
            </Button>
          </div>

          {/* Exercise Grid with Visuals & Form Cues */}
          <section
            key={`exercises-${selectedDay}`}
            className={`mt-6 grid gap-4 lg:grid-cols-2 ${
              slideDirection === 'right' ? 'pc-slide-right' : 'pc-slide-left'
            }`}
          >
            {dayExercises.map((exercise, index) => {
              const safety = exercise.safetyLevel || 'safe';
              const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
              const isCueExpanded = !!expandedFormCues[index];

              return (
                <Card
                  key={exercise.id || `${exercise.name}-${index}`}
                  className="group relative overflow-hidden transition-all duration-200 hover:border-obsidian-600"
                >
                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      {/* Interactive Visual Thumbnail */}
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewExercise({
                            id: exercise.masterExerciseId || exercise.id || '',
                            masterExerciseId: exercise.masterExerciseId,
                            name: exercise.name,
                            movementPattern: exercise.movementPattern,
                            muscleGroup: exercise.muscleGroup,
                          })
                        }
                        className="group/img relative cursor-pointer"
                        title="Click for full-screen demonstration"
                      >
                        <ExerciseVisual
                          name={exercise.name}
                          masterExerciseId={exercise.masterExerciseId || exercise.id}
                          movementPattern={exercise.movementPattern}
                          muscleGroup={exercise.muscleGroup}
                          compact={true}
                        />
                        <div className="absolute inset-0 grid place-items-center rounded-xl bg-obsidian-950/60 opacity-0 transition-opacity group-hover/img:opacity-100">
                          <span className="text-[10px] font-bold text-volt">Preview</span>
                        </div>
                      </button>

                      {/* Exercise Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[11px] font-bold text-slate-500">
                              #{String(index + 1).padStart(2, '0')}
                            </span>
                            <h3
                              onClick={() =>
                                setPreviewExercise({
                                  id: exercise.masterExerciseId || exercise.id || '',
                                  masterExerciseId: exercise.masterExerciseId,
                                  name: exercise.name,
                                  movementPattern: exercise.movementPattern,
                                  muscleGroup: exercise.muscleGroup,
                                })
                              }
                              className="cursor-pointer text-lg font-black text-white hover:text-volt transition-colors"
                            >
                              {exercise.name}
                            </h3>
                          </div>

                          <Badge
                            variant={
                              safety === 'avoid'
                                ? 'danger'
                                : safety === 'caution'
                                ? 'amber'
                                : 'volt'
                            }
                          >
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            {safety.toUpperCase()}
                          </Badge>
                        </div>

                        {/* Sets × Reps & Load */}
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <span className="font-mono text-xl font-black text-volt">
                            {exercise.sets || 3} <span className="text-xs text-slate-400">SETS</span> ×{' '}
                            {exercise.reps || 10} <span className="text-xs text-slate-400">REPS</span>
                          </span>

                          {exercise.rpe && (
                            <span className="flex items-center gap-1 rounded-md border border-volt/30 bg-volt/10 px-2 py-0.5 font-mono text-xs font-bold text-volt">
                              <Flame className="h-3 w-3" /> RPE {exercise.rpe}
                            </span>
                          )}

                          {exercise.restSeconds && (
                            <span className="font-mono text-xs text-slate-400">
                              {exercise.restSeconds}s rest
                            </span>
                          )}
                        </div>

                        {/* Movement Pattern & Muscle Group Badges */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {exercise.movementPattern && (
                            <Badge variant="cyan">{exercise.movementPattern}</Badge>
                          )}
                          {exercise.muscleGroup && (
                            <Badge variant="neutral">
                              <Dumbbell className="mr-1 h-3 w-3" />
                              {exercise.muscleGroup}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Clinical Biomechanical Form Cues */}
                    <div className="mt-4 border-t border-obsidian-800 pt-3">
                      <button
                        type="button"
                        onClick={() => toggleFormCue(index)}
                        className="flex w-full items-center justify-between text-xs font-bold text-amber-400 hover:text-amber-300"
                      >
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Clinical Form Cues ({safetyNotes.tips.length})
                        </span>
                        {isCueExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>

                      {isCueExpanded && (
                        <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 animate-fade-in">
                          <ul className="space-y-1">
                            {safetyNotes.tips.map((tip, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-amber-200">
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400" />
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                          {exercise.notes && (
                            <p className="mt-2 text-xs text-amber-300/80 border-t border-amber-500/20 pt-2">
                              {exercise.notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {/* Auxiliary Progression Rules & Feedback Accordion */}
          <details className="group mt-8 rounded-2xl border border-obsidian-700 bg-obsidian-900 p-5 transition-all">
            <summary className="flex cursor-pointer items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white list-none">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-cyan-400" />
                Progression Rules & Safety Guidelines
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 space-y-4 border-t border-obsidian-800 pt-4">
              {planView?.plan?.progression?.progressionRule && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Progression Protocol
                  </h4>
                  <p className="mt-1 text-sm text-slate-200 leading-relaxed">
                    {planView.plan.progression.progressionRule}
                  </p>
                </div>
              )}

              {planView?.plan?.safetyNotes && planView.plan.safetyNotes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Medical & Posture Safety Notes
                  </h4>
                  <ul className="mt-2 space-y-1">
                    {planView.plan.safetyNotes.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Plan Feedback */}
              <div className="border-t border-obsidian-800 pt-4">
                <span className="text-xs font-bold text-slate-400">How does this split feel?</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Optimal Balance', 'A Bit Heavy', 'Need More Rest', 'Perfect Pace'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSaveFeedback(opt)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                        feedback === opt
                          ? 'border-volt bg-volt/10 text-volt'
                          : 'border-obsidian-700 bg-obsidian-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      {feedback === opt && <CheckCircle2 className="h-3.5 w-3.5 text-volt" />}
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
          <Card className="mt-10">
            <CardContent className="py-20 text-center">
              <RefreshCw className="mx-auto h-12 w-12 text-slate-600 animate-pulse" />
              <h2 className="mt-4 text-2xl font-black text-white">No active workout plan</h2>
              <p className="mt-2 text-sm text-slate-400">
                Generate an intelligent, posture-aware training plan tailored to your profile.
              </p>
              <Button onClick={generateNewPlan} loading={generating} variant="volt" size="md" className="mt-6">
                <BrainCircuit className="h-4 w-4" /> Generate Plan Now
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {/* Full-Size Exercise Preview Modal */}
      <ExercisePreviewModal
        open={!!previewExercise}
        exercise={previewExercise}
        onClose={() => setPreviewExercise(null)}
      />
    </main>
  );
}
