/**
 * PhysioCoach AI — Settings context.
 *
 * Persists athlete preferences in AsyncStorage under
 * '@physiocoach/user_settings' and exposes typed accessors consumed by the
 * LiveSession workout engine (voice cues, haptics, keep-awake, default rest)
 * and the comprehensive Settings screen.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_SETTINGS_STORAGE_KEY = '@physiocoach/user_settings';

/** User-controllable preferences. */
export interface Settings {
  /** Display/log entry unit for loads. Loads stay stored internally in kg. */
  weightUnit: 'kg' | 'lbs';
  /** Spoken rest-timer + coaching cues (expo-speech). */
  voiceCuesEnabled: boolean;
  /** Tactile feedback (expo-haptics). */
  hapticsEnabled: boolean;
  /** Prevent screen sleep during live sessions (expo-keep-awake). */
  keepAwakeEnabled: boolean;
  /** Fallback rest length (seconds) when a set omits a prescribed rest. */
  defaultRestSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
  voiceCuesEnabled: true,
  hapticsEnabled: true,
  keepAwakeEnabled: true,
  defaultRestSeconds: 90,
};

/** Preset choices offered on the Settings screen. */
export const REST_TIMER_OPTIONS = [30, 60, 90, 120, 180] as const;

export interface SettingsContextValue {
  settings: Settings;
  /** True once the persisted settings have been read from storage. */
  isLoaded: boolean;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Parse + shape-check a stored settings JSON blob, falling back to defaults. */
function parseSettings(raw: string | null): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const candidate = parsed as Partial<Settings>;
    const restIsValid =
      typeof candidate.defaultRestSeconds === 'number' &&
      (REST_TIMER_OPTIONS as readonly number[]).includes(candidate.defaultRestSeconds);
    return {
      weightUnit: candidate.weightUnit === 'lbs' ? 'lbs' : 'kg',
      voiceCuesEnabled:
        typeof candidate.voiceCuesEnabled === 'boolean'
          ? candidate.voiceCuesEnabled
          : DEFAULT_SETTINGS.voiceCuesEnabled,
      hapticsEnabled:
        typeof candidate.hapticsEnabled === 'boolean'
          ? candidate.hapticsEnabled
          : DEFAULT_SETTINGS.hapticsEnabled,
      keepAwakeEnabled:
        typeof candidate.keepAwakeEnabled === 'boolean'
          ? candidate.keepAwakeEnabled
          : DEFAULT_SETTINGS.keepAwakeEnabled,
      defaultRestSeconds: restIsValid
        ? (candidate.defaultRestSeconds as number)
        : DEFAULT_SETTINGS.defaultRestSeconds,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate persisted preferences once on startup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(USER_SETTINGS_STORAGE_KEY);
        if (!cancelled) setSettings(parseSettings(raw));
      } catch {
        // Corrupt/unreadable storage — defaults already in place.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        // Persist best-effort; UI state must not depend on storage success.
        void AsyncStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(
          () => undefined,
        );
        return next;
      });
    },
    [],
  );

  const resetToDefaults = useCallback(async (): Promise<void> => {
    setSettings({ ...DEFAULT_SETTINGS });
    try {
      await AsyncStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // Best-effort persistence.
    }
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, isLoaded, updateSetting, resetToDefaults }),
    [settings, isLoaded, updateSetting, resetToDefaults],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Access user preferences. Must be used under a SettingsProvider. */
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
