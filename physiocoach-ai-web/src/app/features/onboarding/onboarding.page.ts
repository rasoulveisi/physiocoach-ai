import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ViewportScroller } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';

import { ProfileStateService } from '../../core/auth/profile-state.service';
import { NumberRangePickerComponent } from '../../shared/ui/number-range-picker.component';
import { OnboardingApiService } from './onboarding-api.service';
import {
  type AssessmentPayload,
  type ProfilePayload,
  type BodyConsiderationOption,
} from './onboarding.model';
import { OnboardingStore } from './onboarding.store';
import { WorkoutPlanStore } from '../workout-plan/workout-plan.store';

@Component({
  standalone: true,
  imports: [ButtonModule, CardModule, NumberRangePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.page.html',
})
export class OnboardingPage {
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly profileState = inject(ProfileStateService);
  private readonly router = inject(Router);
  protected readonly store = inject(OnboardingStore);
  private readonly workoutPlanStore = inject(WorkoutPlanStore);
  private readonly viewportScroller = inject(ViewportScroller);
  protected readonly Math = Math;

  protected readonly currentStep = signal<number>(1);
  protected readonly isSubmitting = signal(false);
  protected readonly generationError = signal<string | null>(null);
  protected readonly mobileStepCount = 12;

  protected readonly medicalDisclaimer =
    'Educational fitness recommendations only. Not medical advice.';

  protected readonly sexOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ];

  protected readonly lifestyleOptions = [
    { label: 'Desk job', value: 'desk_job' },
    { label: 'Standing job', value: 'standing_job' },
    { label: 'Active', value: 'active' },
  ];

  protected readonly experienceOptions = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' },
  ];

  protected readonly goalOptions = [
    { label: 'Muscle gain', value: 'muscle_gain' },
    { label: 'Fat loss', value: 'fat_loss' },
    { label: 'Posture improvement', value: 'posture_improvement' },
    { label: 'Mobility', value: 'mobility' },
    { label: 'Strength', value: 'strength' },
    { label: 'Aesthetics', value: 'aesthetics' },
    { label: 'Recomposition', value: 'recomposition' },
  ];

  protected readonly equipmentOptions = [
    { label: 'Full gym', value: 'full_gym' },
    { label: 'Dumbbells only', value: 'dumbbells_only' },
    { label: 'Home gym', value: 'home_gym' },
    { label: 'Resistance bands', value: 'resistance_bands' },
  ];

  protected readonly ageError = computed(() => {
    const age = this.store.state().age;
    if (age === null) {
      return 'Age is required and must be a whole number between 13 and 100.';
    }
    return Number.isInteger(age) && age >= 13 && age <= 100
      ? null
      : 'Age is required and must be a whole number between 13 and 100.';
  });

  protected readonly sexError = computed(() =>
    this.store.state().sex ? null : 'Sex is required.',
  );

  protected readonly heightError = computed(() => {
    const heightCm = this.store.state().heightCm;
    if (heightCm === null) {
      return 'Height is required and must be between 100 and 250 cm.';
    }
    return heightCm >= 100 && heightCm <= 250
      ? null
      : 'Height is required and must be between 100 and 250 cm.';
  });

  protected readonly weightError = computed(() => {
    const weightKg = this.store.state().weightKg;
    if (weightKg === null) {
      return 'Weight is required and must be between 30 and 300 kg.';
    }
    return weightKg >= 30 && weightKg <= 300
      ? null
      : 'Weight is required and must be between 30 and 300 kg.';
  });

  protected readonly bodyFatEstimateError = computed(() => {
    const bodyFatEstimate = this.store.state().bodyFatEstimate;

    if (bodyFatEstimate === undefined) {
      return null;
    }

    return bodyFatEstimate >= 3 && bodyFatEstimate <= 70
      ? null
      : 'Body fat must be between 3 and 70 percent.';
  });

  protected readonly equipmentError = computed(() =>
    this.store.state().equipment.length > 0 ? null : 'Select at least one equipment option.',
  );

  protected readonly frequencyDaysError = computed(() => {
    const frequencyDays = this.store.state().frequencyDays;
    if (frequencyDays === null) {
      return 'Training days is required and must be a whole number between 2 and 5.';
    }

    return Number.isInteger(frequencyDays) && frequencyDays >= 2 && frequencyDays <= 5
      ? null
      : 'Training days is required and must be a whole number between 2 and 5.';
  });

  protected readonly goalsError = computed(() =>
    this.store.state().goals.length > 0 ? null : 'Pick at least one goal.',
  );

  protected get desktopStage(): number {
    const step = this.currentStep();
    if (step <= 5) return 1;
    if (step <= 8) return 2;
    if (step <= 11) return 3;
    return 4;
  }

  protected readonly canAdvanceStep = computed(() => {
    const step = this.currentStep();
    switch (step) {
      case 1:
        return this.ageError() === null;
      case 2:
        return this.sexError() === null;
      case 3:
        return this.heightError() === null;
      case 4:
        return this.weightError() === null;
      case 5:
        return this.bodyFatEstimateError() === null;
      case 6:
        return true;
      case 7:
        return true;
      case 8:
        return this.frequencyDaysError() === null;
      case 9:
        return this.equipmentError() === null;
      case 10:
        return true;
      case 11:
        return true;
      case 12:
        return this.goalsError() === null;
      default:
        return false;
    }
  });

  protected readonly canAdvanceDesktop = computed(() => {
    const stage = this.desktopStage;
    if (stage === 1) {
      return (
        this.ageError() === null &&
        this.sexError() === null &&
        this.heightError() === null &&
        this.weightError() === null &&
        this.bodyFatEstimateError() === null
      );
    }
    if (stage === 2) {
      return this.frequencyDaysError() === null;
    }
    if (stage === 3) {
      return this.equipmentError() === null;
    }
    return this.goalsError() === null;
  });

  nextStep(): void {
    this.generationError.set(null);
    const isSingleStepViewport = this.isSingleStepViewport();

    if (isSingleStepViewport) {
      if (!this.canAdvanceStep()) return;
      if (this.currentStep() < this.mobileStepCount) {
        this.saveCurrentStepSnapshot(true);
        this.currentStep.set(this.currentStep() + 1);
        this.scrollToTop();
      }
    } else {
      if (!this.canAdvanceDesktop()) return;
      const stage = this.desktopStage;
      if (stage === 1) {
        this.saveCurrentStepSnapshot(false);
        this.currentStep.set(6);
      } else if (stage === 2) {
        this.saveCurrentStepSnapshot(false);
        this.currentStep.set(9);
      } else if (stage === 3) {
        this.saveCurrentStepSnapshot(false);
        this.currentStep.set(12);
      }
      this.scrollToTop();
    }
  }

  previousStep(): void {
    this.generationError.set(null);
    const isSingleStepViewport = this.isSingleStepViewport();

    if (isSingleStepViewport) {
      if (this.currentStep() > 1) {
        this.currentStep.set(this.currentStep() - 1);
        this.scrollToTop();
      }
    } else {
      const stage = this.desktopStage;
      if (stage === 2) {
        this.currentStep.set(1);
      } else if (stage === 3) {
        this.currentStep.set(6);
      } else if (stage === 4) {
        this.currentStep.set(9);
      }
      this.scrollToTop();
    }
  }

  private scrollToTop(): void {
    requestAnimationFrame(() => {
      this.viewportScroller.scrollToPosition([0, 0]);
    });
  }

  submit(): void {
    const isSingleStepViewport = this.isSingleStepViewport();
    if (isSingleStepViewport) {
      if (!this.canAdvanceStep()) return;
    } else {
      if (!this.canAdvanceDesktop()) return;
    }

    this.isSubmitting.set(true);
    this.generationError.set(null);

    const assessment = this.assessmentPayload();
    const profile = this.profilePayload();

    this.onboardingApi
      .saveProfile(profile)
      .pipe(
        tap((response) => {
          this.profileState.setProfile(response.data ?? profile);
        }),
        switchMap(() => this.onboardingApi.createAssessment(assessment)),
        tap(() => {
          this.workoutPlanStore.generatePlan(profile, assessment);
        }),
        catchError((error: unknown) => {
          this.generationError.set(this.getGenerationErrorMessage(error));
          return of(null);
        }),
        finalize(() => {
          this.isSubmitting.set(false);
        }),
      )
      .subscribe((res) => {
        if (res !== null) {
          void this.router.navigate(['/plan']);
        }
      });
  }

  protected updateNumber(
    field: 'age' | 'heightCm' | 'weightKg' | 'frequencyDays',
    event: Event | number | undefined,
  ): void {
    const value =
      typeof event === 'number'
        ? event
        : event === undefined
          ? Number.NaN
          : Number((event.target as HTMLInputElement | HTMLSelectElement).value);

    this.store.update({ [field]: Number.isFinite(value) ? value : null });
  }

  protected updateOptionalNumber(
    field: 'bodyFatEstimate',
    event: Event | number | undefined,
  ): void {
    const value =
      typeof event === 'number'
        ? event
        : event === undefined
          ? undefined
          : (event.target as HTMLInputElement).value === ''
            ? undefined
            : Number((event.target as HTMLInputElement).value);

    this.store.update({
      [field]:
        value === undefined || Number.isNaN(value) ? undefined : Math.max(3, Math.min(70, value)),
    });
  }

  protected isNumericMobileStep(step = this.currentStep()): boolean {
    return step === 1 || step === 3 || step === 4 || step === 5 || step === 8;
  }

  protected confirmNumberAndAdvance(
    field: 'age' | 'heightCm' | 'weightKg' | 'frequencyDays',
    value: number | undefined,
  ): void {
    this.updateNumber(field, value);
    this.nextStep();
  }

  protected confirmOptionalNumberAndAdvance(
    field: 'bodyFatEstimate',
    value: number | undefined,
  ): void {
    this.updateOptionalNumber(field, value);
    this.nextStep();
  }

  protected selectOptionAndAdvance(
    field: 'sex' | 'lifestyle' | 'experienceLevel' | 'frequencyDays',
    value: string | number,
  ): void {
    if (field === 'frequencyDays') {
      this.store.update({ frequencyDays: Number(value) });
    } else {
      this.store.update({ [field]: value as string });
    }

    if (this.isSingleStepViewport() && this.currentStep() < this.mobileStepCount) {
      this.nextStep();
    }
  }

  protected toggleArrayValue(
    field: 'goals' | 'equipment' | 'limitations' | 'postureFlags',
    value: string,
    event: Event | boolean,
  ): void {
    const checked = typeof event === 'boolean' ? event : (event.target as HTMLInputElement).checked;
    const current = this.store.state()[field];
    this.store.update({
      [field]: checked ? [...current, value] : current.filter((item) => item !== value),
    });
  }

  protected toggleConsideration(option: BodyConsiderationOption, event: Event | boolean): void {
    const selected =
      typeof event === 'boolean' ? event : (event.target as HTMLInputElement).checked;
    this.store.toggleConsideration(option, selected);
  }

  protected setConsiderationSeverity(code: string, severity: string): void {
    if (severity === 'mild' || severity === 'moderate' || severity === 'severe') {
      this.store.setConsiderationSeverity(code, severity);
    }
  }

  protected isConsiderationSelected(code: string): boolean {
    return this.store.state().considerations.some((consideration) => consideration.code === code);
  }

  protected considerationSeverity(code: string): 'mild' | 'moderate' | 'severe' | null {
    return (
      this.store.state().considerations.find((consideration) => consideration.code === code)
        ?.severity ?? null
    );
  }

  protected isInferredConsideration(code: string): boolean {
    return (
      this.store.state().considerations.find((consideration) => consideration.code === code)
        ?.inferred ?? false
    );
  }

  private getGenerationErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error;
      const message = payload?.error?.message ?? payload?.message;
      if (typeof message === 'string') {
        return `${message} If this keeps happening, please contact support.`;
      }
    }

    if (error instanceof Error) {
      return `${error.message} If this keeps happening, please contact support.`;
    }

    return 'Plan generation failed. Please retry or contact support.';
  }

  private profilePayload(): ProfilePayload {
    return this.store.profilePayload();
  }

  private assessmentPayload(): AssessmentPayload {
    return this.store.assessmentPayload();
  }

  private isSingleStepViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  }

  private saveCurrentStepSnapshot(isMobile: boolean): void {
    const step = this.currentStep();
    const stage = this.desktopStage;
    const shouldSaveProfile = isMobile ? step >= 1 && step <= 7 : stage === 1 || stage === 2;
    const shouldSaveAssessment = isMobile ? step >= 8 && step <= 11 : stage === 2 || stage === 3;

    if (shouldSaveProfile) {
      this.saveProfileSnapshot().subscribe();
    }

    if (shouldSaveAssessment) {
      this.saveAssessmentSnapshot().subscribe();
    }
  }

  private saveProfileSnapshot() {
    const profile = this.profilePayload();
    return this.onboardingApi.saveProfile(profile).pipe(
      tap((response) => {
        this.profileState.setProfile(response.data ?? profile);
      }),
      catchError(() => of(null)),
    );
  }

  private saveAssessmentSnapshot() {
    const assessment = this.assessmentPayload();
    return this.onboardingApi.createAssessment(assessment).pipe(catchError(() => of(null)));
  }
}
