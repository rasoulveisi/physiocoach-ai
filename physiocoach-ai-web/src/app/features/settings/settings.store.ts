import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, take, tap } from 'rxjs';

import { SettingsApiService } from './settings-api.service';
import {
  type ThemeSetting,
  type UnitSetting,
  type WorkoutViewSetting,
  type UserSettings,
} from './settings.model';
import { ThemeService } from '../../core/theme/theme.service';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  unitSystem: 'metric',
  defaultWorkoutView: 'byExercise',
  remindersEnabled: false,
};

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(SettingsApiService);
  private readonly themeService = inject(ThemeService);
  private hasLoadedSettings = false;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly settings = signal<UserSettings>(DEFAULT_SETTINGS);

  readonly loading$ = toObservable(this.loading);
  readonly error$ = toObservable(this.error);
  readonly settings$ = toObservable(this.settings);
  readonly unitsLabel = computed(() =>
    this.settings().unitSystem === 'metric' ? 'kg/cm' : 'lbs/in',
  );

  ensureSettings(): void {
    if (this.hasLoadedSettings || this.loading()) {
      return;
    }

    this.loadSettings();
  }

  loadSettings(force = false): void {
    if (!force && (this.hasLoadedSettings || this.loading())) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .getSettings()
      .pipe(
        take(1),
        tap((settings) => {
          const localTheme = this.themeService.readStoredTheme();
          const resolvedSettings = localTheme ? { ...settings, theme: localTheme } : settings;

          this.settings.set(resolvedSettings);
          this.themeService.applyTheme(resolvedSettings.theme, false);
          this.hasLoadedSettings = true;
        }),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not load settings.');
          const fallbackSettings = {
            ...DEFAULT_SETTINGS,
            theme: this.themeService.readStoredTheme() ?? DEFAULT_SETTINGS.theme,
          };

          this.settings.set(fallbackSettings);
          this.themeService.applyTheme(fallbackSettings.theme, false);
          this.hasLoadedSettings = true;
          return EMPTY;
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }

  patchSetting<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    const patch = { [key]: value } as Partial<UserSettings>;
    const current = this.settings();
    const next = { ...current, ...patch };

    this.settings.set(next);

    if (key === 'theme') {
      this.themeService.applyTheme(value as ThemeSetting);
    }

    this.api
      .patchSettings(patch)
      .pipe(take(1))
      .subscribe({
        error: (error) => {
          if (key === 'theme') {
            this.settings.set(next);
            this.error.set(null);
            return;
          }

          this.error.set(error instanceof Error ? error.message : 'Could not save settings.');
          this.settings.set(current);
        },
        next: (updated) => {
          const updatedSettings = key === 'theme' ? { ...updated, theme: next.theme } : updated;

          this.settings.set(updatedSettings);
          this.themeService.applyTheme(updatedSettings.theme, false);
          this.hasLoadedSettings = true;
        },
      });
  }

  setTheme(theme: ThemeSetting): void {
    this.patchSetting('theme', theme);
  }

  setUnitSystem(unitSystem: UnitSetting): void {
    this.patchSetting('unitSystem', unitSystem);
  }

  setDefaultWorkoutView(defaultWorkoutView: WorkoutViewSetting): void {
    this.patchSetting('defaultWorkoutView', defaultWorkoutView);
  }

  setRemindersEnabled(remindersEnabled: boolean): void {
    this.patchSetting('remindersEnabled', remindersEnabled);
  }
}
