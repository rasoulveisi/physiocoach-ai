import { createContext, useContext, useState, type ReactNode } from 'react';

export type UnitSystem = 'metric' | 'imperial';

export interface PreferencesState {
  unitSystem: UnitSystem;
  setUnitSystem: (unit: UnitSystem) => void;
  defaultRestSeconds: number;
  setDefaultRestSeconds: (seconds: number) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  voiceCuesEnabled: boolean;
  setVoiceCuesEnabled: (enabled: boolean) => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  autoStartRestTimer: boolean;
  setAutoStartRestTimer: (autoStart: boolean) => void;
  formatWeight: (weightKg: number) => { value: number; label: string; unit: string };
  convertInputToKg: (displayValue: number) => number;
}

const STORAGE_KEYS = {
  UNIT_SYSTEM: 'pc_unit_system',
  REST_SECONDS: 'pc_rest_timer_seconds',
  SOUND_ENABLED: 'pc_sound_enabled',
  VOICE_CUES_ENABLED: 'pc_voice_cues_enabled',
  HAPTICS_ENABLED: 'pc_haptics_enabled',
  AUTO_START_TIMER: 'pc_auto_start_timer',
};

const PreferencesContext = createContext<PreferencesState | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => {
    return (localStorage.getItem(STORAGE_KEYS.UNIT_SYSTEM) as UnitSystem) || 'metric';
  });

  const [defaultRestSeconds, setDefaultRestSecondsState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REST_SECONDS);
    return saved ? Number(saved) : 90;
  });

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    return saved !== null ? saved === 'true' : true;
  });

  const [voiceCuesEnabled, setVoiceCuesEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE_CUES_ENABLED);
    return saved !== null ? saved === 'true' : true;
  });

  const [hapticsEnabled, setHapticsEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HAPTICS_ENABLED);
    return saved !== null ? saved === 'true' : true;
  });

  const [autoStartRestTimer, setAutoStartRestTimerState] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTO_START_TIMER);
    return saved !== null ? saved === 'true' : true;
  });

  const setUnitSystem = (unit: UnitSystem) => {
    setUnitSystemState(unit);
    localStorage.setItem(STORAGE_KEYS.UNIT_SYSTEM, unit);
  };

  const setDefaultRestSeconds = (seconds: number) => {
    setDefaultRestSecondsState(seconds);
    localStorage.setItem(STORAGE_KEYS.REST_SECONDS, String(seconds));
  };

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
  };

  const setVoiceCuesEnabled = (enabled: boolean) => {
    setVoiceCuesEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.VOICE_CUES_ENABLED, String(enabled));
  };

  const setHapticsEnabled = (enabled: boolean) => {
    setHapticsEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.HAPTICS_ENABLED, String(enabled));
  };

  const setAutoStartRestTimer = (autoStart: boolean) => {
    setAutoStartRestTimerState(autoStart);
    localStorage.setItem(STORAGE_KEYS.AUTO_START_TIMER, String(autoStart));
  };

  const formatWeight = (weightKg: number) => {
    if (unitSystem === 'imperial') {
      const lbs = Math.round(weightKg * 2.20462 * 10) / 10;
      return { value: lbs, label: `${lbs} lbs`, unit: 'lbs' };
    }
    const val = Math.round(weightKg * 10) / 10;
    return { value: val, label: `${val} kg`, unit: 'kg' };
  };

  const convertInputToKg = (displayValue: number): number => {
    if (unitSystem === 'imperial') {
      return Math.round((displayValue / 2.20462) * 10) / 10;
    }
    return Math.round(displayValue * 10) / 10;
  };

  return (
    <PreferencesContext.Provider
      value={{
        unitSystem,
        setUnitSystem,
        defaultRestSeconds,
        setDefaultRestSeconds,
        soundEnabled,
        setSoundEnabled,
        voiceCuesEnabled,
        setVoiceCuesEnabled,
        hapticsEnabled,
        setHapticsEnabled,
        autoStartRestTimer,
        setAutoStartRestTimer,
        formatWeight,
        convertInputToKg,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesState {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
