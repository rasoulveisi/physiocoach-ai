import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
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
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';
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
  const [isFinishSurveyOpen, setIsFinishSurveyOpen] = useState(false);
  const [isPrehabOpen, setIsPrehabOpen] = useState(false);

  // Focus Mode: only the active exercise is expanded by default
  const [expandedExIdx, setExpandedExIdx] = useState<number>(0);
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
  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

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
      [exIdx]: (prev[exIdx] || []).map((s, i) => (i === setIdx ? { ...s, ...updates } : s)),
    }));
  };

  const toggleSetComplete = (exIdx: number, setIdx: number) => {
    const currentSets = logs[exIdx] || [];
    const set = currentSets[setIdx];
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

      // Check if all sets for this exercise are now completed
      const remainingSetsInEx = currentSets.filter((s, i) => i !== setIdx && !s.completed);
      if (remainingSetsInEx.length === 0 && exIdx < exercises.length - 1) {
        // Auto-advance to next exercise in Focus Mode
        const nextExName = exercises[exIdx + 1]?.name;
        setTimeout(() => {
          setExpandedExIdx(exIdx + 1);
          setActiveExIdx(exIdx + 1);
          if (nextExName) {
            setToastMessage(`Great job! Advancing to ${nextExName}`);
          }
        }, 400);
      }
    }
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

  const handleOpenFinishModal = () => {
    if (completedSets === 0) {
      setError('Complete at least one set to finish this session.');
      return;
    }
    setIsFinishSurveyOpen(true);
  };

  const finishSession = async () => {
    if (completedSets === 0) {
      setError('Complete at least one set to finish.');
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

      setIsFinishSurveyOpen(false);
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
      setIsFinishSurveyOpen(false);
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
        setIsFinishSurveyOpen(false);
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

  if (exercises.length === 0 && !error) {
    return <SessionSkeleton />;
  }

  const nextExercise = exercises[activeExIdx + 1]?.name || exercises[activeExIdx]?.name;

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950">
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 pb-24">
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

        {/* Top Active Workout HUD Bar */}
        <div className="rounded-2xl sm:rounded-3xl border border-zinc-800 bg-[#121722] p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    sessionState === 'active'
                      ? 'bg-[#10E760] animate-pulse'
                      : sessionState === 'paused'
                      ? 'bg-amber-400'
                      : 'bg-zinc-500'
                  }`}
                />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  {sessionState === 'active'
                    ? 'Session Active'
                    : sessionState === 'paused'
                    ? 'Session Paused'
                    : 'Ready to Train'}
                </span>
              </div>
              <div
                className={`font-mono text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                  sessionState === 'active'
                    ? 'text-[#10E760]'
                    : sessionState === 'paused'
                    ? 'text-amber-400'
                    : 'text-zinc-300'
                }`}
              >
                {timeFormatted}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sessionState === 'idle' ? (
                <Button
                  variant="volt"
                  size="md"
                  pill={true}
                  onClick={handleStartSession}
                  className="font-black px-5 shadow-md shadow-[#10E760]/20"
                >
                  <Play className="mr-1.5 h-4 w-4 fill-current" /> Start
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    pill={true}
                    onClick={handlePauseSession}
                    className="border-zinc-700 hover:border-zinc-500"
                    title={sessionState === 'paused' ? 'Resume workout' : 'Pause workout'}
                  >
                    {sessionState === 'paused' ? (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current mr-1 text-[#10E760]" /> Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5 mr-1 text-zinc-300" /> Pause
                      </>
                    )}
                  </Button>

                  <Button
                    variant="volt"
                    size="sm"
                    pill={true}
                    onClick={handleOpenFinishModal}
                    className="font-bold px-4"
                  >
                    <PartyPopper className="h-3.5 w-3.5 mr-1" /> Finish
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar & Set Counter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 font-bold">
                {completedSets} of {totalSets} Sets Complete
              </span>
              <span className="text-[#10E760] font-black">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
              <div
                className="h-full rounded-full bg-[#10E760] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Rest Timer HUD (Floating / Triggered on set completion) */}
        <RestTimerHUD
          key={restTimerActiveKey}
          initialSeconds={restTimerSeconds}
          nextExerciseName={nextExercise}
        />

        {/* Collapsible Pre-Workout Warm-up & Prehab Drawer */}
        {exercises.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#121722] transition-colors">
            <button
              type="button"
              onClick={() => setIsPrehabOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-zinc-800/20 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 grid place-items-center shrink-0">
                  <Flame className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-white">
                    Pre-Workout Warm-up & Joint Safeguards
                  </h3>
                  <p className="text-[10px] font-mono text-zinc-400">
                    Clinical mobility drills tailored to your injury history (Optional)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
                <span className="text-[11px] font-bold hidden sm:inline">
                  {isPrehabOpen ? 'Hide Drills' : 'View Drills'}
                </span>
                {isPrehabOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </button>

            {isPrehabOpen && (
              <div className="border-t border-zinc-800/80 p-3 sm:p-4 animate-in fade-in duration-150">
                <PrehabWarmupSection
                  exercises={exercises.map((e) => ({
                    name: e.name,
                    movementPattern: e.movementPattern,
                    muscleGroup: e.muscleGroup,
                  }))}
                  limitations={limitations}
                />
              </div>
            )}
          </div>
        )}

        {/* Exercises List in Focus Mode */}
        {exercises.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-[#121722] p-8 text-center space-y-4">
            <div className="mx-auto size-16 rounded-2xl bg-zinc-900 border border-zinc-800 grid place-items-center text-zinc-400">
              <Dumbbell className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No Active Workout Plan</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Activate a workout plan from Explore or build a custom routine to start logging your session.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="volt" size="sm" onClick={() => navigate('/explore')}>
                Browse Plans
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/plans/builder')}>
                Custom Builder
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-3.5">
            {exercises.map((exercise, exIdx) => {
            const safety = exercise.safetyLevel || 'safe';
            const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
            const exerciseSets = logs[exIdx] || [];
            const completedCount = exerciseSets.filter((s) => s.completed).length;
            const isAllComplete = exerciseSets.length > 0 && completedCount === exerciseSets.length;
            const isExpanded = expandedExIdx === exIdx;

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
              <div
                key={exercise.id || exIdx}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  isExpanded
                    ? 'border-[#10E760]/40 bg-[#121722] shadow-lg shadow-black/40'
                    : isAllComplete
                    ? 'border-zinc-800 bg-[#0d121c] opacity-85 hover:opacity-100'
                    : 'border-zinc-800/90 bg-[#121722] hover:border-zinc-700'
                }`}
              >
                {/* Exercise Header Card (Tap to Expand / Collapse) */}
                <div
                  onClick={() => setExpandedExIdx(isExpanded ? -1 : exIdx)}
                  className="p-3 sm:p-4 cursor-pointer select-none transition-colors hover:bg-zinc-800/20"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Exercise Visual Frame (Tap to expand full screen) */}
                      <div
                        className="size-14 sm:size-16 rounded-xl bg-white p-1 shrink-0 border border-zinc-700/60 flex items-center justify-center overflow-hidden shadow-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExerciseVisual
                          name={exercise.name}
                          masterExerciseId={exercise.masterExerciseId || exercise.id}
                          movementPattern={exercise.movementPattern}
                          muscleGroup={exercise.muscleGroup}
                          compact={true}
                        />
                      </div>

                      {/* Exercise Name & Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-black text-[#10E760]">
                            #{exIdx + 1}
                          </span>
                          <h2 className="text-xs sm:text-sm font-extrabold text-white capitalize leading-tight truncate">
                            {exercise.name}
                          </h2>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {exercise.muscleGroup && (
                            <span className="rounded bg-[#10E760]/10 border border-[#10E760]/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-[#10E760]">
                              {exercise.muscleGroup}
                            </span>
                          )}
                          {exercise.movementPattern && (
                            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-zinc-300">
                              {exercise.movementPattern.replace(/_/g, ' ')}
                            </span>
                          )}

                          {/* Progress Status Pill */}
                          {isAllComplete ? (
                            <span className="rounded-md bg-[#10E760]/15 border border-[#10E760]/30 px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#10E760]">
                              ✓ Done ({completedCount}/{exerciseSets.length})
                            </span>
                          ) : (
                            <span className="rounded-md bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[9px] font-mono font-bold text-zinc-400">
                              {completedCount}/{exerciseSets.length} Sets
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Tools & Chevron */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip content="Barbell Plate Calculator">
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
                          className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                        >
                          <Dumbbell className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>

                      <Tooltip content="Swap Exercise">
                        <button
                          type="button"
                          onClick={() => setSwapTargetIndex(exIdx)}
                          className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
                        >
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>

                      <button
                        type="button"
                        onClick={() => setExpandedExIdx(isExpanded ? -1 : exIdx)}
                        className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Sets Workspace */}
                {isExpanded && (
                  <div className="border-t border-zinc-800/80 bg-[#090D15]/60 p-3 sm:p-4 space-y-3 animate-in fade-in duration-150">
                    {/* Progressive Overload Recommendation Chip */}
                    {overloadRec.isApplicable && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-[#121722] p-2 sm:p-2.5">
                        <div className="min-w-0 flex-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                              overloadRec.badgeVariant === 'amber'
                                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                                : overloadRec.badgeVariant === 'lime'
                                ? 'bg-[#10E760]/15 text-[#10E760] border border-[#10E760]/30'
                                : 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                            }`}
                          >
                            <Zap className="h-3 w-3" />
                            {overloadRec.chipLabel}
                          </span>
                          <p className="mt-0.5 text-[10px] font-mono text-zinc-400 truncate">
                            {overloadRec.reason}
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="xs"
                          variant={overloadRec.type === 'deload' ? 'outline' : 'volt'}
                          onClick={() => handleApplyOverload(exIdx, overloadRec)}
                          className="font-bold text-[10px] h-7 px-2.5 shrink-0"
                        >
                          {overloadRec.buttonLabel}
                        </Button>
                      </div>
                    )}

                    {/* Compact Single-Row Sets Table */}
                    <div className="space-y-1.5">
                      {/* Sets Table Header */}
                      <div className="grid grid-cols-12 gap-1.5 sm:gap-2 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 items-center">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-3 sm:col-span-2">Type</div>
                        <div className="col-span-3 sm:col-span-3 text-center sm:text-left">Previous</div>
                        <div className="col-span-2 sm:col-span-2 text-center">
                          {unitSystem === 'metric' ? 'Kg' : 'Lb'}
                        </div>
                        <div className="col-span-2 sm:col-span-2 text-center">Reps</div>
                        <div className="col-span-1 sm:col-span-3 text-center sm:text-right">✓</div>
                      </div>

                      {/* Sets Rows */}
                      {exerciseSets.map((set, setIdx) => {
                        const prevText = set.previousPerformance
                          ? `${set.previousPerformance.weight}${unitSystem === 'metric' ? 'kg' : 'lb'} × ${set.previousPerformance.reps}`
                          : '—';

                        return (
                          <div
                            key={setIdx}
                            className={`grid grid-cols-12 gap-1.5 sm:gap-2 items-center rounded-xl border p-1.5 sm:p-2 transition-all ${
                              set.completed
                                ? 'border-[#10E760]/40 bg-[#10E760]/[0.05]'
                                : 'border-zinc-800/80 bg-[#121722] hover:border-zinc-700'
                            }`}
                          >
                            {/* Set # */}
                            <div className="col-span-1 text-center font-mono text-xs font-bold text-zinc-400">
                              {setIdx + 1}
                            </div>

                            {/* Set Type Dropdown */}
                            <div className="col-span-3 sm:col-span-2">
                              <select
                                value={set.setType}
                                onChange={(e) =>
                                  updateSet(exIdx, setIdx, { setType: e.target.value as SetType })
                                }
                                className={`w-full rounded-lg border px-1 py-1 text-[10px] font-bold outline-none cursor-pointer ${
                                  set.setType === 'warmup'
                                    ? 'bg-amber-950/40 text-amber-400 border-amber-500/30'
                                    : set.setType === 'drop'
                                    ? 'bg-purple-950/40 text-purple-400 border-purple-500/30'
                                    : set.setType === 'failure'
                                    ? 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                                    : 'bg-zinc-900 text-zinc-300 border-zinc-800'
                                }`}
                              >
                                <option value="working" className="bg-[#121722] text-zinc-200">
                                  Work
                                </option>
                                <option value="warmup" className="bg-[#121722] text-amber-400">
                                  Warm
                                </option>
                                <option value="drop" className="bg-[#121722] text-purple-400">
                                  Drop
                                </option>
                                <option value="failure" className="bg-[#121722] text-rose-400">
                                  Fail
                                </option>
                              </select>
                            </div>

                            {/* Previous Performance */}
                            <div
                              className="col-span-3 sm:col-span-3 truncate text-center sm:text-left font-mono text-[10px] text-zinc-400"
                              title={prevText}
                            >
                              {prevText}
                            </div>

                            {/* Weight Numeric Input */}
                            <div className="col-span-2 sm:col-span-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={set.weight}
                                onChange={(e) =>
                                  updateSet(exIdx, setIdx, { weight: Number(e.target.value) })
                                }
                                className="w-full rounded-lg border border-zinc-800 bg-[#090D15] px-1 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                              />
                            </div>

                            {/* Reps Numeric Input */}
                            <div className="col-span-2 sm:col-span-2">
                              <input
                                type="number"
                                min="0"
                                value={set.reps}
                                onChange={(e) =>
                                  updateSet(exIdx, setIdx, { reps: Number(e.target.value) })
                                }
                                className="w-full rounded-lg border border-zinc-800 bg-[#090D15] px-1 py-1 text-xs font-mono font-bold text-white text-center outline-none focus:border-[#10E760]"
                              />
                            </div>

                            {/* Complete Check Button */}
                            <div className="col-span-1 sm:col-span-3 flex justify-center sm:justify-end">
                              <button
                                type="button"
                                onClick={() => toggleSetComplete(exIdx, setIdx)}
                                className={`size-8 sm:size-9 grid place-items-center rounded-xl border transition-all active:scale-95 cursor-pointer ${
                                  set.completed
                                    ? 'bg-[#10E760] text-zinc-950 border-[#10E760] shadow-[0_0_12px_rgba(16,231,96,0.35)]'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                                }`}
                                title={set.completed ? 'Set completed' : 'Mark set as completed'}
                              >
                                <Check className="h-4 w-4 stroke-[3]" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Bar: Add Set + Next Exercise */}
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleAddSet(exIdx)}
                        className="border border-dashed border-zinc-800 text-zinc-400 hover:border-zinc-700 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Set
                      </Button>

                      {exIdx < exercises.length - 1 && (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => {
                            setExpandedExIdx(exIdx + 1);
                            setActiveExIdx(exIdx + 1);
                          }}
                          className="text-xs font-bold"
                        >
                          <span>Next: {exercises[exIdx + 1]?.name}</span>
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* Bottom Finish Workout Trigger */}
        <div className="pt-2">
          <Button
            size="lg"
            variant="volt"
            onClick={handleOpenFinishModal}
            disabled={!completedSets}
            className="w-full py-4 sm:py-5 text-sm sm:text-base font-black shadow-lg shadow-[#10E760]/20"
          >
            <PartyPopper className="h-5 w-5 mr-1.5" /> Finish Workout ({completedSets}/{totalSets} Sets)
          </Button>
        </div>

        {/* Post-Workout Intensity & Pain Survey Modal */}
        <Modal
          open={isFinishSurveyOpen}
          title="Finish Workout Session"
          onClose={() => setIsFinishSurveyOpen(false)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsFinishSurveyOpen(false)}
                className="text-zinc-400"
              >
                Keep Training
              </Button>
              <Button
                variant="volt"
                size="md"
                onClick={finishSession}
                loading={saving}
                className="font-black px-5"
              >
                Save & Complete
              </Button>
            </div>
          }
        >
          <div className="space-y-5 py-2">
            {/* Quick Session Stats */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-800 bg-[#121722] p-3 text-center">
              <div>
                <strong className="block font-mono text-lg font-black text-white">{timeFormatted}</strong>
                <span className="text-[10px] font-bold uppercase text-zinc-500">Duration</span>
              </div>
              <div>
                <strong className="block font-mono text-lg font-black text-[#10E760]">{completedSets}</strong>
                <span className="text-[10px] font-bold uppercase text-zinc-500">Sets Done</span>
              </div>
              <div>
                <strong className="block font-mono text-lg font-black text-cyan-400">
                  {formatWeight(totalVolumeKg).value}
                </strong>
                <span className="text-[10px] font-bold uppercase text-zinc-500">
                  {formatWeight(totalVolumeKg).unit} Volume
                </span>
              </div>
            </div>

            {/* Effort / Intensity (RPE 1-10) */}
            <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-white">Workout Intensity / Effort</h4>
                  <p className="text-[11px] text-zinc-400">How demanding was this session overall?</p>
                </div>
                <span className="font-mono text-2xl font-black text-[#10E760]">{sessionRpe}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={sessionRpe}
                onChange={(e) => setSessionRpe(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#10E760]"
              />
              <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-500">
                <span>Easy (1–3)</span>
                <span>Target (7–8)</span>
                <span>Max Effort (10)</span>
              </div>
            </div>

            {/* Joint Pain & Discomfort Rating (0-10) */}
            <div
              className={`rounded-2xl border p-4 space-y-2.5 ${
                sessionPainScore > 4
                  ? 'border-red-500/50 bg-red-950/20'
                  : 'border-zinc-800 bg-[#121722]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <ShieldAlert
                      className={`size-4 ${
                        sessionPainScore > 4
                          ? 'text-red-400 animate-pulse'
                          : sessionPainScore > 0
                          ? 'text-amber-400'
                          : 'text-zinc-500'
                      }`}
                    />
                    Joint Discomfort & Pain
                  </h4>
                  <p className="text-[11px] text-zinc-400">Did you feel any joint pinching or ache?</p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono text-2xl font-black ${
                      sessionPainScore > 4
                        ? 'text-red-400'
                        : sessionPainScore > 0
                        ? 'text-amber-400'
                        : 'text-zinc-400'
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
              <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-500">
                <span>0 (Pain-Free)</span>
                <span>4 (Rehab Tolerance)</span>
                <span className="text-red-400">10 (Severe Pain)</span>
              </div>

              {sessionPainScore > 4 && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 space-y-2.5 mt-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-red-400 font-extrabold text-xs">
                    <ShieldAlert className="size-4 shrink-0" />
                    <span>⚠️ High-Priority Pain Spike Detected</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Specify Joint Region
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {[
                        'Patellar Knee',
                        'Lower Back',
                        'Shoulder',
                        'Achilles',
                        'Hip / Groin',
                        'Neck / Spine',
                        'Elbow / Wrist',
                      ].map((region) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setPainJointRegion(region)}
                          className={`rounded-lg px-2 py-0.5 text-xs font-bold transition-all ${
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
                      placeholder="Optional brief note for coach (e.g. sharp pinch during bottom eccentric)..."
                      value={painNotes}
                      onChange={(e) => setPainNotes(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-[#090D15] px-3 py-1.5 text-xs font-medium text-white placeholder:text-zinc-600 focus:border-red-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>

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
            <Button
              variant="volt"
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="w-full font-black"
            >
              Back to Dashboard
            </Button>
          }
        >
          <div className="space-y-5 py-4 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-3xl border border-[#10E760]/30 bg-[#10E760]/10 text-[#10E760]">
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

            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-zinc-800 bg-[#121722] p-4">
              <div>
                <strong className="block font-mono text-2xl font-black tabular-nums text-white">
                  {timeFormatted}
                </strong>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Duration
                </span>
              </div>
              <div>
                <strong className="block font-mono text-2xl font-black tabular-nums text-[#10E760]">
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
