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
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Square,
  Timer,
  Trophy,
  WifiOff,
  Zap,
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
import { PrehabWarmupSection } from '../components/ui/PrehabWarmupSection';
import { SessionSkeleton } from '../components/ui/Skeleton';
import { resolveExerciseSafetyNotes } from '../services/exercise-safety-notes';
import { soundCueService } from '../services/sound-cue-service';
import { usePreferences } from '../context/PreferencesContext';
import { apiClient } from '../services/api-client';
import { useNetworkSyncStatus, offlineSyncService } from '../services/offline-sync';
import {
  calculateProgressiveOverload,
  type OverloadRecommendation,
} from '../services/progressive-overload';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

interface LoggedSet {
  id?: string;
  setIndex: number;
  setType: SetType;
  weight: number;
  reps: number;
  rpe?: number | null;
  completed: boolean;
  previousPerformance?: { weight: number; reps: number; rpe?: number | null; date?: string } | null;
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
  const { unitSystem, formatWeight, autoStartRestTimer, hapticsEnabled } = usePreferences();
  const { isOnline, pendingSyncCount, isSyncing, syncNow } = useNetworkSyncStatus();

  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [logs, setLogs] = useState<Record<number, LoggedSet[]>>({});
  const [sessionState, setSessionState] = useState<'idle' | 'active' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [sessionRpe, setSessionRpe] = useState(7);
  const [sessionPainScore, setSessionPainScore] = useState(0);
  const [painJointRegion, setPainJointRegion] = useState('Patellar Knee');
  const [painNotes, setPainNotes] = useState('');
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [activeExIdx, setActiveExIdx] = useState(0);

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
  const [limitations, setLimitations] = useState<string[]>([]);

  const navigate = useNavigate();

