import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Volume2, VolumeX, Bell } from 'lucide-react';
import { Button } from './Button';
import { soundCueService } from '../../services/sound-cue-service';
import { usePreferences } from '../../context/PreferencesContext';

export interface RestTimerHUDProps {
  initialSeconds?: number;
  onFinished?(): void;
  autoStart?: boolean;
}

export function RestTimerHUD({
  initialSeconds = 90,
  onFinished,
  autoStart = false,
}: RestTimerHUDProps) {
  const { soundEnabled, setSoundEnabled, autoStartRestTimer, setAutoStartRestTimer } = usePreferences();
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isFinished, setIsFinished] = useState(false);

  const finishedFiredRef = useRef(false);

  useEffect(() => {
    setTotalSeconds(initialSeconds);
    setRemainingSeconds(initialSeconds);
    if (autoStart) {
      setIsRunning(true);
      setIsFinished(false);
      finishedFiredRef.current = false;
    }
  }, [initialSeconds, autoStart]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          setIsFinished(true);

          if (!finishedFiredRef.current) {
            finishedFiredRef.current = true;
            if (soundEnabled) {
              soundCueService.playTimerCompleteChime();
            }
            if (onFinished) {
              onFinished();
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, soundEnabled, onFinished]);

  const handleTogglePlay = () => {
    if (remainingSeconds === 0) {
      setRemainingSeconds(totalSeconds);
      setIsFinished(false);
      finishedFiredRef.current = false;
      setIsRunning(true);
      return;
    }
    setIsRunning(!isRunning);
  };

  const handleAddTime = (delta: number) => {
    const next = Math.max(0, remainingSeconds + delta);
    setRemainingSeconds(next);
    if (next > totalSeconds) {
      setTotalSeconds(next);
    }
    if (!isRunning && next > 0) {
      setIsRunning(true);
      setIsFinished(false);
    }
  };

  const handleSkip = () => {
    setIsRunning(false);
    setRemainingSeconds(0);
    setIsFinished(true);
    if (onFinished) onFinished();
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsFinished(false);
    setRemainingSeconds(totalSeconds);
    finishedFiredRef.current = false;
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-obsidian-700 bg-obsidian-900 p-5">
      {/* Background radial glow when active */}
      {isRunning && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,231,96,0.08)_0%,transparent_70%)]" />
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Mechanical Circular Countdown Ring */}
        <div className="flex items-center gap-4">
          <div className="relative size-20 shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-obsidian-700"
                strokeWidth="7"
                fill="transparent"
              />
              {/* Progress ring */}
              <circle
                cx="50"
                cy="50"
                r="40"
                className={`transition-all duration-300 ${
                  isFinished ? 'stroke-volt' : isRunning ? 'stroke-volt' : 'stroke-cyan-400'
                }`}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Countdown digits center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-tabular text-sm font-extrabold text-white">{timeDisplay}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                {isFinished ? 'Done' : isRunning ? 'Rest' : 'Paused'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-volt">
              Rest Interval
            </span>
            <h4 className="font-tabular text-2xl font-black tracking-tight text-white">
              {timeDisplay}
            </h4>
            <p className="text-xs text-slate-400">Recovery before next set</p>
          </div>
        </div>

        {/* Right: Quick Controls & Sound Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAddTime(-15)}
            disabled={remainingSeconds <= 15}
            title="-15 seconds"
          >
            -15s
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleAddTime(30)}
            title="+30 seconds"
          >
            +30s
          </Button>

          <Button
            size="sm"
            variant={isRunning ? 'secondary' : 'volt'}
            onClick={handleTogglePlay}
            aria-label={isRunning ? 'Pause rest timer' : 'Start rest timer'}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isRunning ? 'Pause' : remainingSeconds === 0 ? 'Restart' : 'Resume'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleSkip}
            title="Skip rest interval"
          >
            <FastForward className="h-4 w-4" /> Skip
          </Button>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`grid size-9 place-items-center rounded-lg border transition-colors ${
              soundEnabled
                ? 'border-volt/30 bg-volt/10 text-volt'
                : 'border-obsidian-700 bg-obsidian-950 text-slate-500 hover:text-white'
            }`}
            title={soundEnabled ? 'Timer sound alert ON' : 'Timer sound alert MUTED'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
