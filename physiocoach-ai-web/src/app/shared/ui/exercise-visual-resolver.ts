import {
  resolveOwnedCatalogExerciseImage,
  type ExerciseImageMedia,
} from './exercise-image-resolver';

export type ExerciseVisualResult =
  | { kind: 'media'; url: string; media: ExerciseImageMedia }
  | { kind: 'unavailable' };

export interface ExerciseVisualInput {
  name: string;
  masterExerciseId?: string | null;
  movementPattern?: string | null;
  muscleGroup?: string | null;
  media?: ExerciseImageMedia | null;
}

export function resolveExerciseVisual(input: ExerciseVisualInput): ExerciseVisualResult {
  const ownedCatalogUrl = resolveOwnedCatalogExerciseImage(input.masterExerciseId);
  if (ownedCatalogUrl) {
    return {
      kind: 'media',
      url: ownedCatalogUrl,
      media: {
        imageUrl: ownedCatalogUrl,
        source: 'PhysioCoach-owned visual pack',
        attributionText: 'PhysioCoach-owned visual pack',
      },
    };
  }

  return { kind: 'unavailable' };
}