  // Load Active Plan / Create Session Logs
  useEffect(() => {
    apiClient
      .get<any>('workout-plans/current')
      .then((res) => {
        const root = res?.data || res;
        const plan = root?.plan || root;
        const found = plan?.days?.[0]?.exercises || [];

        const planLimitations = plan?.limitations || root?.limitations || [];
        if (Array.isArray(planLimitations)) {
          setLimitations(planLimitations);
        }

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

        // Seed logs table with initial data and previous performance records
        const initialLogs: Record<number, LoggedSet[]> = {};
        mapped.forEach((ex, exIdx) => {
          const count = ex.sets || 3;
          const targetRepsNum = typeof ex.reps === 'number' ? ex.reps : Number(ex.reps) || 10;
          initialLogs[exIdx] = Array.from({ length: count }, (_, sIdx) => ({
            setIndex: sIdx + 1,
            setType: (sIdx === 0 && count >= 4 ? 'warmup' : 'working') as SetType,
            weight: 20,
            reps: targetRepsNum,
            rpe: ex.rpe || 7,
            completed: false,
            previousPerformance: { weight: 20, reps: targetRepsNum, rpe: 7.5 },
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
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
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

    setActiveExIdx(exIdx);
    const nowComplete = !set.completed;
    updateSet(exIdx, setIdx, { completed: nowComplete });

    if (nowComplete) {
      soundCueService.playSetCompleteBeep();
      if (hapticsEnabled) {
        soundCueService.triggerHaptic('light');
      }

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

  const handleApplyOverload = (exIdx: number, rec: OverloadRecommendation) => {
    setLogs((prev) => ({
      ...prev,
      [exIdx]: (prev[exIdx] || []).map((s) => ({
        ...s,
        weight: rec.recommendedWeightKg > 0 ? rec.recommendedWeightKg : s.weight,
        reps: rec.recommendedReps > 0 ? rec.recommendedReps : s.reps,
      })),
    }));

    if (hapticsEnabled) {
      soundCueService.triggerHaptic('success');
    }
    setToastMessage(`Applied ${rec.type === 'deload' ? 'Deload' : 'Overload'} Target to ${exercises[exIdx]?.name || 'Exercise'}!`);
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

    const payload = {
      durationSeconds: seconds,
      sessionRpe,
      painScore: sessionPainScore,
      jointRegion: sessionPainScore > 0 ? painJointRegion : undefined,
      notes: painNotes || undefined,
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

    // 100% Offline Queuing if network is unavailable
    if (!isOnline) {
      if (sessionPainScore > 4) {
        offlineSyncService.enqueueSyncItem({
          type: 'pain-alert',
          endpoint: 'workout-sessions/pain-alert',
          method: 'POST',
          payload: {
            painScore: sessionPainScore,
            jointRegion: painJointRegion,
            notes: painNotes || 'High-priority pain flare-up recorded during offline workout session.',
          },
        });
      }

      offlineSyncService.enqueueSyncItem({
        type: 'workout-session-complete',
        endpoint: 'workout-logs',
        method: 'POST',
        payload,
      });

      setCompleteModalOpen(true);
      soundCueService.playTimerCompleteChime();
      if (hapticsEnabled) {
        soundCueService.triggerHaptic('complete');
      }
      setSaving(false);
      return;
    }

    try {
      if (sessionPainScore > 4) {
        try {
          await apiClient.post('workout-sessions/pain-alert', {
            painScore: sessionPainScore,
            jointRegion: painJointRegion,
            notes: painNotes || 'High-priority pain flare-up recorded during workout session.',
          });
        } catch (alertErr) {
          console.warn('Failed to transmit pain alert, queuing for sync', alertErr);
          offlineSyncService.enqueueSyncItem({
            type: 'pain-alert',
            endpoint: 'workout-sessions/pain-alert',
            method: 'POST',
            payload: {
              painScore: sessionPainScore,
              jointRegion: painJointRegion,
              notes: painNotes || 'High-priority pain flare-up recorded during workout session.',
            },
          });
        }
      }

      await apiClient.post('workout-logs', payload);
      setCompleteModalOpen(true);
      soundCueService.playTimerCompleteChime();
      if (hapticsEnabled) {
        soundCueService.triggerHaptic('complete');
      }
    } catch (cause) {
      // Graceful offline fallback: if fetch failed, enqueue item
      const isNetError =
        !navigator.onLine ||
        (cause instanceof Error &&
          (cause.message.includes('fetch') || cause.message.includes('Network')));

      if (isNetError) {
        offlineSyncService.enqueueSyncItem({
          type: 'workout-session-complete',
          endpoint: 'workout-logs',
          method: 'POST',
          payload,
        });
        setCompleteModalOpen(true);
        soundCueService.playTimerCompleteChime();
        if (hapticsEnabled) {
          soundCueService.triggerHaptic('complete');
        }
      } else {
        setError(cause instanceof Error ? cause.message : 'Failed to save session.');
      }
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
    return <SessionSkeleton />;
  }

  const nextExercise = exercises[activeExIdx + 1]?.name || exercises[activeExIdx]?.name;

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950">
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-8">
        {error && <Toast type="error" message={error} onClose={() => setError('')} />}
        {toastMessage && (
          <Toast type="success" message={toastMessage} onClose={() => setToastMessage(null)} />
        )}

        {/* 100% Offline Gym Status Indicator */}
        {(!isOnline || pendingSyncCount > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="font-bold">
                ⚡ Offline Gym Mode {!isOnline ? '(Will sync when connected)' : '(Connected)'}
              </span>
              {pendingSyncCount > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[10px] font-black text-amber-300 border border-amber-400/40">
                  {pendingSyncCount} {pendingSyncCount === 1 ? 'item' : 'items'} queued
                </span>
              )}
            </div>

            {isOnline && pendingSyncCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void syncNow()}
                loading={isSyncing}
                className="h-7 border-amber-400/40 bg-amber-950/40 text-[11px] font-black text-amber-200 hover:border-amber-400"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Sync Now
              </Button>
            )}
          </div>
        )}

        {/* Top Active Workout Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
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

        {/* Rest Timer HUD with Voice Announcements & Sound Cues */}
        <RestTimerHUD
          key={restTimerActiveKey}
          initialSeconds={restTimerSeconds}
          nextExerciseName={nextExercise}
        />

        {/* Balanced 2-Column Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          {/* Left Column (8 cols): Exercise Logging Cards & Pain/Effort Sliders */}
          <div className="lg:col-span-8 space-y-5">
            {/* Exercise Cards with Set Logging */}
            <div className="space-y-5">
              {exercises.map((exercise, exIdx) => {
                const safety = exercise.safetyLevel || 'safe';
                const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
                const exerciseSets = logs[exIdx] || [];

                // Calculate progressive overload recommendation for this exercise
                const overloadRec = calculateProgressiveOverload({
                  exerciseName: exercise.name,
                  currentWeightKg: exerciseSets[0]?.weight || 20,
                  currentReps: exerciseSets[0]?.reps || 10,
                  targetReps: exercise.reps,
                  previousPerformance: exerciseSets[0]?.previousPerformance,
                  recentPainScore: sessionPainScore,
                  unitSystem,
                });

                return (
                  <Card key={exercise.id || exIdx} className="overflow-hidden">
                    <CardContent className="p-5">
                      {/* Exercise Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                          <div className="shrink-0">
                            <div className="size-16 sm:size-20 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-1 shadow-sm flex items-center justify-center">
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

                      {/* Progressive Overload / Deload Target Recommendation Chip */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800/90 bg-zinc-950/80 p-2.5 sm:p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl ${
                              overloadRec.badgeVariant === 'amber'
                                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                                : overloadRec.badgeVariant === 'lime'
                                ? 'bg-lime-400/15 text-lime-300 border border-lime-400/30'
                                : 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                            }`}
                            title={overloadRec.reason}
                          >
                            {overloadRec.chipLabel}
                          </span>
                        </div>

                        {overloadRec.isApplicable && (
                          <Button
                            type="button"
                            size="sm"
                            variant={overloadRec.type === 'deload' ? 'outline' : 'volt'}
                            onClick={() => handleApplyOverload(exIdx, overloadRec)}
                            className="h-7 text-xs font-black px-2.5 rounded-lg shrink-0"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {overloadRec.buttonLabel}
                          </Button>
                        )}
                      </div>

                      {/* Set Logging Rows */}
                      <div className="mt-4 space-y-2.5">
                        {exerciseSets.map((set, setIdx) => {
                          const prevText = set.previousPerformance
                            ? `Last: ${set.previousPerformance.weight}${unitSystem === 'metric' ? 'kg' : 'lb'} × ${set.previousPerformance.reps}`
                            : '';

                          return (
                            <div
                              key={setIdx}
                              className={`flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border p-3 transition-all duration-150 sm:gap-3.5 ${
                                set.completed
                                  ? 'border-lime-400/30 bg-lime-400/[0.04]'
                                  : 'border-zinc-800/80 bg-zinc-950/60'
                              }`}
                            >
                              {/* Set Number & Type Toggle */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const types: SetType[] = ['warmup', 'working', 'drop', 'failure'];
                                    const nextType = types[(types.indexOf(set.setType) + 1) % types.length];
                                    updateSet(exIdx, setIdx, { setType: nextType });
                                  }}
                                  className={`grid size-7 place-items-center rounded-lg font-mono text-xs font-black transition-colors ${
                                    set.setType === 'warmup'
                                      ? 'bg-amber-400/20 text-amber-400'
                                      : set.setType === 'drop'
                                      ? 'bg-purple-400/20 text-purple-400'
                                      : set.setType === 'failure'
                                      ? 'bg-red-400/20 text-red-400'
                                      : 'bg-zinc-800 text-zinc-300'
                                  }`}
                                  title={`Set type: ${set.setType} (Click to toggle)`}
                                >
                                  {setTypeLabels[set.setType] || String(setIdx + 1)}
                                </button>

                                <span className="font-mono text-xs font-bold text-zinc-400">
                                  S{setIdx + 1}
                                </span>
                              </div>

                              {/* Weight Stepper */}
                              <div className="flex min-w-[120px] flex-1 flex-col gap-0.5">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjustWeight(exIdx, setIdx, -2.5)}
                                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-lime-400 active:scale-90"
                                    aria-label="Minus 2.5 weight"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>

                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0"
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
                                    aria-label="Plus 2.5 weight"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>

                                <div className="px-0.5 text-center">
                                  <span className="block truncate font-mono text-[10px] text-zinc-500">
                                    {prevText || `${unitSystem === 'metric' ? 'kg' : 'lb'}`}
                                  </span>
                                </div>
                              </div>

                              {/* Reps Stepper */}
                              <div className="flex min-w-[100px] flex-1 flex-col gap-0.5">
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

            {/* Session Effort / Intensity (1-10 Scale) Slider */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white">Overall Session Effort / Intensity</h3>
                    <p className="text-xs text-zinc-400">
                      1 is light warm-up, 7-8 is challenging working volume, 10 is maximum limit.
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

            {/* FEATURE 4.3: Session Joint Discomfort & Pain Rating (0-10) */}
            <Card className={sessionPainScore > 4 ? 'border-red-500/50 bg-red-950/10' : ''}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      <ShieldAlert
                        className={`size-5 ${
                          sessionPainScore > 4
                            ? 'text-red-400 animate-pulse'
                            : sessionPainScore > 0
                            ? 'text-amber-400'
                            : 'text-zinc-500'
                        }`}
                      />
                      Joint Discomfort & Pain Feedback
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Flag any joint impingement or discomfort immediately during training.
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-mono text-3xl font-black tabular-nums ${
                        sessionPainScore > 4
                          ? 'text-red-400'
                          : sessionPainScore > 0
                          ? 'text-amber-400'
                          : 'text-zinc-500'
                      }`}
                    >
                      {sessionPainScore}
                    </span>
                    <span className="text-[10px] block font-mono text-zinc-500">/ 10</span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max="10"
                  value={sessionPainScore}
                  onChange={(e) => setSessionPainScore(Number(e.target.value))}
                  className={`w-full cursor-pointer ${
                    sessionPainScore > 4
                      ? 'accent-red-400'
                      : sessionPainScore > 0
                      ? 'accent-amber-400'
                      : 'accent-zinc-600'
                  }`}
                />

                <div className="flex justify-between text-[11px] font-bold text-zinc-500">
                  <span>0 (Pain-Free)</span>
                  <span>4 (Rehab Tolerance)</span>
                  <span className="text-red-400 font-bold">10 (Severe Pain)</span>
                </div>

                {sessionPainScore > 4 && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-red-400 font-extrabold text-xs">
                      <ShieldAlert className="size-4 shrink-0" />
                      <span>⚠️ High-Priority Pain Spike Detected — Automated Coach Alert</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Specify Joint / Region
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Patellar Knee', 'Lower Back', 'Shoulder', 'Achilles', 'Hip / Groin', 'Neck / Spine', 'Elbow / Wrist'].map((region) => (
                          <button
                            key={region}
                            type="button"
                            onClick={() => setPainJointRegion(region)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                              painJointRegion === region
                                ? 'bg-red-500 text-white border border-red-400'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                            }`}
                          >
                            {region}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Optional brief note (e.g. sharp pinch during bottom eccentric)..."
                        value={painNotes}
                        onChange={(e) => setPainNotes(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3 py-2 text-xs font-medium text-white placeholder:text-zinc-600 focus:border-red-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Finish Session CTA */}
            <Button
              size="lg"
              variant="volt"
              onClick={finishSession}
              loading={saving}
              disabled={!completedSets}
              className="w-full py-6 text-base font-black shadow-lg shadow-lime-400/20"
            >
              <PartyPopper className="h-5 w-5 mr-1" /> Complete Workout Session
            </Button>
          </div>

          {/* Right Column (4 cols): Smart Warm-up & Prehab Generator */}
          <div className="lg:col-span-4 space-y-6">
            {exercises.length > 0 && (
              <PrehabWarmupSection
                exercises={exercises.map((e) => ({
                  name: e.name,
                  movementPattern: e.movementPattern,
                  muscleGroup: e.muscleGroup,
                }))}
                limitations={limitations}
              />
            )}
          </div>
        </div>

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
                {!isOnline || pendingSyncCount > 0
                  ? 'Session saved locally in Offline Gym Mode. It will sync automatically when connected.'
                  : 'Session metrics successfully logged to your athletic training history.'}
              </p>
            </div>

            {sessionPainScore > 4 && (
              <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3.5 text-left text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-red-400 font-extrabold">
                  <ShieldAlert className="size-4 shrink-0" />
                  <span>High-Priority Pain Spike Logged ({sessionPainScore}/10 - {painJointRegion})</span>
                </div>
                <p className="text-[11px] text-zinc-300">
                  Your Physical Therapist has been notified. Check your PT Portal / Messages for clinical directives.
                </p>
              </div>
            )}

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
    </div>
  );
}
