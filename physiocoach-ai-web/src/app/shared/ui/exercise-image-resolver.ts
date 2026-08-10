const EXERCISE_IMAGE_BASE_PATH = '/images/exercises';

const OWNED_CATALOG_BASE_PATH = `${EXERCISE_IMAGE_BASE_PATH}/catalog`;

export interface ExerciseImageMedia {
  thumbnailUrl?: string | null;
  animatedGifUrl?: string | null;
  gifUrl?: string | null;
  imageUrl?: string | null;
  mediaUrl?: string | null;
  source?: string | null;
  sourceId?: string | null;
  licenseName?: string | null;
  licenseUrl?: string | null;
  licenseAuthor?: string | null;
  attributionText?: string | null;
  isAiGenerated?: boolean | null;
}

export const resolveExerciseImage = (
  masterExerciseId?: string | null,
  movementPattern?: string,
  muscleGroup?: string,
  media?: ExerciseImageMedia | null,
): string | null => {
  void movementPattern;
  void muscleGroup;
  void media;
  return resolveOwnedCatalogExerciseImage(masterExerciseId);
};

/** Returns the deterministic PhysioCoach-owned visual for an imported dataset ID. */
export const resolveOwnedCatalogExerciseImage = (
  masterExerciseId?: string | null,
): string | null => {
  const id = (masterExerciseId ?? '').trim();
  const match = id.match(/^ex_catalog_[a-z0-9_]+_(\d{4})$/i);
  return match ? `${OWNED_CATALOG_BASE_PATH}/${match[1]}.webp` : null;
};
