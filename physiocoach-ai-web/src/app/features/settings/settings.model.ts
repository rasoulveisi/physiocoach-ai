export type ThemeSetting = 'light' | 'dark' | 'system';
export type UnitSetting = 'metric' | 'imperial';
export type WorkoutViewSetting = 'byExercise' | 'byDay' | 'byPlan';

export interface UserSettings {
  theme: ThemeSetting;
  unitSystem: UnitSetting;
  defaultWorkoutView: WorkoutViewSetting;
  remindersEnabled: boolean;
}
