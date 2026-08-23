import { useState, useEffect, useRef } from 'react';
import { Play, Pause, FastForward, Volume2, VolumeX } from 'lucide-react';
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
  const { soundEnabled, setSoundEnabled } = usePreferences();
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

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 shadow-lg">
      {/* Background radial glow when active */}
      {isRunning && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.06)_0%,transparent_70%)]" />
      )}

      {/* Top Row: Timer Display + Sound Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="relative size-16 sm:size-20 shrink-0">
            <svg className="size-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-zinc-800"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className={`transition-all duration-300 ${
                  isFinished ? 'stroke-lime-400' : isRunning ? 'stroke-lime-400' : 'stroke-zinc-500'
                }`}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xs sm:text-sm font-black text-white tabular-nums">
                {timeDisplay}
              </span>
              <span className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-zinc-400">
                {isFinished ? 'Done' : isRunning ? 'Rest' : 'Paused'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-lime-400">
              Rest Interval
            </span>
            <h4 className="font-mono text-xl sm:text-2xl font-black tracking-tight text-white tabular-nums">
              {timeDisplay}
            </h4>
            <p className="text-[11px] sm:text-xs text-zinc-400">Recovery before next set</p>
          </div>
        </div>

        {/* Sound toggle on top right */}
        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`grid size-9 shrink-0 place-items-center rounded-xl border transition-colors ${
            soundEnabled
              ? 'border-lime-400/40 bg-lime-400/10 text-lime-400'
              : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-white'
          }`}
          title={soundEnabled ? 'Timer sound alert ON' : 'Timer sound alert MUTED'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      {/* Bottom Controls Strip: Clean 4-column responsive grid */}
      <div className="mt-4 grid grid-cols-4 gap-2 pt-2 border-t border-zinc-800/80">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAddTime(-15)}
          disabled={remainingSeconds <= 15}
          className="border-zinc-800 bg-zinc-950 text-xs font-bold hover:border-zinc-700 h-9"
          title="-15 seconds"
        >
          -15s
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAddTime(30)}
          className="border-zinc-800 bg-zinc-950 text-xs font-bold hover:border-zinc-700 h-9"
          title="+30 seconds"
        >
          +30s
        </Button>

        <Button
          size="sm"
          variant={isRunning ? 'secondary' : 'volt'}
          onClick={handleTogglePlay}
          aria-label={isRunning ? 'Pause rest timer' : 'Start rest timer'}
          className="font-bold text-xs h-9 px-2"
        >
          {isRunning ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1 fill-current" />}
          {isRunning ? 'Pause' : remainingSeconds === 0 ? 'Restart' : 'Resume'}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleSkip}
          className="text-zinc-400 hover:text-white text-xs font-bold h-9 px-2"
          title="Skip rest interval"
        >
          <FastForward className="h-3.5 w-3.5 mr-1" /> Skip
        </Button>
      </div>
    </div>
  );
}
