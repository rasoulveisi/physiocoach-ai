import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { ExerciseVisual } from './ExerciseVisual';
import { apiClient } from '../../services/api-client';
import { soundCueService } from '../../services/sound-cue-service';

export interface PrehabExerciseItem {
  id: string;
  name: string;
  targetJoint: string;
  durationSeconds?: number;
  reps?: number;
  purpose: string;
  movementCue: string;
  mediaUrl?: string;
}

export interface PrehabWarmupSectionProps {
  exercises: Array<{
    name: string;
    movementPattern?: string;
    muscleGroup?: string;
  }>;
  limitations?: string[];
  sessionId?: string;
}

export function PrehabWarmupSection({
  exercises,
  limitations = [],
  sessionId,
}: PrehabWarmupSectionProps) {
  const [routine, setRoutine] = useState<PrehabExerciseItem[] | null>(null);
  const [targetJoints, setTargetJoints] = useState<string[]>([]);
  const [totalMinutes, setTotalMinutes] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});

  // Active inline timer state
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<number | null>(null);

  // Generate Routine from Backend API
  const handleGenerateRoutine = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        exercises: exercises.map((ex) => ({
          name: ex.name,
          movementPattern: ex.movementPattern,
          muscleGroups: ex.muscleGroup ? [ex.muscleGroup] : [],
        })),
        limitations,
        sessionId,
      };

      const response = await apiClient.post<{
        success: boolean;
        totalMinutes: number;
        targetJoints: string[];
        routine: PrehabExerciseItem[];
      }>('workout-sessions/prehab', payload);

      const data = (response as any)?.data || response;
      if (data?.routine && Array.isArray(data.routine)) {
        setRoutine(data.routine);
        setTargetJoints(data.targetJoints || []);
        setTotalMinutes(data.totalMinutes || 3);
        setCompletedMap({});
        setIsExpanded(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prehab routine.');
    } finally {
      setLoading(false);
    }
  };

  // Timer Tick
  useEffect(() => {
    if (!timerRunning || remainingSeconds <= 0 || !activeTimerId) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Timer finished
          if (activeTimerId) {
            markComplete(activeTimerId, true);
          }
          setTimerRunning(false);
          soundCueService.playTimerCompleteChime();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning, remainingSeconds, activeTimerId]);

  const startTimer = (ex: PrehabExerciseItem) => {
    const secs = ex.durationSeconds || 45;
    if (activeTimerId === ex.id) {
      setTimerRunning((prev) => !prev);
    } else {
      setActiveTimerId(ex.id);
      setRemainingSeconds(secs);
      setTimerRunning(true);
    }
  };

  const resetTimer = (ex: PrehabExerciseItem) => {
    setActiveTimerId(ex.id);
    setRemainingSeconds(ex.durationSeconds || 45);
    setTimerRunning(false);
  };

  const markComplete = (id: string, completed: boolean) => {
    setCompletedMap((prev) => {
      const next = { ...prev, [id]: completed };
      if (completed) {
        soundCueService.playSetCompleteBeep();
      }

      // If all completed, trigger celebration chime
      if (routine && routine.length > 0) {
        const allDone = routine.every((item) => (item.id === id ? completed : next[item.id]));
        if (allDone) {
          setTimeout(() => {
            soundCueService.playTimerCompleteChime();
          }, 200);
        }
      }
      return next;
    });
  };

  const completedCount = routine ? routine.filter((r) => completedMap[r.id]).length : 0;
  const totalCount = routine?.length || 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  return (
    <Card className="overflow-hidden border border-zinc-800 bg-[#121722] shadow-xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 p-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div
            className={`grid size-9 place-items-center rounded-xl border transition-colors ${
              isAllCompleted
                ? 'border-lime-400/40 bg-lime-400/20 text-lime-400 shadow-[0_0_12px_rgba(16,231,96,0.3)]'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300'
            }`}
          >
            {isAllCompleted ? (
              <ShieldCheck className="h-5 w-5 text-lime-400 stroke-[2.5]" />
            ) : (
              <Flame className="h-5 w-5 text-amber-400" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Smart Warm-up & Prehab
              </h2>
              {isAllCompleted && (
                <Badge variant="volt" pill className="animate-pulse shadow-sm font-extrabold text-[10px]">
                  <Sparkles className="mr-1 h-3 w-3" />
                  JOINTS PRIMED
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {routine
                ? `${completedCount}/${totalCount} Prehab Drills Completed (${totalMinutes} Min Routine)`
                : 'Dynamic mobility & joint activation matched to your session lifts.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {routine && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="grid size-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors"
              aria-label={isExpanded ? 'Collapse prehab routine' : 'Expand prehab routine'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <CardContent className="p-4 sm:p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Initial Empty / CTA State */}
        {!routine && (
          <div className="flex flex-col items-center justify-center py-4 text-center sm:py-6">
            <div className="grid size-12 place-items-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 mb-3 shadow-inner">
              <Activity className="h-6 w-6" />
            </div>

            <h3 className="text-base font-extrabold text-white">
              Prime Target Joints & Muscles
            </h3>
            <p className="mt-1 max-w-md text-xs text-zinc-400">
              Generate a 3-minute mobility routine matched to your session lifts.
            </p>

            <div className="mt-4">
              <Button
                variant="volt"
                size="md"
                pill
                loading={loading}
                onClick={handleGenerateRoutine}
                className="font-black px-5 shadow-lg shadow-lime-400/20"
              >
                <Zap className="mr-1.5 h-4 w-4 fill-current" /> Generate 3-Min Mobility Routine
              </Button>
            </div>
          </div>
        )}

        {/* Routine Active Checklist */}
        {routine && isExpanded && (
          <div className="space-y-4">
            {/* Target Joints Chip Bar */}
            {targetJoints.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
                  Target Capsules:
                </span>
                {targetJoints.map((joint) => (
                  <Badge key={joint} variant="cyan" pill className="text-[10px]">
                    {joint}
                  </Badge>
                ))}
              </div>
            )}

            {/* Checklist Items */}
            <div className="space-y-3">
              {routine.map((item, idx) => {
                const isCompleted = Boolean(completedMap[item.id]);
                const isTimerActive = activeTimerId === item.id;
                const isTimed = Boolean(item.durationSeconds);

                const currentSecs =
                  isTimerActive && remainingSeconds >= 0
                    ? remainingSeconds
                    : item.durationSeconds || 0;
                const timerMins = Math.floor(currentSecs / 60);
                const timerSecsRemainder = currentSecs % 60;
                const formattedCountdown = `${String(timerMins).padStart(2, '0')}:${String(
                  timerSecsRemainder,
                ).padStart(2, '0')}`;

                return (
                  <div
                    key={item.id || idx}
                    className={`rounded-2xl border p-3.5 transition-all ${
                      isCompleted
                        ? 'border-lime-400/50 bg-lime-400/5 shadow-[0_0_15px_rgba(16,231,96,0.1)]'
                        : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Thumbnail & Details */}
                      <div className="flex gap-3 min-w-0">
                        <div className="shrink-0">
                          <div className="size-14 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5 flex items-center justify-center shadow-sm">
                            <ExerciseVisual
                              name={item.name}
                              masterExerciseId={item.id}
                              compact
                            />
                          </div>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4
                              className={`text-sm font-extrabold ${
                                isCompleted ? 'line-through text-zinc-400' : 'text-white'
                              }`}
                            >
                              {item.name}
                            </h4>
                            <Badge variant="amber" className="text-[9px]">
                              {item.targetJoint}
                            </Badge>
                            {item.durationSeconds && (
                              <Badge variant="cyan" className="text-[9px] font-mono">
                                <Timer className="mr-0.5 h-2.5 w-2.5" />
                                {item.durationSeconds}s
                              </Badge>
                            )}
                            {item.reps && (
                              <Badge variant="neutral" className="text-[9px] font-mono">
                                {item.reps} Reps
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-zinc-300 line-clamp-2">
                            {item.purpose}
                          </p>

                          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-amber-300/90 font-medium">
                            <Sparkles className="h-3 w-3 shrink-0 text-amber-400" />
                            <span className="truncate">{item.movementCue}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Controls & Checkmark */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Inline Timer for timed exercises */}
                        {isTimed && (
                          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1">
                            <span
                              className={`font-mono text-xs font-black tabular-nums ${
                                isTimerActive && timerRunning
                                  ? 'text-lime-400 animate-pulse'
                                  : 'text-zinc-300'
                              }`}
                            >
                              {formattedCountdown}
                            </span>

                            <button
                              type="button"
                              onClick={() => startTimer(item)}
                              className="grid size-6 place-items-center rounded-md hover:bg-zinc-800 text-zinc-300 hover:text-lime-400 transition-colors"
                              title={isTimerActive && timerRunning ? 'Pause' : 'Start'}
                            >
                              {isTimerActive && timerRunning ? (
                                <Pause className="h-3 w-3" />
                              ) : (
                                <Play className="h-3 w-3 fill-current" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => resetTimer(item)}
                              className="grid size-6 place-items-center rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                              title="Reset"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* Complete Checkbox Button */}
                        <button
                          type="button"
                          onClick={() => markComplete(item.id, !isCompleted)}
                          className={`grid size-9 place-items-center rounded-xl border-2 font-black transition-all active:scale-95 ${
                            isCompleted
                              ? 'border-lime-400 bg-lime-400 text-zinc-950 shadow-[0_0_10px_rgba(16,231,96,0.4)]'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-600 hover:border-lime-400 hover:text-lime-400'
                          }`}
                          aria-label={`Mark ${item.name} as ${isCompleted ? 'incomplete' : 'complete'}`}
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Celebration Card when All Completed */}
            {isAllCompleted && (
              <div className="flex items-center justify-between rounded-2xl border border-lime-400/40 bg-lime-400/10 p-3.5 text-lime-400">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 stroke-[2.5]" />
                  <div>
                    <strong className="block text-xs font-black uppercase tracking-wider text-lime-300">
                      Mobility & Joint Prep Finished!
                    </strong>
                    <span className="text-[11px] text-zinc-300">
                      Joint capsules lubricated, neural motor units primed for heavy working sets.
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="text-xs text-lime-300 hover:text-white"
                >
                  Hide
                </Button>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={handleGenerateRoutine}
                disabled={loading}
                className="text-zinc-400 hover:text-zinc-200 transition-colors font-semibold"
              >
                ↻ Regenerate Routine
              </button>

              <button
                type="button"
                onClick={() => {
                  const allDone = routine.every((r) => completedMap[r.id]);
                  const nextMap: Record<string, boolean> = {};
                  routine.forEach((r) => {
                    nextMap[r.id] = !allDone;
                  });
                  setCompletedMap(nextMap);
                  if (!allDone) {
                    soundCueService.playTimerCompleteChime();
                  }
                }}
                className="font-bold text-lime-400 hover:text-lime-300 transition-colors"
              >
                {isAllCompleted ? 'Reset All' : 'Mark All Completed'}
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
