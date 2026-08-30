/**
 * PhysioCoach AI — Rest timer hook.
 * Drives the countdown for the floating Rest Timer HUD and fires the
 * completion callbacks (haptics + speech) exactly once per run.
 * Refs mirror the reactive state so interval ticks never race React updates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimerPhase } from './sessionTypes';

export interface RestTimerControls {
  phase: TimerPhase;
  /** Seconds remaining while running (0 when idle/done). */
  remaining: number;
  /** Duration in seconds of the current/last run. */
  duration: number;
  start: (seconds: number) => void;
  addSeconds: (seconds: number) => void;
  subtractSeconds: (seconds: number) => void;
  skip: () => void;
  /** Dismiss the HUD after the completion pulse. */
  dismiss: () => void;
}

export function useRestTimer(onComplete: () => void): RestTimerControls {
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [remaining, setRemaining] = useState(0);
  const [duration, setDuration] = useState(0);

  // Keep the latest onComplete without re-creating the interval.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const remainingRef = useRef(0);
  const phaseRef = useRef<TimerPhase>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /** Hit zero (or subtracted past it): fire completion exactly once. */
  const finish = useCallback(() => {
    stopInterval();
    remainingRef.current = 0;
    setRemaining(0);
    phaseRef.current = 'done';
    setPhase('done');
    onCompleteRef.current();
  }, [stopInterval]);

  const start = useCallback(
    (seconds: number) => {
      const safe = Math.max(1, Math.round(seconds));
      stopInterval();
      setDuration(safe);
      remainingRef.current = safe;
      setRemaining(safe);
      phaseRef.current = 'running';
      setPhase('running');
      intervalRef.current = setInterval(() => {
        const next = remainingRef.current - 1;
        if (next <= 0) {
          finish();
        } else {
          remainingRef.current = next;
          setRemaining(next);
        }
      }, 1000);
    },
    [finish, stopInterval],
  );

  /** +30s / −15s quick adjustments while running. */
  const adjust = useCallback((delta: number) => {
    if (phaseRef.current !== 'running') return;
    const next = Math.max(1, remainingRef.current + delta);
    remainingRef.current = next;
    setRemaining(next);
  }, []);

  const addSeconds = useCallback((seconds: number) => adjust(seconds), [adjust]);

  const subtractSeconds = useCallback(
    (seconds: number) => {
      if (phaseRef.current !== 'running') return;
      if (remainingRef.current - seconds <= 0) {
        finish();
        return;
      }
      adjust(-seconds);
    },
    [adjust, finish],
  );

  const skip = useCallback(() => {
    stopInterval();
    remainingRef.current = 0;
    setRemaining(0);
    phaseRef.current = 'idle';
    setPhase('idle');
  }, [stopInterval]);

  // Stop the countdown if the screen unmounts mid-rest.
  useEffect(() => stopInterval, [stopInterval]);

  return { phase, remaining, duration, start, addSeconds, subtractSeconds, skip, dismiss: skip };
}

/** "1:23" style mm:ss rendering for the HUD countdown. */
export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
