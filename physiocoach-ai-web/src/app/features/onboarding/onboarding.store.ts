import { computed, Injectable, PLATFORM_ID, Signal, signal, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, EMPTY, take } from 'rxjs';

import { ProfileStateService } from '../../core/auth/profile-state.service';
import { OnboardingApiService } from './onboarding-api.service';
import {
  type ProfilePayload,
  type AssessmentPayload,
  type OnboardingState,
  type GenerationSnapshot,
  type AssessmentConsideration,
  type BodyConsiderationOption,
} from './onboarding.model';

const generationSnapshotStorageKey = 'physiocoach_last_generation_snapshot_v1';

const initialState: OnboardingState = {
  age: 30,
  sex: 'prefer_not_to_say',
  heightCm: 175,
  weightKg: 75,
  lifestyle: 'desk_job',
  experienceLevel: 'beginner',
  goals: ['posture_improvement'],
  frequencyDays: 3,
  equipment: ['full_gym'],
  limitations: [],
  postureFlags: [],
  considerations: [
    { code: 'rounded_shoulders', severity: 'mild', side: 'unspecified', inferred: false },
  ],
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();

    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key] as unknown)}`)
      .join(',')}
    }`;
  }

  return JSON.stringify(value);
}

@Injectable({ providedIn: 'root' })
export class OnboardingStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileState = inject(ProfileStateService);
  private readonly onboardingApi = inject(OnboardingApiService);

  readonly state = signal<OnboardingState>(initialState);
  readonly considerationOptions = signal<BodyConsiderationOption[]>([]);
  readonly considerationOptionsError = signal<string | null>(null);
  readonly latestAssessmentError = signal<string | null>(null);
  readonly considerationGroups = computed(() => {
    const groups = new Map<string, BodyConsiderationOption[]>();
    for (const option of this.considerationOptions()) {
      groups.set(option.groupCode, [...(groups.get(option.groupCode) ?? []), option]);
    }
    return Array.from(groups, ([code, options]) => ({ code, options }));
  });
  private readonly lastGeneration = signal<GenerationSnapshot | null>(this.readSnapshot());

  readonly assessmentPayload = computed(() => {
    const state = this.state();
    return {
      goals: [...state.goals],
      frequencyDays: normalizeInteger(state.frequencyDays, 3, 2, 5),
      equipment: [...state.equipment],
      considerations: state.considerations.map((consideration) => ({ ...consideration })),
      limitations: [...state.limitations],
      postureFlags: [...state.postureFlags],
    };
  });

  readonly profilePayload = computed(() => {
    const state = this.state();
    const profile: ProfilePayload = {
      age: normalizeInteger(state.age, 30, 13, 100),
      sex: state.sex ?? 'prefer_not_to_say',
      heightCm: normalizeNumber(state.heightCm, 175, 100, 250),
      weightKg: normalizeNumber(state.weightKg, 75, 30, 300),
      lifestyle: state.lifestyle ?? 'desk_job',
      experienceLevel: state.experienceLevel ?? 'beginner',
    };

    if (state.bodyFatEstimate !== undefined) {
      profile.bodyFatEstimate = normalizeNumber(state.bodyFatEstimate, 20, 3, 70);
    }

    return profile;
  });

  readonly lastGenerationSnapshot = computed(() => this.lastGeneration());

  readonly lastGenerationInputHash: Signal<string | null> = computed(
    () => this.lastGeneration()?.inputHash ?? null,
  );

  readonly hasMajorChangesSinceLastGeneration = computed(() => {
    const snapshot = this.lastGeneration();
    if (!snapshot) {
      return false;
    }

    return (
      this.buildInputFingerprint(this.profilePayload(), this.assessmentPayload()) !==
      this.buildInputFingerprint(snapshot.profile, {
        goals: [...snapshot.assessment.goals],
        frequencyDays: snapshot.assessment.frequencyDays,
        equipment: [...snapshot.assessment.equipment],
        considerations: (snapshot.assessment.considerations ?? []).map((consideration) => ({
          ...consideration,
        })),
        limitations: [...snapshot.assessment.limitations],
        postureFlags: [...snapshot.assessment.postureFlags],
      })
    );
  });

  constructor() {
    this.loadProfileFromApi();
    this.retryConsiderationOptions();
    this.retryLatestAssessment();
  }

  update(patch: Partial<OnboardingState>): void {
    this.state.update((current) => ({ ...current, ...patch }));
  }

  toggleConsideration(option: BodyConsiderationOption, selected: boolean): void {
    const current = this.state().considerations;
    this.update({
      considerations: selected
        ? [
            ...current,
            { code: option.code, severity: 'mild', side: 'unspecified', inferred: false },
          ]
        : current.filter(({ code }) => code !== option.code),
    });
  }

  setConsiderationSeverity(code: string, severity: AssessmentConsideration['severity']): void {
    this.update({
      considerations: this.state().considerations.map((consideration) =>
        consideration.code === code
          ? { ...consideration, severity, inferred: false }
          : consideration,
      ),
    });
  }

  retryLatestAssessment(): void {
    this.latestAssessmentError.set(null);
    this.loadLatestAssessmentFromApi();
  }

  retryConsiderationOptions(): void {
    this.considerationOptionsError.set(null);
    this.loadConsiderationsFromApi();
  }

  rememberGenerationResult(inputHash: string): void {
    this.lastGeneration.set({
      inputHash,
      assessment: {
        ...this.assessmentPayload(),
        frequencyDays: this.assessmentPayload().frequencyDays,
      },
      profile: this.profilePayload(),
      updatedAt: new Date().toISOString(),
    });
    this.writeSnapshot(this.lastGeneration()!);
  }

  private loadProfileFromApi(): void {
    this.profileState
      .getProfileOnce()
      .pipe(take(1))
      .subscribe((payload) => {
        if (!payload) {
          return;
        }

        this.update({
          age: payload.age,
          sex: payload.sex,
          heightCm: payload.heightCm,
          weightKg: payload.weightKg,
          bodyFatEstimate: payload.bodyFatEstimate,
          lifestyle: payload.lifestyle,
          experienceLevel: payload.experienceLevel,
        });
      });
  }

  private loadLatestAssessmentFromApi(): void {
    this.onboardingApi
      .getLatestAssessment()
      .pipe(
        take(1),
        catchError(() => {
          this.latestAssessmentError.set(
            'Your previous assessment could not be loaded. Continue with these defaults or retry.',
          );
          return EMPTY;
        }),
      )
      .subscribe((response) => {
        if (!response?.data) {
          return;
        }

        this.update({
          goals: response.data.goals ?? [],
          frequencyDays: response.data.frequencyDays ?? 3,
          equipment: response.data.equipment ?? [],
          limitations: response.data.limitations ?? [],
          postureFlags: response.data.postureFlags ?? [],
          considerations: response.data.considerations ?? [],
        });
      });
  }

  private loadConsiderationsFromApi(): void {
    this.onboardingApi
      .getConsiderations()
      .pipe(
        take(1),
        catchError(() => {
          this.considerationOptionsError.set(
            'Body considerations could not be loaded. Retry to see all available options.',
          );
          return EMPTY;
        }),
      )
      .subscribe((response) => {
        this.considerationOptions.set(response.data ?? []);
      });
  }

  private buildInputFingerprint(profile: ProfilePayload, assessment: AssessmentPayload): string {
    const normalized = {
      profile: {
        ...profile,
      },
      assessment: {
        ...assessment,
        goals: [...assessment.goals].sort(),
        equipment: [...assessment.equipment].sort(),
        considerations: [...assessment.considerations]
          .map((consideration) => ({ ...consideration }))
          .sort((left, right) => left.code.localeCompare(right.code)),
        limitations: [...assessment.limitations].sort(),
        postureFlags: [...assessment.postureFlags].sort(),
      },
    };

    return stableStringify(normalized);
  }

  private readSnapshot(): GenerationSnapshot | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const raw = localStorage.getItem(generationSnapshotStorageKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as GenerationSnapshot;
    } catch {
      return null;
    }
  }

  private writeSnapshot(snapshot: GenerationSnapshot): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      localStorage.setItem(generationSnapshotStorageKey, JSON.stringify(snapshot));
    } catch {
      // best-effort persistence
    }
  }
}

export type { ProfilePayload, AssessmentPayload };

function normalizeInteger(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const candidate =
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;

  return Math.min(max, Math.max(min, candidate));
}

function normalizeNumber(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const candidate = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return Math.min(max, Math.max(min, candidate));
}
