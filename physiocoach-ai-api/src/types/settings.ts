import { z } from 'zod';

export const SETTINGS_DEFAULTS = {
  theme: 'light',
  unitSystem: 'metric',
  defaultWorkoutView: 'byExercise',
  remindersEnabled: false,
  restTimerSeconds: 90,
  autoStartRestTimer: true,
  restTimerSoundEnabled: true,
} as const;

export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  unitSystem: z.enum(['metric', 'imperial']),
  defaultWorkoutView: z.enum(['byExercise', 'byDay', 'byPlan']),
  remindersEnabled: z.boolean(),
  restTimerSeconds: z.number().int().min(1).max(3600),
  autoStartRestTimer: z.boolean(),
  restTimerSoundEnabled: z.boolean(),
});

export const userSettingsPatchSchema = userSettingsSchema.partial().strict();

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type UserSettingsPatchInput = z.infer<typeof userSettingsPatchSchema>;
export type UserSettingsSnapshot = Partial<UserSettingsInput>;

export interface UserSettingsDto {
  theme: UserSettingsInput['theme'];
  unitSystem: UserSettingsInput['unitSystem'];
  defaultWorkoutView: UserSettingsInput['defaultWorkoutView'];
  remindersEnabled: boolean;
  restTimerSeconds: number;
  autoStartRestTimer: boolean;
  restTimerSoundEnabled: boolean;
}

type UserSettingsInputWithUndefined = {
  theme?: UserSettingsInput['theme'] | undefined;
  unitSystem?: UserSettingsInput['unitSystem'] | undefined;
  defaultWorkoutView?: UserSettingsInput['defaultWorkoutView'] | undefined;
  remindersEnabled?: UserSettingsInput['remindersEnabled'] | undefined;
  restTimerSeconds?: UserSettingsInput['restTimerSeconds'] | undefined;
  autoStartRestTimer?: UserSettingsInput['autoStartRestTimer'] | undefined;
  restTimerSoundEnabled?: UserSettingsInput['restTimerSoundEnabled'] | undefined;
};

export function mergeWithDefaults(
  input: UserSettingsInputWithUndefined | undefined,
): UserSettingsDto {
  return {
    theme: input?.theme ?? SETTINGS_DEFAULTS.theme,
    unitSystem: input?.unitSystem ?? SETTINGS_DEFAULTS.unitSystem,
    defaultWorkoutView: input?.defaultWorkoutView ?? SETTINGS_DEFAULTS.defaultWorkoutView,
    remindersEnabled: input?.remindersEnabled ?? SETTINGS_DEFAULTS.remindersEnabled,
    restTimerSeconds: input?.restTimerSeconds ?? SETTINGS_DEFAULTS.restTimerSeconds,
    autoStartRestTimer: input?.autoStartRestTimer ?? SETTINGS_DEFAULTS.autoStartRestTimer,
    restTimerSoundEnabled: input?.restTimerSoundEnabled ?? SETTINGS_DEFAULTS.restTimerSoundEnabled,
  };
}

export function applySettingsPatch(
  current: UserSettingsSnapshot | undefined,
  patch: UserSettingsPatchInput,
): UserSettingsDto {
  return mergeWithDefaults({
    theme: patch.theme ?? current?.theme,
    unitSystem: patch.unitSystem ?? current?.unitSystem,
    defaultWorkoutView: patch.defaultWorkoutView ?? current?.defaultWorkoutView,
    remindersEnabled: patch.remindersEnabled ?? current?.remindersEnabled,
    restTimerSeconds: patch.restTimerSeconds ?? current?.restTimerSeconds,
    autoStartRestTimer: patch.autoStartRestTimer ?? current?.autoStartRestTimer,
    restTimerSoundEnabled: patch.restTimerSoundEnabled ?? current?.restTimerSoundEnabled,
  });
}
