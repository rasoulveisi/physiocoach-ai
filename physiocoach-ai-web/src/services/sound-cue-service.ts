class SoundCueService {
  private audioContext: AudioContext | null = null;

  public playTimerCompleteChime(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  /**
   * Speaks a clear voice cue using the browser's Web Speech Synthesis API.
   */
  public speakVoiceCue(text: string): void {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      // Cancel previous utterance so it does not backlog
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      // Pick a natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')),
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis is best-effort
    }
  }

  /**
   * Announce rest completion and prepare for next exercise.
   */
  public announceRestComplete(exerciseName?: string): void {
    const message = exerciseName
      ? `Rest complete. Get ready for ${exerciseName}.`
      : 'Rest complete. Get ready for your next set.';
    this.speakVoiceCue(message);
  }

  /**
   * Triggers mobile haptic vibration feedback when supported by the hardware/browser.
   */
  public triggerHaptic(pattern: 'light' | 'success' | 'complete' | number[] = 'light'): void {
    try {
      if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

      if (Array.isArray(pattern)) {
        navigator.vibrate(pattern);
        return;
      }

      switch (pattern) {
        case 'light':
          navigator.vibrate(50);
          break;
        case 'success':
          navigator.vibrate([60, 40, 60]);
          break;
        case 'complete':
          navigator.vibrate([120, 60, 120]);
          break;
      }
    } catch {
      // Haptics is best-effort
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
