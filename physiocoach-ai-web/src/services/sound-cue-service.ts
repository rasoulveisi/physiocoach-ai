class SoundCueService {
  private audioContext: AudioContext | null = null;

  public playTimerCompleteChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;

      // Note 1: High A (880 Hz)
      this.playTone(880, now, 0.18);
      // Note 2: Melodic D6 (1174.66 Hz)
      this.playTone(1174.66, now + 0.16, 0.4);
    } catch {
      // Audio is best-effort on web clients
    }
  }

  public playSetCompleteBeep(): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      this.playTone(659.25, now, 0.12); // E5
    } catch {
      // Best-effort
    }
  }

  private playTone(frequency: number, startTime: number, duration: number): void {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}

export const soundCueService = new SoundCueService();
