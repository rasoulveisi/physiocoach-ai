import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Check,
  Clock,
  Dumbbell,
  Minus,
  PartyPopper,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
  Timer,
  Trophy,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Progress } from '../components/ui/Progress';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { RestTimerHUD } from '../components/ui/RestTimerHUD';
import { PlateCalculatorModal } from '../components/ui/PlateCalculatorModal';
import { ExerciseSwapModal, type SwapCandidateItem } from '../components/ui/ExerciseSwapModal';
import { resolveExerciseSafetyNotes } from '../services/exercise-safety-notes';
import { soundCueService } from '../services/sound-cue-service';
import { usePreferences } from '../context/PreferencesContext';
import { apiClient } from '../services/api-client';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

interface LoggedSet {
  id?: string;
  setIndex: number;
  setType: SetType;
  weight: number;
  reps: number;
  rpe?: number | null;
  completed: boolean;
  previousPerformance?: { weight: number; reps: number; date?: string } | null;
}

interface SessionExercise {
  id?: string;
  masterExerciseId?: string | null;
  name: string;
  movementPattern?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: number | string;
  rpe?: number;
  restSeconds?: number;
  safetyLevel?: string;
}

export function SessionPage() {
  const { unitSystem, formatWeight, autoStartRestTimer } = usePreferences();
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [logs, setLogs] = useState<Record<number, LoggedSet[]>>({});
  const [sessionState, setSessionState] = useState<'idle' | 'active' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [sessionRpe, setSessionRpe] = useState(7);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);

  // Rest Timer HUD State
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [restTimerActiveKey, setRestTimerActiveKey] = useState(0);

  // Plate Calculator Modal State
  const [plateCalcTarget, setPlateCalcTarget] = useState<{
    exIdx: number;
    setIdx: number;
    weight: number;
    name: string;
  } | null>(null);

  // Exercise Swap Modal State
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);
  const [allCandidates, setAllCandidates] = useState<SwapCandidateItem[]>([]);

  const navigate = useNavigate();

  // Load Active Plan / Create Session Logs
  useEffect(() => {
    apiClient
      .get<any>('workout-plans/current')
      .then((res) => {
        const root = res?.data || res;
        const plan = root?.plan || root;
        const found = plan?.days?.[0]?.exercises || [];

        const mapped: SessionExercise[] = found.map((ex: any) => ({
          id: ex.id,
          masterExerciseId: ex.masterExerciseId || ex.id,
          name: ex.name,
          movementPattern: ex.movementPattern,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets || 3,
          reps: ex.reps || 10,
          rpe: ex.rpe || 7,
          restSeconds: ex.restSeconds || 90,
          safetyLevel: ex.safetyLevel || 'safe',
        }));

        setExercises(mapped);

        // Populate Candidate list from other days of the plan
        const candidatePool: SwapCandidateItem[] = [];
        const seen = new Set<string>();
        for (const d of plan?.days || []) {
          for (const ex of d.exercises || []) {
            const id = ex.masterExerciseId || ex.name;
            if (!seen.has(id)) {
              seen.add(id);
              candidatePool.push({
                masterExerciseId: ex.masterExerciseId,
                name: ex.name,
                movementPattern: ex.movementPattern,
                muscleGroups: ex.muscleGroup ? [ex.muscleGroup] : [],
                equipment: ex.equipment,
                safetyLevel: ex.safetyLevel || 'safe',
              });
            }
          }
        }
        setAllCandidates(candidatePool);

        // Seed logs table
        const initialLogs: Record<number, LoggedSet[]> = {};
        mapped.forEach((ex, exIdx) => {
          const count = ex.sets || 3;
          initialLogs[exIdx] = Array.from({ length: count }, (_, sIdx) => ({
            setIndex: sIdx + 1,
            setType: (sIdx === 0 && count >= 4 ? 'warmup' : 'working') as SetType,
            weight: 20,
            reps: typeof ex.reps === 'number' ? ex.reps : Number(ex.reps) || 10,
            rpe: ex.rpe || 7,
            completed: false,
            previousPerformance: { weight: 20, reps: 10 },
          }));
        });
        setLogs(initialLogs);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not initialize session.');
      });
  }, []);

  // Duration Timer
  useEffect(() => {
    if (sessionState !== 'active') return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionState]);

  const handleStartSession = () => {
    setSessionState('active');
    soundCueService.playSetCompleteBeep();
  };

  const handlePauseSession = () => {
    setSessionState((prev) => (prev === 'active' ? 'paused' : 'active'));
  };

  const totalSets = Object.values(logs).flat().length;
  const completedSets = Object.values(logs).flat().filter((x) => x.completed).length;

  const sessionMinutes = Math.floor(seconds / 60);
  const sessionSecs = seconds % 60;
  const timeFormatted = `${String(sessionMinutes).padStart(2, '0')}:${String(sessionSecs).padStart(2, '0')}`;

  const totalVolumeKg = useMemo(() => {
    return Object.values(logs)
      .flat()
      .filter((s) => s.completed)
      .reduce((sum, s) => sum + s.weight * s.reps, 0);
  }, [logs]);

  const updateSet = (exIdx: number, setIdx: number, updates: Partial<LoggedSet>) => {
    setLogs((prev) => ({
      ...prev,
      [exIdx]: prev[exIdx].map((s, i) => (i === setIdx ? { ...s, ...updates } : s)),
    }));
  };

  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    const set = logs[exIdx]?.[setIdx];
    if (!set) return;

    // Auto-start workout if it was in idle state
    if (sessionState === 'idle') {
      setSessionState('active');
    }

    const nowComplete = !set.completed;
    updateSet(exIdx, setIdx, { completed: nowComplete });

    if (nowComplete) {
      soundCueService.playSetCompleteBeep();

      if (autoStartRestTimer && exercises[exIdx]?.restSeconds) {
        setRestTimerSeconds(exercises[exIdx].restSeconds || 90);
        setRestTimerActiveKey((k) => k + 1);
      }
    }
  };

  const handleAdjustWeight = (exIdx: number, setIdx: number, delta: number) => {
    const set = logs[exIdx]?.[setIdx];
    if (!set) return;
    const newWeight = Math.max(0, set.weight + delta);
    updateSet(exIdx, setIdx, { weight: newWeight });
  };

  const handleAdjustReps = (exIdx: number, setIdx: number, delta: number) => {
    const set = logs[exIdx]?.[setIdx];
    if (!set) return;
    const newReps = Math.max(0, set.reps + delta);
    updateSet(exIdx, setIdx, { reps: newReps });
  };

  const handleAddSet = (exIdx: number) => {
    const currentSets = logs[exIdx] || [];
    const lastSet = currentSets[currentSets.length - 1];
    const newSet: LoggedSet = {
      setIndex: currentSets.length + 1,
      setType: 'working',
      weight: lastSet?.weight || 20,
      reps: lastSet?.reps || 10,
      rpe: lastSet?.rpe || 7,
      completed: false,
    };
    setLogs((prev) => ({ ...prev, [exIdx]: [...currentSets, newSet] }));
  };

  const handleConfirmSwap = (selected: SwapCandidateItem) => {
    if (swapTargetIndex === null) return;

    setExercises((prev) =>
      prev.map((ex, i) =>
        i === swapTargetIndex
          ? {
              ...ex,
              name: selected.name,
              masterExerciseId: selected.masterExerciseId,
              movementPattern: selected.movementPattern,
              muscleGroup: selected.muscleGroups?.[0],
            }
          : ex,
      ),
    );
    setSwapTargetIndex(null);
  };

  const finishSession = async () => {
    if (completedSets === 0) {
      setError('No sets completed. Complete at least one set to finish.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        durationSeconds: seconds,
        sessionRpe,
        exercises: exercises.map((ex, exIdx) => ({
          masterExerciseId: ex.masterExerciseId,
          name: ex.name,
          sets: logs[exIdx]
            ?.filter((s) => s.completed)
            .map((s) => ({
              setType: s.setType,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
            })),
        })),
      };

      await apiClient.post('workout-logs', payload);
      setCompleteModalOpen(true);
      soundCueService.playTimerCompleteChime();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  const setTypeLabels: Record<SetType, string> = {
    warmup: 'W',
    working: '',
    drop: 'D',
    failure: 'F',
  };

  if (exercises.length === 0 && !error) {
    return (
      <main className="mx-auto min-h-screen max-w-screen-xl px-4 py-6">
        <div className="grid min-h-[60vh] place-items-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-lime-400 border-r-transparent" />
        </div>
      </main>
    );
  }

  return (
    <main className="h-full w-full max-w-2xl mx-auto flex-1 overflow-y-auto min-h-0 space-y-6 px-4 py-4 sm:px-6 sm:py-6 pb-8 text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950">
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Top Active Workout Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                sessionState === 'active'
                  ? 'bg-lime-400 animate-pulse'
                  : sessionState === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
              }`}
            />
            <h1 className="text-xs font-black uppercase tracking-wider text-zinc-400">
              {sessionState === 'active'
                ? 'Workout in Progress'
                : sessionState === 'paused'
                ? 'Workout Paused'
                : 'Ready to Train'}
            </h1>
          </div>

          <div
            className={`font-mono text-3xl font-black tabular-nums sm:text-4xl ${
              sessionState === 'active'
                ? 'text-lime-400'
                : sessionState === 'paused'
                ? 'text-amber-400'
                : 'text-zinc-400'
            }`}
          >
            {timeFormatted}
          </div>

          <p className="text-xs font-bold text-zinc-400">
            {completedSets} / {totalSets} Sets Complete
          </p>
        </div>

        <div className="flex items-center gap-2">
          {sessionState === 'idle' ? (
            <Button
              variant="volt"
              size="lg"
              pill={true}
              onClick={handleStartSession}
              className="shadow-lg shadow-lime-400/20 font-black px-6"
            >
              <Play className="mr-1.5 h-4 w-4 fill-current" /> Start Session
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="md"
                pill={true}
                onClick={handlePauseSession}
                className="border-zinc-700 hover:border-zinc-500"
                title={sessionState === 'paused' ? 'Resume workout' : 'Pause workout'}
              >
                {sessionState === 'paused' ? (
                  <>
                    <Play className="h-4 w-4 fill-current mr-1 text-lime-400" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1 text-zinc-300" /> Pause
                  </>
                )}
              </Button>

              <Button
                variant="volt"
                size="md"
                pill={true}
                onClick={finishSession}
                loading={saving}
                className="font-bold"
              >
                <PartyPopper className="h-4 w-4 mr-1" /> Finish
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Rest Timer HUD */}
      <RestTimerHUD key={restTimerActiveKey} initialSeconds={restTimerSeconds} />

      {/* Exercise Cards with Set Logging */}
      <div className="space-y-5">
        {exercises.map((exercise, exIdx) => {
          const safety = exercise.safetyLevel || 'safe';
          const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
          const exerciseSets = logs[exIdx] || [];

          return (
            <Card key={exercise.id || exIdx} className="overflow-hidden">
              <CardContent className="p-5">
                {/* Exercise Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="shrink-0">
                      <div className="size-14 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                        <ExerciseVisual
                          name={exercise.name}
                          masterExerciseId={exercise.masterExerciseId || exercise.id}
                          movementPattern={exercise.movementPattern}
                          muscleGroup={exercise.muscleGroup}
                          compact={true}
                        />
                      </div>
                    </div>

                    <div className="flex-1">
                      <h2 className="text-base font-extrabold text-white sm:text-lg">{exercise.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {exercise.movementPattern && (
                          <Badge variant="lime" className="text-[10px]">
                            {exercise.movementPattern}
                          </Badge>
                        )}
                        <Badge
                          variant={safety === 'avoid' ? 'danger' : safety === 'caution' ? 'amber' : 'lime'}
                          className="text-[10px]"
                        >
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          {safety.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPlateCalcTarget({
                          exIdx,
                          setIdx: 0,
                          weight: exerciseSets[0]?.weight || 20,
                          name: exercise.name,
                        })
                      }
                      className="grid size-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-lime-400 hover:text-lime-400 transition-colors"
                      title="Barbell Plate Calculator"
                    >
                      <Dumbbell className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSwapTargetIndex(exIdx)}
                      className="grid size-9 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-lime-400 hover:text-lime-400 transition-colors"
                      title="Swap Exercise"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Set Logging Rows */}
                <div className="mt-5 space-y-2.5">
                  {exerciseSets.map((set, setIdx) => {
                    const prevText = set.previousPerformance
                      ? `Last: ${set.previousPerformance.weight}${unitSystem === 'metric' ? 'kg' : 'lb'} × ${set.previousPerformance.reps}`
                      : '';

                    return (
                      <div
                        key={setIdx}
                        className={`grid grid-cols-[36px_1fr_1fr_44px] items-center gap-2 sm:gap-3 rounded-2xl border p-2.5 sm:p-3 transition-all ${
                          set.completed
                            ? 'border-lime-400 bg-lime-400/5'
                            : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                        }`}
                      >
                        {/* Set Type / Number Badge */}
                        <div className="flex flex-col items-center justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              const types: SetType[] = ['warmup', 'working', 'drop', 'failure'];
                              const nextType = types[(types.indexOf(set.setType) + 1) % types.length];
                              updateSet(exIdx, setIdx, { setType: nextType });
                            }}
                            className={`grid size-9 place-items-center rounded-xl border font-mono text-xs font-black transition-colors ${
                              set.setType === 'warmup'
                                ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                                : set.setType === 'drop'
                                ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                                : set.setType === 'failure'
                                ? 'border-red-500/40 bg-red-500/20 text-red-300'
                                : 'border-zinc-800 bg-zinc-900 text-white'
                            }`}
                            title="Click to cycle set type: Warmup (W), Working (1..), Drop (D), Failure (F)"
                          >
                            {set.setType === 'working' ? setIdx + 1 : setTypeLabels[set.setType]}
                          </button>
                        </div>

                        {/* Weight Input & Steppers */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustWeight(exIdx, setIdx, -2.5)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-lime-400 active:scale-90"
                              aria-label="Minus 2.5"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={set.weight}
                              onChange={(e) =>
                                updateSet(exIdx, setIdx, { weight: Number(e.target.value) })
                              }
                              className="h-9 w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-1 text-center font-mono text-sm font-bold text-white outline-none focus:border-lime-400"
                            />

                            <button
                              type="button"
                              onClick={() => handleAdjustWeight(exIdx, setIdx, 2.5)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-lime-400 active:scale-90"
                              aria-label="Plus 2.5"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="px-0.5 text-center">
                            <span className="block truncate font-mono text-[10px] text-zinc-500">
                              {prevText || `${set.weight}kg load`}
                            </span>
                          </div>
                        </div>

                        {/* Reps Input & Steppers */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustReps(exIdx, setIdx, -1)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-lime-400 active:scale-90"
                              aria-label="Minus 1 rep"
                            >
                              <Minus className="h-3 w-3" />
                            </button>

                            <input
                              type="number"
                              min="0"
                              value={set.reps}
                              onChange={(e) =>
                                updateSet(exIdx, setIdx, { reps: Number(e.target.value) })
                              }
                              className="h-9 w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-1 text-center font-mono text-sm font-bold text-white outline-none focus:border-lime-400"
                            />

                            <button
                              type="button"
                              onClick={() => handleAdjustReps(exIdx, setIdx, 1)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-lime-400 active:scale-90"
                              aria-label="Plus 1 rep"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="px-0.5 text-center">
                            <span className="block truncate font-mono text-[10px] text-zinc-500">
                              Target: {exercise.reps}
                            </span>
                          </div>
                        </div>

                        {/* Completion Check Button */}
                        <div className="flex justify-center shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleSetComplete(exIdx, setIdx)}
                            className={`grid size-10 place-items-center rounded-xl border-2 font-black transition-all duration-150 active:scale-90 ${
                              set.completed
                                ? 'border-lime-400 bg-lime-400 text-zinc-950 shadow-[0_0_12px_rgba(163,230,53,0.4)]'
                                : 'border-zinc-800 bg-zinc-950 text-zinc-600 hover:border-lime-400 hover:text-lime-400'
                            }`}
                            aria-label={`Complete set ${setIdx + 1}`}
                          >
                            <Check className="h-5 w-5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Set Button */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddSet(exIdx)}
                    className="w-full border border-dashed border-zinc-800 text-zinc-400 hover:border-zinc-500"
                  >
                    <Plus className="h-4 w-4" /> Add Set
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Session Rate of Perceived Exertion (RPE) Slider */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">Overall Session Effort (RPE)</h3>
              <p className="text-xs text-zinc-400">
                1 is light warm-up, 7 is moderate hard, 10 is maximum muscular exhaustion.
              </p>
            </div>
            <span className="font-mono text-3xl font-black tabular-nums text-lime-400">{sessionRpe}</span>
          </div>

          <input
            type="range"
            min="1"
            max="10"
            value={sessionRpe}
            onChange={(e) => setSessionRpe(Number(e.target.value))}
            className="mt-4 w-full cursor-pointer accent-lime-400"
          />

          <div className="mt-2 flex justify-between text-[11px] font-bold text-zinc-500">
            <span>Easy (1–3)</span>
            <span>Programmed Target (7–8)</span>
            <span>Max Effort (10)</span>
          </div>
        </CardContent>
      </Card>

      {/* Finish Session CTA */}
      <Button
        size="lg"
        variant="volt"
        onClick={finishSession}
        loading={saving}
        disabled={!completedSets}
        className="w-full py-6 text-base font-black"
      >
        <PartyPopper className="h-5 w-5" /> Complete Workout Session
      </Button>

      {/* Barbell Plate Calculator Modal */}
      {plateCalcTarget && (
        <PlateCalculatorModal
          open={true}
          initialWeight={plateCalcTarget.weight}
          exerciseName={plateCalcTarget.name}
          onClose={() => setPlateCalcTarget(null)}
          onApplyWeight={(appliedKg) => {
            updateSet(plateCalcTarget.exIdx, plateCalcTarget.setIdx, { weight: appliedKg });
            setPlateCalcTarget(null);
          }}
          unitSystem={unitSystem}
        />
      )}

      {/* Exercise Swap Modal */}
      {swapTargetIndex !== null && (
        <ExerciseSwapModal
          open={true}
          currentExerciseName={exercises[swapTargetIndex]?.name || ''}
          currentMovementPattern={exercises[swapTargetIndex]?.movementPattern}
          candidates={allCandidates}
          onClose={() => setSwapTargetIndex(null)}
          onConfirmSwap={handleConfirmSwap}
        />
      )}

      {/* Workout Complete Celebration Modal */}
      <Modal
        open={completeModalOpen}
        title="Workout Complete!"
        onClose={() => navigate('/dashboard')}
        footer={
          <Button variant="volt" size="lg" onClick={() => navigate('/dashboard')} className="w-full">
            Back to Dashboard
          </Button>
        }
      >
        <div className="space-y-5 py-4 text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-3xl border border-lime-400/30 bg-lime-400/10 text-lime-400">
            <Trophy className="h-10 w-10 stroke-[2.5]" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-white">Outstanding Work!</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Session metrics successfully logged to your athletic training history.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div>
              <strong className="block font-mono text-2xl font-black tabular-nums text-white">
                {timeFormatted}
              </strong>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Duration
              </span>
            </div>
            <div>
              <strong className="block font-mono text-2xl font-black tabular-nums text-lime-400">
                {completedSets}
              </strong>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Sets Done
              </span>
            </div>
            <div>
              <strong className="block font-mono text-2xl font-black tabular-nums text-cyan-400">
                {formatWeight(totalVolumeKg).value}
              </strong>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {formatWeight(totalVolumeKg).unit} Volume
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}
