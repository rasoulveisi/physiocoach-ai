import { useEffect, useMemo, useState, useRef, type TouchEvent } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dumbbell,
  Flame,
  Info,
  PartyPopper,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Trophy,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { RestTimerHUD } from '../components/ui/RestTimerHUD';
import { PlateCalculatorModal } from '../components/ui/PlateCalculatorModal';
import { PrescriptionActionSheet, type ParsedPrescriptionSet } from '../components/ui/PrescriptionActionSheet';
import { ExerciseSwapModal, type SwapCandidateItem } from '../components/ui/ExerciseSwapModal';
import { PrehabWarmupSection } from '../components/ui/PrehabWarmupSection';
import { SessionSkeleton } from '../components/ui/Skeleton';
import { soundCueService } from '../services/sound-cue-service';
import { usePreferences } from '../context/PreferencesContext';
import { apiClient } from '../services/api-client';
import { useNetworkSyncStatus, offlineSyncService } from '../services/offline-sync';
import {
  calculateProgressiveOverload,
  type OverloadRecommendation,
} from '../services/progressive-overload';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export interface LoggedSet {
  id?: string;
  setIndex: number;
  setType: SetType;
  weight: number;
  reps: number;
  rpe?: number | null;
  completed: boolean;
  previousPerformance?: { weight: number; reps: number; rpe?: number | null; date?: string } | null;
}

export interface SessionExercise {
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
  notes?: string | null;
}

export interface WorkoutDayView {
  dayNumber: number;
  name: string;
  focus?: string;
  estimatedDurationMinutes?: number;
  exercises: any[];
}

