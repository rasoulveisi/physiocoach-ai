import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkoutTimerService {
  readonly remainingSeconds = signal(0);
  readonly totalSeconds = signal(0);
  readonly isRunning = signal(false);
  readonly isPaused = signal(false);
  readonly isFinished = signal(false);
  readonly soundEnabled = signal(true);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioContext: AudioContext | null = null;

  start(seconds?: number): void {
    if (seconds !== undefined) {
      const value = Math.max(0, Math.trunc(seconds));
      this.totalSeconds.set(value);
      this.remainingSeconds.set(value);
    }

    if (this.remainingSeconds() <= 0) {
      return;
    }

    this.clearInterval();
    this.isRunning.set(true);
    this.isPaused.set(false);
    this.isFinished.set(false);
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  pause(): void {
    if (!this.isRunning() || this.isPaused()) {
      return;
    }

    this.clearInterval();
    this.isRunning.set(false);
    this.isPaused.set(true);
  }

  resume(): void {
    if (!this.isPaused()) {
      return;
    }

    this.isPaused.set(false);
    this.isRunning.set(true);
    this.isFinished.set(false);
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    this.clearInterval();
    this.isRunning.set(false);
    this.isPaused.set(false);
    this.isFinished.set(false);
    this.remainingSeconds.set(0);
    this.totalSeconds.set(0);
  }

  /** End the current rest period early without resetting or chiming. */
  skip(): void {
    this.clearInterval();
    this.isRunning.set(false);
    this.isPaused.set(false);
    this.remainingSeconds.set(0);
    this.isFinished.set(true);
  }

  addTime(seconds: number): void {
    if (!Number.isFinite(seconds)) {
      return;
    }

    const delta = Math.trunc(seconds);
    if (delta === 0) {
      return;
    }

    const next = Math.max(0, this.remainingSeconds() + delta);
    this.remainingSeconds.set(next);
    if (next > this.totalSeconds()) {
      this.totalSeconds.set(next);
    }

    // Adding time to a paused/stopped timer restarts it so the user keeps resting.
    if (delta > 0 && !this.isRunning() && !this.isPaused()) {
      this.start();
    }
  }

  toggleSound(): void {
    this.soundEnabled.update((enabled) => !enabled);
  }

  private tick(): void {
    const next = this.remainingSeconds() - 1;
    if (next <= 0) {
      this.remainingSeconds.set(0);
      this.clearInterval();
      this.isRunning.set(false);
      this.isPaused.set(false);
      this.isFinished.set(true);
      this.playChime();
      return;
    }

    this.remainingSeconds.set(next);
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private playChime(): void {
    if (!this.soundEnabled()) {
      return;
    }

    try {
      this.audioContext ??= new AudioContext();
      void this.audioContext.resume();
      this.playTone(this.audioContext, 880, 0);
      this.playTone(this.audioContext, 1174.66, 0.18);
    } catch {
      // Audio is best-effort: ignore unsupported or blocked contexts.
    }
  }

  private playTone(context: AudioContext, frequency: number, startOffset: number): void {
    const now = context.currentTime + startOffset;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
  }
}
