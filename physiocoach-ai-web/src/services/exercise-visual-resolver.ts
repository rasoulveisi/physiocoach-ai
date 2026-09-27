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

const DEFAULT_FALLBACK_BY_MUSCLE: Record<string, string> = {
  chest: '0025',
  pectorals: '0025',
  back: '0007',
  lats: '0007',
  quads: '0043',
  quadriceps: '0043',
  hamstrings: '0085',
  glutes: '0085',
  shoulders: '0071',
  delts: '0071',
  deltoids: '0071',
  serratus: '0071',
  biceps: '0010',
  triceps: '0055',
  core: '0001',
  abs: '0001',
  calves: '0088',
};

const DEFAULT_FALLBACK_BY_PATTERN: Record<string, string> = {
  push: '0025',
  pull: '0007',
  squat: '0043',
  hinge: '0085',
  lunge: '0043',
  core: '0001',
  mobility: '0071',
};

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

  // 2. Deterministic PhysioCoach-owned catalog visual (.webp) from masterExerciseId
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

  // 3. Fallback based on muscleGroup or movementPattern
  const muscleKey = input.muscleGroup?.toLowerCase().trim();
  const patternKey = input.movementPattern?.toLowerCase().trim();
  const fallbackNum =
    (muscleKey && DEFAULT_FALLBACK_BY_MUSCLE[muscleKey]) ||
    (patternKey && DEFAULT_FALLBACK_BY_PATTERN[patternKey]) ||
    '0025';

  const fallbackCatalogUrl = `${CATALOG_BASE}/${fallbackNum}.webp`;
  return {
    kind: 'media',
    url: fallbackCatalogUrl,
    fallbackUrl: FALLBACK_IMAGE,
    media: {
      imageUrl: fallbackCatalogUrl,
      source: 'PhysioCoach Visual Library',
      attributionText: 'PhysioCoach visual assets',
    },
  };
}
