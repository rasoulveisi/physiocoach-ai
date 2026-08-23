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
    name?: string;
    description?: string;
    scheduleType?: string;
    summary?: string;
    progression?: PlanProgressionView;
    safetyNotes?: string[];
    days: WorkoutDayView[];
  };
}

export function PlanPage() {
  const [planView, setPlanView] = useState<WorkoutPlanView | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [expandedFormCues, setExpandedFormCues] = useState<Record<string, boolean>>({});
  const [previewExercise, setPreviewExercise] = useState<ExercisePreviewItem | null>(null);

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

    // Strict direction locking:
    // 1. Must move horizontally by at least 60px
    // 2. Horizontal delta must be at least 1.8x larger than vertical delta (prevents vertical scroll conflict)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.8) {
      const daysCount = planView?.plan?.days?.length ?? 0;
      if (daysCount > 0) {
        if (deltaX > 0 && selectedDay < daysCount - 1) {
          // Swipe Left -> Next Day
          setSelectedDay((prev) => prev + 1);
        } else if (deltaX < 0 && selectedDay > 0) {
          // Swipe Right -> Prev Day
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

  const days = planView?.plan?.days || [];
  const daysCount = days.length;
  const currentDay = days[selectedDay] || days[0];

  return (
    <div
      className="h-full w-full max-w-2xl mx-auto flex flex-col overflow-hidden text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <main className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-6 sm:py-6 space-y-6 pb-6 overscroll-contain">
        {daysCount > 0 ? (
          <>
            {/* Schedule Strip */}
            <section className="space-y-3 shrink-0">
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

              {/* Day Selection Strip */}
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {days.map((day, idx) => {
                  const isActive = idx === selectedDay;
                  return (
                    <button
                      key={day.dayNumber}
                      type="button"
                      onClick={() => setSelectedDay(idx)}
                      className={`flex min-w-[76px] flex-1 flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-200 ${
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
                                Day {day.dayNumber} · Today Target&apos;s
                              </p>
                            </div>

                            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                              {day.name || day.focus || 'Workout Session'}
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

                      {/* List of Exercises */}
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
                                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:h-20 sm:w-32 flex items-center justify-center">
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
                                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                          RPE {exercise.rpe}
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

            {/* Plan Progression & Safeguard Details */}
            <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all">
              <summary className="flex cursor-pointer items-center justify-between font-bold text-xs text-zinc-300 hover:text-white">
                <span className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-lime-400" /> AI Progression & Safeguard Notes
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-500" />
              </summary>
              <div className="mt-4 space-y-4 pt-3 border-t border-zinc-800 text-xs text-zinc-300">
                {planView?.plan?.summary && <p className="leading-relaxed text-zinc-400">{planView.plan.summary}</p>}

                {planView?.plan?.progression && (
                  <div className="space-y-1">
                    <span className="font-bold text-white">Overload Model:</span>
                    <p className="text-zinc-400">{planView.plan.progression.progressionRule || 'Standard linear overload (+5–10% volume)'}</p>
                  </div>
                )}

                {planView?.plan?.safetyNotes && planView.plan.safetyNotes.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-bold text-white">Posture Safeguard Rules:</span>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                      {planView.plan.safetyNotes.map((note, idx) => (
                        <li key={idx}>
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
      {daysCount > 0 && (
        <footer className="shrink-0 w-full p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
          <Button
            type="button"
            variant="volt"
            size="lg"
            pill={true}
            onClick={() => navigate('/session')}
            className="w-full text-base font-black shadow-lg shadow-lime-400/20"
          >
            <Play className="h-4 w-4 mr-2 fill-current" /> Start Day {currentDay?.dayNumber || selectedDay + 1} Workout
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
