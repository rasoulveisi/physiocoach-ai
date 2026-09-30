import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';

export type UnitSystem = 'metric' | 'imperial';

export interface PreferencesState {
  unitSystem: UnitSystem;
  setUnitSystem: (unit: UnitSystem) => void;
  defaultRestSeconds: number;
  setDefaultRestSeconds: (seconds: number) => void;
  defaultSessionMinutes: number;
  setDefaultSessionMinutes: (minutes: number) => void;
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
  SESSION_MINUTES: 'pc_session_minutes',
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

  const [defaultSessionMinutes, setDefaultSessionMinutesState] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION_MINUTES);
    return saved ? Number(saved) : 45;
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

  const setUnitSystem = useCallback((unit: UnitSystem) => {
    setUnitSystemState(unit);
    localStorage.setItem(STORAGE_KEYS.UNIT_SYSTEM, unit);
  }, []);

  const setDefaultRestSeconds = useCallback((seconds: number) => {
    setDefaultRestSecondsState(seconds);
    localStorage.setItem(STORAGE_KEYS.REST_SECONDS, String(seconds));
  }, []);

  const setDefaultSessionMinutes = useCallback((minutes: number) => {
    setDefaultSessionMinutesState(minutes);
    localStorage.setItem(STORAGE_KEYS.SESSION_MINUTES, String(minutes));
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(enabled));
  }, []);

  const setVoiceCuesEnabled = useCallback((enabled: boolean) => {
    setVoiceCuesEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.VOICE_CUES_ENABLED, String(enabled));
  }, []);

  const setHapticsEnabled = useCallback((enabled: boolean) => {
    setHapticsEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.HAPTICS_ENABLED, String(enabled));
  }, []);

  const setAutoStartRestTimer = useCallback((autoStart: boolean) => {
    setAutoStartRestTimerState(autoStart);
    localStorage.setItem(STORAGE_KEYS.AUTO_START_TIMER, String(autoStart));
  }, []);

  const formatWeight = useCallback(
    (weightKg: number) => {
      if (unitSystem === 'imperial') {
        const lbs = Math.round(weightKg * 2.20462 * 10) / 10;
        return { value: lbs, label: `${lbs} lbs`, unit: 'lbs' };
      }
      const val = Math.round(weightKg * 10) / 10;
      return { value: val, label: `${val} kg`, unit: 'kg' };
    },
    [unitSystem],
  );

  const convertInputToKg = useCallback(
    (displayValue: number): number => {
      if (unitSystem === 'imperial') {
        return Math.round((displayValue / 2.20462) * 10) / 10;
      }
      return Math.round(displayValue * 10) / 10;
    },
    [unitSystem],
  );

  const value = useMemo(
    () => ({
      unitSystem,
      setUnitSystem,
      defaultRestSeconds,
      setDefaultRestSeconds,
      defaultSessionMinutes,
      setDefaultSessionMinutes,
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
    }),
    [
      unitSystem,
      setUnitSystem,
      defaultRestSeconds,
      setDefaultRestSeconds,
      defaultSessionMinutes,
      setDefaultSessionMinutes,
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
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesState {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
