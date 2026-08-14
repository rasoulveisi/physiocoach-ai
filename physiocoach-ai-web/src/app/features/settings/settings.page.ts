import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToggleSwitch } from 'primeng/toggleswitch';

import { SkeletonBlockComponent } from '../../shared/ui/skeleton-block.component';
import { AuthService } from '../../core/auth/auth.service';
import type { ThemeSetting, UnitSetting, WorkoutViewSetting } from './settings.model';
import { SettingsStore } from './settings.store';

@Component({
  standalone: true,
  imports: [ButtonModule, FormsModule, ToggleSwitch, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  protected readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private hasManualReload = false;
  private previousLoading = false;

  constructor() {
    this.store.ensureSettings();
    this.configureSettingsToasts();
  }

  protected load(): void {
    this.hasManualReload = true;
    this.messageService.add({
      severity: 'info',
      summary: 'Reload requested',
      detail: 'Loading latest settings.',
      life: 2000,
    });
    this.store.loadSettings(true);
  }

  protected onThemeChange(theme: string): void {
    this.store.setTheme((theme as ThemeSetting) ?? 'system');
  }

  protected onUnitSystemChange(unitSystem: string): void {
    this.store.setUnitSystem((unitSystem as UnitSetting) ?? 'metric');
  }

  protected onDefaultWorkoutViewChange(defaultWorkoutView: string): void {
    this.store.setDefaultWorkoutView((defaultWorkoutView as WorkoutViewSetting) ?? 'byExercise');
  }

  protected configureSettingsToasts(): void {
    this.previousLoading = this.store.loading();
    effect(() => {
      const loading = this.store.loading();
      const error = this.store.error();

      if (this.previousLoading && !loading && this.hasManualReload) {
        if (error) {
          this.messageService.add({
            severity: 'error',
            summary: 'Reload failed',
            detail: error,
            life: 3000,
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Settings reloaded',
            detail: 'Preferences updated.',
            life: 2200,
          });
        }

        this.hasManualReload = false;
      }

      this.previousLoading = loading;
    });
  }
}