export function SessionPage() {
  const { unitSystem, formatWeight, autoStartRestTimer, hapticsEnabled } = usePreferences();
  const { isOnline, pendingSyncCount, isSyncing, syncNow } = useNetworkSyncStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Multi-day & Active Plan State
  const [plan, setPlan] = useState<any | null>(null);
  const [planDays, setPlanDays] = useState<WorkoutDayView[]>([]);
  const [planTitle, setPlanTitle] = useState<string>('Active Routine');
  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);
  const [pendingDaySwitch, setPendingDaySwitch] = useState<number | null>(null);

  // Day Swiper Touch Gestures & Ribbon Ref
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const dayRibbonRef = useRef<HTMLDivElement | null>(null);

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
  const [loading, setLoading] = useState(true);
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

  // Prescription & RIR Action Sheet State
  const [prescriptionTargetExIdx, setPrescriptionTargetExIdx] = useState<number | null>(null);
  const prescriptionTarget = prescriptionTargetExIdx !== null ? exercises[prescriptionTargetExIdx] : null;

  // Function to load a specific day's exercises and initialize set logs
  const loadDay = (targetDay: WorkoutDayView, showToast = false) => {
    const dayNum = targetDay.dayNumber || 1;
    setActiveDayNumber(dayNum);
    const found = targetDay.exercises || [];

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
      notes: ex.notes || null,
    }));

    setExercises(mapped);

    // Seed logs table with initial data and previous performance records
    const initialLogs: Record<number, LoggedSet[]> = {};
    mapped.forEach((ex, exIdx) => {
      const count = Math.max(1, ex.sets || 3);
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
    setExpandedExIdx(0);
    setActiveExIdx(0);
    setSeconds(0);
    setSessionState('idle');
    setSearchParams({ day: String(dayNum) }, { replace: true });

    if (showToast) {
      const label = targetDay.name || targetDay.focus || `Day ${dayNum}`;
      setToastMessage(`Switched to Day ${dayNum}: ${label}`);
    }
  };

  // Load Active Plan & Determine Selected Day
  useEffect(() => {
    setLoading(true);
    apiClient
      .get<any>('workout-plans/current')
      .then((res) => {
        const root = res?.data || res;
        const loadedPlan = root?.plan || root;
        const days: WorkoutDayView[] = loadedPlan?.days || [];

        setPlan(loadedPlan);
        setPlanDays(days);
        setPlanTitle(loadedPlan?.name || root?.title || 'Active Workout Routine');

        const planLimitations = loadedPlan?.limitations || root?.limitations || [];
        if (Array.isArray(planLimitations)) {
          setLimitations(planLimitations);
        }

        // Populate Candidate list from all days of the plan for swapping
        const candidatePool: SwapCandidateItem[] = [];
        const seen = new Set<string>();
        for (const d of days) {
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

        // Determine target day based on URL search params, location state, or weekday match
        const dayParam = searchParams.get('day');
        const dayIdxParam = searchParams.get('dayIndex');
        const stateDayNumber = (location.state as any)?.dayNumber;
        const stateDayIndex = (location.state as any)?.dayIndex;

        let targetDay: WorkoutDayView | undefined;
        if (dayParam) {
          targetDay = days.find((d) => String(d.dayNumber) === dayParam);
        } else if (stateDayNumber) {
          targetDay = days.find((d) => d.dayNumber === Number(stateDayNumber));
        } else if (dayIdxParam !== null && dayIdxParam !== undefined && days[Number(dayIdxParam)]) {
          targetDay = days[Number(dayIdxParam)];
        } else if (stateDayIndex !== null && stateDayIndex !== undefined && days[Number(stateDayIndex)]) {
          targetDay = days[Number(stateDayIndex)];
        }

        if (!targetDay && days.length > 0) {
          const todayName = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date()).toLowerCase();
          targetDay = days.find((d) => (d.name || d.focus || '').toLowerCase().includes(todayName)) || days[0];
        }

        if (targetDay) {
          loadDay(targetDay, false);
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not initialize session.');
      })
      .finally(() => {
        setLoading(false);
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

  // Request to switch day: warns if active/logged, else switches instantly
  const handleRequestSwitchDay = (dayNumber: number) => {
    if (dayNumber === activeDayNumber) return;
    const targetDay = planDays.find((d) => d.dayNumber === dayNumber) || planDays[dayNumber - 1];
    if (!targetDay) return;

    if (sessionState === 'active' || completedSets > 0) {
      setPendingDaySwitch(dayNumber);
    } else {
      loadDay(targetDay, true);
    }
  };

  const confirmSwitchDay = () => {
    if (pendingDaySwitch !== null) {
      const targetDay = planDays.find((d) => d.dayNumber === pendingDaySwitch) || planDays[pendingDaySwitch - 1];
      if (targetDay) {
        loadDay(targetDay, true);
      }
      setPendingDaySwitch(null);
    }
  };

  // Auto-scroll active day card into center of ribbon when changed
  useEffect(() => {
    if (!dayRibbonRef.current) return;
    const activeEl = dayRibbonRef.current.querySelector<HTMLElement>('[data-active-day="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeDayNumber]);

  // Direction-Locked Touch Gesture Handler for Day Swiper
  const handleTouchStart = (e: TouchEvent) => {
    if (prescriptionTarget || plateCalcTarget || swapTargetIndex !== null || completeModalOpen) {
      return;
    }
    const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (targetTag === 'input' || targetTag === 'select' || targetTag === 'textarea') {
      return;
    }
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (prescriptionTarget || plateCalcTarget || swapTargetIndex !== null || completeModalOpen) {
      return;
    }
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - endX;
    const deltaY = touchStartY.current - endY;

    // Direction-locked horizontal swipe: minimum 50px swipe, horizontal angle > 1.6x vertical
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.6) {
      if (planDays.length <= 1) return;
      const currentIdx = planDays.findIndex((d) => d.dayNumber === activeDayNumber);
      if (currentIdx === -1) return;

      if (deltaX > 0 && currentIdx < planDays.length - 1) {
        // Swiped Left -> Advance to Next Day
        handleRequestSwitchDay(planDays[currentIdx + 1].dayNumber);
      } else if (deltaX < 0 && currentIdx > 0) {
        // Swiped Right -> Go back to Previous Day
        handleRequestSwitchDay(planDays[currentIdx - 1].dayNumber);
      }
    }
  };

  const updateSet = (exIdx: number, setIdx: number, updates: Partial<LoggedSet>) => {
    setLogs((prev) => ({
      ...prev,
      [exIdx]: (prev[exIdx] || []).map((s, i) => (i === setIdx ? { ...s, ...updates } : s)),
    }));
  };

  // Ergonomic Weight Stepper (+/- 2.5kg or 5lb)
  const stepWeight = (exIdx: number, setIdx: number, delta: number) => {
    const currentSet = logs[exIdx]?.[setIdx];
    if (!currentSet) return;
    const newWeight = Math.max(0, Math.round((currentSet.weight + delta) * 10) / 10);
    updateSet(exIdx, setIdx, { weight: newWeight });
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
  };

  // Ergonomic Reps Stepper (+/- 1 rep)
  const stepReps = (exIdx: number, setIdx: number, delta: number) => {
    const currentSet = logs[exIdx]?.[setIdx];
    if (!currentSet) return;
    const newReps = Math.max(0, currentSet.reps + delta);
    updateSet(exIdx, setIdx, { reps: newReps });
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
  };

  // Fast Set Type Cycling (Working -> Warmup -> Drop -> Failure)
  const cycleSetType = (exIdx: number, setIdx: number) => {
    const currentSet = logs[exIdx]?.[setIdx];
    if (!currentSet) return;
    const sequence: SetType[] = ['working', 'warmup', 'drop', 'failure'];
    const nextIdx = (sequence.indexOf(currentSet.setType) + 1) % sequence.length;
    updateSet(exIdx, setIdx, { setType: sequence[nextIdx] });
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
  };

  // Fast Set RIR Cycling (RIR 2 -> RIR 1 -> RIR 0 -> RIR 3)
  const cycleSetRir = (exIdx: number, setIdx: number) => {
    const currentSet = logs[exIdx]?.[setIdx];
    if (!currentSet) return;
    const currentRir = Math.max(0, Math.min(4, Math.round(10 - (currentSet.rpe || 8))));
    const cycleMap: Record<number, number> = { 3: 2, 2: 1, 1: 0, 0: 3 };
    const nextRir = cycleMap[currentRir] !== undefined ? cycleMap[currentRir] : 2;
    const nextRpe = 10 - nextRir;

    updateSet(exIdx, setIdx, { rpe: nextRpe });
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
  };

  // Handle Prescription & RIR Sheet Updates
  const handleUpdatePrescription = (
    exIdx: number,
    updatedNotes: string,
    updatedSets: ParsedPrescriptionSet[],
  ) => {
    // 1. Update exercise notes
    setExercises((prev) => {
      const next = [...prev];
      if (next[exIdx]) {
        next[exIdx] = {
          ...next[exIdx],
          notes: updatedNotes,
        };
      }
      return next;
    });

    // 2. Update sets logs with target RPE (RPE = 10 - RIR)
    setLogs((prev) => {
      const current = prev[exIdx] || [];
      const updated = current.map((s, idx) => {
        const matchPresc = updatedSets[idx] || updatedSets[updatedSets.length - 1];
        if (!matchPresc?.rir) return s;
        const numMatch = matchPresc.rir.match(/([0-9.]+)/);
        const rirVal = numMatch ? parseFloat(numMatch[1]) : 2;
        const newRpe = Math.max(5, Math.min(10, 10 - rirVal));
        return {
          ...s,
          rpe: newRpe,
        };
      });

      return {
        ...prev,
        [exIdx]: updated,
      };
    });

    setPrescriptionTargetExIdx(null);
    setToastMessage(`Prescription & RIR updated for ${exercises[exIdx]?.name}`);
  };

  // 1-Tap Copy from Target or Previous Performance
  const copyPreviousPerformance = (exIdx: number, setIdx: number) => {
    const currentSet = logs[exIdx]?.[setIdx];
    if (!currentSet || !currentSet.previousPerformance) return;
    updateSet(exIdx, setIdx, {
      weight: currentSet.previousPerformance.weight,
      reps: currentSet.previousPerformance.reps,
      rpe: currentSet.previousPerformance.rpe ?? currentSet.rpe,
    });
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('success');
    }
    setToastMessage(
      `Copied target (${currentSet.previousPerformance.weight}${unitSystem === 'metric' ? 'kg' : 'lb'} × ${currentSet.previousPerformance.reps}) to Set ${setIdx + 1}`,
    );
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

  // Add Set: duplicates weight & reps from preceding set
  const handleAddSet = (exIdx: number) => {
    const currentSets = logs[exIdx] || [];
    const lastSet = currentSets[currentSets.length - 1];
    const newSet: LoggedSet = {
      setIndex: currentSets.length + 1,
      setType: 'working',
      weight: lastSet ? lastSet.weight : 20,
      reps: lastSet ? lastSet.reps : 10,
      rpe: lastSet?.rpe || 7,
      completed: false,
      previousPerformance: lastSet?.previousPerformance,
    };
    setLogs((prev) => ({ ...prev, [exIdx]: [...currentSets, newSet] }));
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
  };

  // Delete Set: removes selected set and reindexes
  const handleDeleteSet = (exIdx: number, setIdx: number) => {
    setLogs((prev) => {
      const currentSets = prev[exIdx] || [];
      if (currentSets.length <= 1) return prev;
      const filtered = currentSets.filter((_, i) => i !== setIdx);
      const reindexed = filtered.map((s, i) => ({ ...s, setIndex: i + 1 }));
      return { ...prev, [exIdx]: reindexed };
    });
    if (hapticsEnabled) {
      soundCueService.triggerHaptic('light');
    }
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
      dayNumber: activeDayNumber,
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

  if (loading && exercises.length === 0) {
    return <SessionSkeleton />;
  }

  const nextExercise = exercises[activeExIdx + 1]?.name || exercises[activeExIdx]?.name;

  return (
    <div
      className="flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5 pb-28">
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
                ⚡ Offline {!isOnline ? '(Sync when connected)' : '(Connected)'}
              </span>
              {pendingSyncCount > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-mono text-[10px] font-black text-amber-300 border border-amber-400/40">
                  {pendingSyncCount} queued
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
                <RefreshCw className="h-3 w-3 mr-1" /> Sync
              </Button>
            )}
          </div>
        )}

        {/* Active Plan & Easy Day Selection Ribbon / Swiper */}
        {planDays.length > 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-3 sm:p-4 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2 rounded-full bg-[#10E760] shrink-0" />
                <h2 className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {planTitle}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                  Swipe ‹ › to change days
                </span>
                <span className="text-[10px] font-mono font-bold text-[#10E760] bg-[#10E760]/10 border border-[#10E760]/20 px-2 py-0.5 rounded-full">
                  Day {activeDayNumber} of {planDays.length}
                </span>
              </div>
            </div>

            {/* Scrollable Day Pills Bar with Navigation Controls */}
            <div className="flex items-center gap-1.5">
              {/* Previous Day Chevron Arrow */}
              {planDays.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = planDays.findIndex((d) => d.dayNumber === activeDayNumber);
                    if (currentIdx > 0) {
                      handleRequestSwitchDay(planDays[currentIdx - 1].dayNumber);
                    }
                  }}
                  disabled={activeDayNumber === planDays[0]?.dayNumber}
                  className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
                  title="Previous Day"
                  aria-label="Previous Day"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}

              {/* Day Swiper Track */}
              <div
                ref={dayRibbonRef}
                className="flex-1 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x"
              >
                {planDays.map((d) => {
                  const isActive = d.dayNumber === activeDayNumber;
                  const shortName =
                    d.name?.replace(/day\s*\d+[:\-–\s]*/i, '').trim() ||
                    d.focus ||
                    `Day ${d.dayNumber}`;
                  const exCount = d.exercises?.length || 0;

                  return (
                    <button
                      key={d.dayNumber}
                      data-active-day={isActive ? 'true' : 'false'}
                      type="button"
                      onClick={() => handleRequestSwitchDay(d.dayNumber)}
                      className={`flex items-center gap-2.5 shrink-0 rounded-xl px-3 py-2 text-left transition-all snap-start cursor-pointer border ${
                        isActive
                          ? 'border-[#10E760] bg-[#10E760]/10 text-white shadow-md shadow-[#10E760]/15 ring-1 ring-[#10E760]/60'
                          : 'border-zinc-800 bg-[#090D15] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div
                        className={`size-6 rounded-lg font-mono text-[11px] font-black grid place-items-center ${
                          isActive ? 'bg-[#10E760] text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {d.dayNumber}
                      </div>
                      <div className="min-w-0 max-w-[120px] sm:max-w-[160px]">
                        <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                          {shortName}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500">
                          {exCount} {exCount === 1 ? 'exercise' : 'exercises'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Next Day Chevron Arrow */}
              {planDays.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIdx = planDays.findIndex((d) => d.dayNumber === activeDayNumber);
                    if (currentIdx !== -1 && currentIdx < planDays.length - 1) {
                      handleRequestSwitchDay(planDays[currentIdx + 1].dayNumber);
                    }
                  }}
                  disabled={activeDayNumber === planDays[planDays.length - 1]?.dayNumber}
                  className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
                  title="Next Day"
                  aria-label="Next Day"
                >
                  <ChevronRight className="size-4" />
                </button>
              )}
            </div>
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
                {completedSets}/{totalSets} Sets Completed
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
                    Warm-up & Mobility
                  </h3>
                  <p className="text-[10px] font-mono text-zinc-400">
                    Optional drills (3 min)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
                <span className="text-[11px] font-bold hidden sm:inline">
                  {isPrehabOpen ? 'Hide' : 'View'}
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
              <h3 className="text-base font-bold text-white">No Exercises Found</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                No exercises registered for Day {activeDayNumber}. Switch days above or explore routines.
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
                        {/* Exercise Visual Frame - Enlarged with vertical tools */}
                        <div
                          className="size-16 sm:size-20 rounded-2xl bg-white p-1.5 shrink-0 border border-zinc-700/60 flex items-center justify-center overflow-hidden shadow-sm"
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs font-black text-[#10E760] shrink-0">
                              #{exIdx + 1}
                            </span>
                            <h2 className="text-xs sm:text-sm font-extrabold text-white capitalize leading-tight truncate">
                              {exercise.name}
                            </h2>
                            <span
                              className={`inline-flex items-center justify-center size-5 rounded-md text-zinc-400 hover:text-white transition-all duration-200 shrink-0 ${
                                isExpanded ? 'rotate-180 text-[#10E760]' : ''
                              }`}
                              title={isExpanded ? 'Collapse exercise' : 'Expand exercise'}
                              aria-label={isExpanded ? 'Collapse exercise' : 'Expand exercise'}
                            >
                              <ChevronDown className="size-3.5" />
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {exercise.muscleGroup && (
                              <span className="rounded bg-[#10E760]/10 border border-[#10E760]/20 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-[#10E760]">
                                {exercise.muscleGroup}
                              </span>
                            )}
                            {exercise.movementPattern && (
                              <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-zinc-300 hidden sm:inline-flex">
                                {exercise.movementPattern.replace(/_/g, ' ')}
                              </span>
                            )}

                            {/* Single clean Target prescription badge - Clickable to open & edit RIR */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrescriptionTargetExIdx(exIdx);
                              }}
                              className="rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-1.5 py-0.5 text-[9px] font-mono font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Click to view & edit Target Prescription & RIR"
                            >
                              <span>Target: {exercise.sets || 3} × {exercise.reps || 10}</span>
                              <span className="text-[#10E760]">@ RIR {Math.max(0, Math.min(5, 10 - (exerciseSets[0]?.rpe || exercise.rpe || 8)))}</span>
                            </button>

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

                      {/* Vertical Action Column: Exactly scaled to match thumbnail & text height */}
                      <div
                        className="flex flex-col items-center justify-center gap-1 shrink-0 self-center"
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
                            className="size-6 sm:size-7 grid place-items-center rounded-lg sm:rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                            title="Plate Calculator"
                            aria-label="Plate Calculator"
                          >
                            <Dumbbell className="size-3 sm:size-3.5" />
                          </button>
                        </Tooltip>

                        <Tooltip content="Swap Exercise">
                          <button
                            type="button"
                            onClick={() => setSwapTargetIndex(exIdx)}
                            className="size-6 sm:size-7 grid place-items-center rounded-lg sm:rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                            title="Swap Exercise"
                            aria-label="Swap Exercise"
                          >
                            <ArrowLeftRight className="size-3 sm:size-3.5" />
                          </button>
                        </Tooltip>

                        <Tooltip content="Prescription & RIR Guide">
                          <button
                            type="button"
                            onClick={() => setPrescriptionTargetExIdx(exIdx)}
                            className="size-6 sm:size-7 grid place-items-center rounded-lg sm:rounded-xl bg-zinc-900 border border-zinc-800 text-[#10E760] hover:bg-[#10E760]/15 hover:border-[#10E760]/40 transition-colors cursor-pointer"
                            title="Prescription & RIR Guide"
                            aria-label="Prescription & RIR Guide"
                          >
                            <Info className="size-3 sm:size-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Sets Workspace */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800/80 bg-[#090D15]/60 p-3 sm:p-4 space-y-3 animate-in fade-in duration-150">
                      {/* Progressive Overload Recommendation Chip */}
                      {overloadRec.isApplicable && (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-[#121722] px-3 py-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Zap
                              className={`h-3.5 w-3.5 shrink-0 ${
                                overloadRec.badgeVariant === 'amber'
                                  ? 'text-amber-400'
                                  : overloadRec.badgeVariant === 'lime'
                                  ? 'text-[#10E760]'
                                  : 'text-cyan-400'
                              }`}
                            />
                            <span className="font-mono text-xs font-bold text-zinc-200 truncate">
                              {overloadRec.chipLabel.replace(/^Target:\s*/i, 'Overload: ')}
                            </span>
                          </div>

                          <Button
                            type="button"
                            size="xs"
                            variant={overloadRec.type === 'deload' ? 'outline' : 'volt'}
                            onClick={() => handleApplyOverload(exIdx, overloadRec)}
                            className="font-bold text-xs h-7 px-3 shrink-0"
                          >
                            Apply
                          </Button>
                        </div>
                      )}

                      {/* Ergonomic Sets Table */}
                      <div className="space-y-1.5">
                        {/* Sets Table Header: Clean 4 columns without redundant Target */}
                        <div className="grid grid-cols-[36px_1fr_1fr_auto] gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 items-center">
                          <div className="text-center">Set</div>
                          <div className="text-center">{unitSystem === 'metric' ? 'Kg' : 'Lb'}</div>
                          <div className="text-center">Reps</div>
                          <div className="text-right pr-2 min-w-[70px]">Done</div>
                        </div>

                        {/* Sets Rows */}
                        {exerciseSets.map((set, setIdx) => {
                          return (
                            <div
                              key={setIdx}
                              className={`grid grid-cols-[36px_1fr_1fr_auto] gap-1.5 sm:gap-2 items-center rounded-xl border p-1.5 sm:p-2 transition-all ${
                                set.completed
                                  ? 'border-[#10E760]/40 bg-[#10E760]/[0.06] shadow-sm shadow-[#10E760]/5'
                                  : 'border-zinc-800/80 bg-[#121722] hover:border-zinc-700'
                              }`}
                            >
                              {/* 1. Set # and Set Type Cycle Badge */}
                              <div className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => cycleSetType(exIdx, setIdx)}
                                  title={`Set ${setIdx + 1} (${set.setType.toUpperCase()}) - Tap to toggle Type (Work / Warm / Drop / Fail)`}
                                  className={`size-8 sm:size-9 rounded-lg font-mono text-xs font-black transition-all active:scale-90 flex items-center justify-center cursor-pointer ${
                                    set.setType === 'warmup'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                      : set.setType === 'drop'
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                      : set.setType === 'failure'
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                      : 'bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 hover:border-zinc-600'
                                  }`}
                                >
                                  {set.setType === 'warmup'
                                    ? 'W'
                                    : set.setType === 'drop'
                                    ? 'D'
                                    : set.setType === 'failure'
                                    ? 'F'
                                    : setIdx + 1}
                                </button>
                              </div>

                              {/* 2. Weight Stepper Pill with wide input */}
                              <div className="min-w-0">
                                <div className="flex items-center rounded-xl border border-zinc-800 bg-[#090D15] p-0.5 focus-within:border-[#10E760] transition-colors">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      stepWeight(
                                        exIdx,
                                        setIdx,
                                        -(unitSystem === 'metric' ? (set.weight <= 10 ? 1 : 2.5) : 5),
                                      )
                                    }
                                    className="size-6 sm:size-7 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 transition-all font-mono font-black text-sm select-none shrink-0"
                                    aria-label="Decrease weight"
                                  >
                                    −
                                  </button>
                                  <div className="flex-1 flex items-center justify-center min-w-0 px-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      inputMode="decimal"
                                      value={set.weight === 0 ? '' : set.weight}
                                      placeholder={String(set.previousPerformance?.weight || 20)}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                                        updateSet(exIdx, setIdx, { weight: val });
                                      }}
                                      className="w-full min-w-0 bg-transparent text-center font-mono text-xs sm:text-sm font-black text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      stepWeight(
                                        exIdx,
                                        setIdx,
                                        unitSystem === 'metric' ? (set.weight < 10 ? 1 : 2.5) : 5,
                                      )
                                    }
                                    className="size-6 sm:size-7 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 transition-all font-mono font-black text-sm select-none shrink-0"
                                    aria-label="Increase weight"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* 3. Reps Stepper Pill with wide input */}
                              <div className="min-w-0">
                                <div className="flex items-center rounded-xl border border-zinc-800 bg-[#090D15] p-0.5 focus-within:border-[#10E760] transition-colors">
                                  <button
                                    type="button"
                                    onClick={() => stepReps(exIdx, setIdx, -1)}
                                    className="size-6 sm:size-7 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 transition-all font-mono font-black text-sm select-none shrink-0"
                                    aria-label="Decrease reps"
                                  >
                                    −
                                  </button>
                                  <div className="flex-1 flex items-center justify-center min-w-0 px-1">
                                    <input
                                      type="number"
                                      min="0"
                                      inputMode="numeric"
                                      value={set.reps === 0 ? '' : set.reps}
                                      placeholder={String(set.previousPerformance?.reps || exercise.reps || 10)}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                                        updateSet(exIdx, setIdx, { reps: val });
                                      }}
                                      className="w-full min-w-0 bg-transparent text-center font-mono text-xs sm:text-sm font-black text-white outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => stepReps(exIdx, setIdx, 1)}
                                    className="size-6 sm:size-7 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-90 transition-all font-mono font-black text-sm select-none shrink-0"
                                    aria-label="Increase reps"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* 4. Complete Button & Delete */}
                              <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0 min-w-[70px]">
                                <button
                                  type="button"
                                  onClick={() => toggleSetComplete(exIdx, setIdx)}
                                  className={`size-8 sm:size-9 grid place-items-center rounded-xl border transition-all active:scale-95 cursor-pointer ${
                                    set.completed
                                      ? 'bg-[#10E760] text-zinc-950 border-[#10E760] shadow-[0_0_12px_rgba(16,231,96,0.35)]'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'
                                  }`}
                                  title={set.completed ? 'Set completed (tap to uncheck)' : 'Mark set completed'}
                                >
                                  <Check className="h-4 w-4 stroke-[3]" />
                                </button>

                                {exerciseSets.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSet(exIdx, setIdx)}
                                    title="Delete this set"
                                    className="size-7 grid place-items-center rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                ) : (
                                  <div className="size-7" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action Bar: Add Set + RIR Guide & Edit + Next Exercise */}
                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => handleAddSet(exIdx)}
                            className="border border-dashed border-zinc-800 text-zinc-300 hover:border-[#10E760]/50 hover:text-[#10E760] text-xs font-bold"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Set
                          </Button>

                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => setPrescriptionTargetExIdx(exIdx)}
                            className="border border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:text-[#10E760] text-xs font-bold"
                            title="Edit Target Reps and RIR"
                          >
                            <Info className="h-3.5 w-3.5 mr-1 text-[#10E760]" />
                            <span>RIR Guide & Edit</span>
                          </Button>
                        </div>

                        {exIdx < exercises.length - 1 && (
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => {
                              setExpandedExIdx(exIdx + 1);
                              setActiveExIdx(exIdx + 1);
                            }}
                            className="text-xs font-bold"
                            title={`Next: ${exercises[exIdx + 1]?.name}`}
                          >
                            <span>Next Lift</span>
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
            <PartyPopper className="h-5 w-5 mr-1.5" /> Finish Workout
          </Button>
        </div>

        {/* Day Switch Confirmation Modal */}
        <Modal
          open={pendingDaySwitch !== null}
          title="Switch Workout Day?"
          onClose={() => setPendingDaySwitch(null)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setPendingDaySwitch(null)}
                className="text-zinc-400"
              >
                Keep Day {activeDayNumber}
              </Button>
              <Button
                variant="volt"
                size="md"
                onClick={confirmSwitchDay}
                className="font-black px-4"
              >
                Switch to Day {pendingDaySwitch}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-2 text-zinc-300 text-sm">
            <p>
              You have an active session with <strong className="text-[#10E760] font-mono">{completedSets}</strong> completed sets on <strong className="text-white">Day {activeDayNumber}</strong>.
            </p>
            <p className="text-zinc-400 text-xs">
              Switching will discard uncompleted sets for this day and load the routine for Day {pendingDaySwitch}.
            </p>
          </div>
        </Modal>

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
                    <span>⚠️ Pain Spike Alert</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Joint Region
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
                      placeholder="Optional brief note..."
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

        {/* Prescription & RIR Guide Action Bottom Sheet */}
        {prescriptionTarget && (
          <PrescriptionActionSheet
            open={true}
            onClose={() => setPrescriptionTargetExIdx(null)}
            exerciseName={prescriptionTarget.name}
            notes={prescriptionTarget.notes}
            targetSets={prescriptionTarget.sets}
            targetReps={prescriptionTarget.reps}
            muscleGroup={prescriptionTarget.muscleGroup}
            movementPattern={prescriptionTarget.movementPattern}
            onUpdatePrescription={(updatedNotes, updatedSets) => {
              if (prescriptionTargetExIdx !== null) {
                handleUpdatePrescription(prescriptionTargetExIdx, updatedNotes, updatedSets);
              }
            }}
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
