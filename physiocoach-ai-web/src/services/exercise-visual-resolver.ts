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

export interface ExerciseVisualResult {
  kind: 'media';
  url: string;
  fallbackUrl?: string;
  media?: ExerciseImageMedia;
}

export interface ExerciseVisualInput {
  name: string;
  masterExerciseId?: string | null;
  movementPattern?: string | null;
  muscleGroup?: string | null;
  media?: ExerciseImageMedia | null;
}

const CATALOG_BASE = '/images/exercises/catalog';
const FALLBACK_IMAGE = '/images/exercises/fallback.webp';

export function resolveCatalogExerciseId(id?: string | null): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  const match = trimmed.match(/(\d{4})$/);
  if (match) return match[1];
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed) && Number(trimmed) <= 3700) {
    return String(trimmed).padStart(4, '0');
  }
  return null;
}

export function resolveExerciseVisual(input: ExerciseVisualInput): ExerciseVisualResult {
  // 1. Direct explicit media URL passed from API
  if (input.media?.imageUrl) {
    return {
      kind: 'media',
      url: input.media.imageUrl,
      fallbackUrl: FALLBACK_IMAGE,
      media: input.media,
    };
  }

  // 2. Deterministic PhysioCoach-owned catalog visual (.webp)
  const catalogNum = resolveCatalogExerciseId(input.masterExerciseId);
  if (catalogNum) {
    const catalogUrl = `${CATALOG_BASE}/${catalogNum}.webp`;
    return {
      kind: 'media',
      url: catalogUrl,
      fallbackUrl: FALLBACK_IMAGE,
      media: {
        imageUrl: catalogUrl,
        source: 'PhysioCoach Visual Library',
        attributionText: 'PhysioCoach-owned visual pack',
      },
    };
  }

  // 3. Fallback visual
  return {
    kind: 'media',
    url: FALLBACK_IMAGE,
    media: {
      imageUrl: FALLBACK_IMAGE,
      source: 'PhysioCoach Visual Library',
      attributionText: 'PhysioCoach visual assets',
    },
  };
}
