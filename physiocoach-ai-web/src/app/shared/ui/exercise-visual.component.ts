import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type { ExerciseImageMedia } from './exercise-image-resolver';
import {
  type ExerciseVisualResult,
  resolveExerciseVisual,
} from './exercise-visual-resolver';

@Component({
  selector: 'pc-exercise-visual',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './exercise-visual.component.html',
  host: {
    class: 'block min-w-0',
  },
})
export class ExerciseVisualComponent {
  readonly name = input('');
  readonly masterExerciseId = input<string | null | undefined>(null);
  readonly movementPattern = input<string | null | undefined>(null);
  readonly muscleGroup = input<string | null | undefined>(null);
  readonly media = input<ExerciseImageMedia | null | undefined>(null);
  readonly loading = input(false);
  readonly compact = input(false);

  protected readonly mediaFailed = signal(false);
  protected readonly stageClasses = computed(() =>
    this.compact()
      ? 'h-14 w-14 p-1 bg-white rounded-lg border border-slate-200'
      : 'w-full max-w-2xl mx-auto h-64 sm:h-72 p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center',
  );

  protected readonly visual = computed<ExerciseVisualResult>(() => {
    if (this.mediaFailed()) {
      return { kind: 'unavailable' };
    }
    const media = this.mediaFailed() ? null : this.media();
    return resolveExerciseVisual({
      name: this.name(),
      masterExerciseId: this.masterExerciseId(),
      movementPattern: this.movementPattern(),
      muscleGroup: this.muscleGroup(),
      media,
    });
  });

  protected readonly attribution = computed(() => {
    const visual = this.visual();
    if (visual.kind !== 'media') {
      return '';
    }

    const media = visual.media;
    const attributionText = media.attributionText?.trim();
    if (attributionText) {
      return attributionText;
    }

    const author = media.licenseAuthor?.trim();
    const source = media.source?.trim();
    const license = media.licenseName?.trim();
    if (author && source) {
      return `Source: ${source} / ${author}`;
    }
    if (source) {
      return `Source: ${source}`;
    }
    if (author && license) {
      return `${license} / ${author}`;
    }
    if (license) {
      return license;
    }
    return '';
  });

  protected onImageError(): void {
    console.warn('exercise_visual.image_failed', {
      masterExerciseId: this.masterExerciseId(),
      name: this.name(),
    });
    this.mediaFailed.set(true);
  }

  protected onImageLoad(): void {
    this.mediaFailed.set(false);
  }

}
