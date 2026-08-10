import { z } from 'zod';

export const SETTINGS_DEFAULTS = {
  theme: 'light',
  unitSystem: 'metric',
  defaultWorkoutView: 'byExercise',
  remindersEnabled: false,
} as const;

export const userSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  unitSystem: z.enum(['metric', 'imperial']),
  defaultWorkoutView: z.enum(['byExercise', 'byDay', 'byPlan']),
  remindersEnabled: z.boolean(),
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
}

type UserSettingsInputWithUndefined = {
  theme?: UserSettingsInput['theme'] | undefined;
  unitSystem?: UserSettingsInput['unitSystem'] | undefined;
  defaultWorkoutView?: UserSettingsInput['defaultWorkoutView'] | undefined;
  remindersEnabled?: UserSettingsInput['remindersEnabled'] | undefined;
};

export function mergeWithDefaults(
  input: UserSettingsInputWithUndefined | undefined,
): UserSettingsDto {
  return {
    theme: input?.theme ?? SETTINGS_DEFAULTS.theme,
    unitSystem: input?.unitSystem ?? SETTINGS_DEFAULTS.unitSystem,
    defaultWorkoutView: input?.defaultWorkoutView ?? SETTINGS_DEFAULTS.defaultWorkoutView,
    remindersEnabled: input?.remindersEnabled ?? SETTINGS_DEFAULTS.remindersEnabled,
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
  });
}
