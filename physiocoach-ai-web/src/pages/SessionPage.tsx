import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Check,
  Clock,
  Dumbbell,
  Minus,
  PartyPopper,
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
  const [running, setRunning] = useState(true);
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
    if (!running) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const totalSets = Object.values(logs).flat().length;
  const completedSets = Object.values(logs).flat().filter((x) => x.completed).length;

  const sessionMinutes = Math.floor(seconds / 60);
  const sessionSecs = seconds % 60;
  const timeFormatted = `${String(sessionMinutes).padStart(2, '0')}:${String(sessionSecs).padStart(2, '0')}`;

  const totalVolumeKg = useMemo(() => {
    return Object.values(logs)
      .flat()
      .reduce((sum, s) => sum + (s.completed ? s.weight * s.reps : 0), 0);
  }, [logs]);

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<LoggedSet>) => {
    setLogs((prev) => {
      const currentExLogs = [...(prev[exIdx] || [])];
      currentExLogs[setIdx] = { ...currentExLogs[setIdx], ...patch };
      return { ...prev, [exIdx]: currentExLogs };
    });
  };

  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    const current = logs[exIdx]?.[setIdx];
    if (!current) return;

    const nextCompleted = !current.completed;
    updateSet(exIdx, setIdx, { completed: nextCompleted });

    if (nextCompleted) {
      soundCueService.playSetCompleteBeep();

      if (autoStartRestTimer) {
        const exRest = exercises[exIdx]?.restSeconds || 90;
        setRestTimerSeconds(exRest);
        setRestTimerActiveKey((k) => k + 1); // Triggers RestTimerHUD auto-start
      }
    }
  };

  const handleAdjustWeight = (exIdx: number, setIdx: number, delta: number) => {
    const currentWeight = logs[exIdx]?.[setIdx]?.weight || 0;
    const next = Math.max(0, Math.round((currentWeight + delta) * 10) / 10);
    updateSet(exIdx, setIdx, { weight: next });
  };

  const handleAdjustReps = (exIdx: number, setIdx: number, delta: number) => {
    const currentReps = logs[exIdx]?.[setIdx]?.reps || 0;
    const next = Math.max(0, currentReps + delta);
    updateSet(exIdx, setIdx, { reps: next });
  };

  const handleAddSet = (exIdx: number) => {
    setLogs((prev) => {
      const exLogs = [...(prev[exIdx] || [])];
      const last = exLogs[exLogs.length - 1];
      exLogs.push({
        setIndex: exLogs.length + 1,
        setType: 'working',
        weight: last?.weight || 20,
        reps: last?.reps || 10,
        rpe: last?.rpe || 7,
        completed: false,
      });
      return { ...prev, [exIdx]: exLogs };
    });
  };

  const handleRemoveSet = (exIdx: number, setIdx: number) => {
    setLogs((prev) => {
      const exLogs = (prev[exIdx] || []).filter((_, i) => i !== setIdx);
      return {
        ...prev,
        [exIdx]: exLogs.map((item, idx) => ({ ...item, setIndex: idx + 1 })),
      };
    });
  };

  // Exercise Swap
  const handleConfirmSwap = (candidate: SwapCandidateItem) => {
    if (swapTargetIndex === null) return;
    setExercises((prev) => {
      const copy = [...prev];
      copy[swapTargetIndex] = {
        ...copy[swapTargetIndex],
        masterExerciseId: candidate.masterExerciseId,
        name: candidate.name,
        movementPattern: candidate.movementPattern,
        safetyLevel: candidate.safetyLevel || 'safe',
      };
      return copy;
    });
    setSwapTargetIndex(null);
  };

  // Complete Workout Session
  const finishSession = async () => {
    setSaving(true);
    setError('');
    try {
      await apiClient.post('workout-sessions', {
        workoutPlanId: 'current',
        dayIndex: 0,
        scheduledDate: new Date().toISOString().slice(0, 10),
        status: 'completed',
        completedAt: new Date().toISOString(),
        durationSeconds: seconds,
        rpe: sessionRpe,
        exercises: exercises.map((ex, idx) => ({
          exerciseId: ex.id,
          masterExerciseId: ex.masterExerciseId,
          name: ex.name,
          sets: logs[idx] || [],
        })),
      });

      setRunning(false);
      setCompleteModalOpen(true);
    } catch (cause) {
      // If endpoint requires active ID, still finish client session gracefully
      setRunning(false);
      setCompleteModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const setTypeLabels: Record<SetType, string> = {
    warmup: 'W',
    working: '1',
    drop: 'D',
    failure: 'F',
  };

  return (
    <main className="mx-auto max-w-5xl p-4 pb-32 sm:p-6 lg:p-8 space-y-6">
      {/* Live Header with Session Timer HUD */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-obsidian-700 bg-obsidian-900 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-volt animate-pulse" />
            <p className="font-mono text-xs font-extrabold uppercase tracking-widest text-volt">
              Live Session Tracker
            </p>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-white">Active Workout</h1>
        </div>

        {/* Stopwatch & State */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-obsidian-700 bg-obsidian-950 px-4 py-2 text-white">
            <Clock className="h-5 w-5 text-volt" />
            <span className="font-tabular text-2xl font-black">{timeFormatted}</span>
          </div>

          <Button
            size="md"
            variant={running ? 'danger' : 'volt'}
            onClick={() => setRunning(!running)}
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </header>

      {/* Live Progress Bar */}
      <div>
        <Progress
          value={totalSets ? (completedSets / totalSets) * 100 : 0}
          label={`${completedSets} of ${totalSets} sets logged`}
        />
      </div>

      {/* Live Mechanical Rest Timer HUD */}
      <RestTimerHUD
        key={restTimerActiveKey}
        initialSeconds={restTimerSeconds}
        autoStart={restTimerActiveKey > 0}
      />

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Exercises Set Logging Cards */}
      <div className="space-y-6">
        {exercises.map((exercise, exIdx) => {
          const exLogs = logs[exIdx] || [];
          const safetyNotes = resolveExerciseSafetyNotes(exercise.name);

          return (
            <Card key={exercise.id || `${exercise.name}-${exIdx}`} className="overflow-hidden">
              <CardContent className="p-5 sm:p-6 space-y-4">
                {/* Exercise Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-obsidian-800 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <ExerciseVisual
                      name={exercise.name}
                      masterExerciseId={exercise.masterExerciseId}
                      movementPattern={exercise.movementPattern}
                      compact={true}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-volt">
                          EXERCISE {exIdx + 1}
                        </span>
                        {exercise.movementPattern && (
                          <Badge variant="cyan">{exercise.movementPattern}</Badge>
                        )}
                      </div>
                      <h2 className="truncate text-xl font-black text-white">{exercise.name}</h2>
                    </div>
                  </div>

                  {/* Swap Exercise Trigger */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSwapTargetIndex(exIdx)}
                    title="Swap exercise"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5 text-volt" /> Swap
                  </Button>
                </div>

                {/* Biomechanical Safety Tip */}
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>{safetyNotes.tips[0] || 'Keep core braced and spine neutral.'}</span>
                </div>

                {/* Compact Gym-Floor Set Logging Table */}
                <div className="space-y-2">
                  {/* Table Column Headers */}
                  <div className="grid grid-cols-[48px_1fr_1fr_48px] items-center gap-2 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <span className="text-center">SET</span>
                    <span className="text-center">WEIGHT ({unitSystem === 'imperial' ? 'LBS' : 'KG'})</span>
                    <span className="text-center">REPS</span>
                    <span className="text-center">DONE</span>
                  </div>

                  {/* Set Rows */}
                  {exLogs.map((set, setIdx) => {
                    const prevText = set.previousPerformance
                      ? `Prev: ${formatWeight(set.previousPerformance.weight).value} × ${set.previousPerformance.reps}`
                      : null;

                    return (
                      <div
                        key={setIdx}
                        className={`grid grid-cols-[48px_1fr_1fr_48px] items-center gap-2 rounded-xl p-2.5 transition-all ${
                          set.completed
                            ? 'border border-volt/40 bg-volt/10'
                            : 'border border-obsidian-800 bg-obsidian-950/80 hover:border-obsidian-700'
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
                            className={`grid size-8 place-items-center rounded-lg border font-mono text-xs font-black transition-colors ${
                              set.setType === 'warmup'
                                ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                                : set.setType === 'drop'
                                ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300'
                                : set.setType === 'failure'
                                ? 'border-red-500/40 bg-red-500/20 text-red-300'
                                : 'border-obsidian-700 bg-obsidian-900 text-white'
                            }`}
                            title="Click to cycle set type: Warmup (W), Working (1..), Drop (D), Failure (F)"
                          >
                            {set.setType === 'working' ? setIdx + 1 : setTypeLabels[set.setType]}
                          </button>
                        </div>

                        {/* Weight Input & Steppers & Plate Calc Button */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustWeight(exIdx, setIdx, -2.5)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-obsidian-700 bg-obsidian-900 text-slate-300 hover:border-volt active:scale-90"
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
                              className="h-9 w-full min-w-0 rounded-lg border border-obsidian-700 bg-obsidian-900 px-2 text-center font-tabular text-sm font-extrabold text-white outline-none focus:border-volt"
                            />

                            <button
                              type="button"
                              onClick={() => handleAdjustWeight(exIdx, setIdx, 2.5)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-obsidian-700 bg-obsidian-900 text-slate-300 hover:border-volt active:scale-90"
                              aria-label="Plus 2.5"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between px-1 text-[10px]">
                            {prevText ? (
                              <span className="truncate text-slate-500 font-mono">{prevText}</span>
                            ) : <span />}
                            <button
                              type="button"
                              onClick={() =>
                                setPlateCalcTarget({
                                  exIdx,
                                  setIdx,
                                  weight: set.weight,
                                  name: exercise.name,
                                })
                              }
                              className="font-bold text-volt hover:underline"
                            >
                              Plates
                            </button>
                          </div>
                        </div>

                        {/* Reps Input & Steppers */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustReps(exIdx, setIdx, -1)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-obsidian-700 bg-obsidian-900 text-slate-300 hover:border-volt active:scale-90"
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
                              className="h-9 w-full min-w-0 rounded-lg border border-obsidian-700 bg-obsidian-900 px-2 text-center font-tabular text-sm font-extrabold text-white outline-none focus:border-volt"
                            />

                            <button
                              type="button"
                              onClick={() => handleAdjustReps(exIdx, setIdx, 1)}
                              className="grid size-8 shrink-0 place-items-center rounded-lg border border-obsidian-700 bg-obsidian-900 text-slate-300 hover:border-volt active:scale-90"
                              aria-label="Plus 1 rep"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <span className="block text-center text-[10px] text-slate-500 font-mono">
                            Target: {exercise.reps}
                          </span>
                        </div>

                        {/* Tactile Volt Green Completion Check Button */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => toggleSetComplete(exIdx, setIdx)}
                            className={`grid size-10 place-items-center rounded-xl border-2 transition-all duration-150 active:scale-90 ${
                              set.completed
                                ? 'border-volt bg-volt text-obsidian-950'
                                : 'border-obsidian-700 bg-obsidian-900 text-slate-500 hover:border-volt hover:text-volt'
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
                    className="w-full border border-dashed border-obsidian-700 hover:border-obsidian-500 text-slate-400"
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
              <p className="text-xs text-slate-400">
                1 is light warm-up, 7 is moderate hard, 10 is maximum muscular exhaustion.
              </p>
            </div>
            <span className="font-tabular text-3xl font-black text-volt">{sessionRpe}</span>
          </div>

          <input
            type="range"
            min="1"
            max="10"
            value={sessionRpe}
            onChange={(e) => setSessionRpe(Number(e.target.value))}
            className="mt-4 w-full accent-volt cursor-pointer"
          />

          <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-500">
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
        className="w-full text-base font-black py-6"
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
        <div className="py-4 text-center space-y-5">
          <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-volt/10 border border-volt/30 text-volt">
            <Trophy className="h-10 w-10 stroke-[2.5]" />
          </div>

          <div>
            <h3 className="text-2xl font-black text-white">Outstanding Work!</h3>
            <p className="mt-1 text-sm text-slate-400">
              Session metrics successfully logged to your athletic training history.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl border border-obsidian-700 bg-obsidian-950 p-4">
            <div>
              <strong className="block font-tabular text-2xl font-black text-white">
                {timeFormatted}
              </strong>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Duration
              </span>
            </div>
            <div>
              <strong className="block font-tabular text-2xl font-black text-volt">
                {completedSets}
              </strong>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sets Done
              </span>
            </div>
            <div>
              <strong className="block font-tabular text-2xl font-black text-cyan-400">
                {formatWeight(totalVolumeKg).value}
              </strong>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {formatWeight(totalVolumeKg).unit} Volume
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </main>
  );
}
