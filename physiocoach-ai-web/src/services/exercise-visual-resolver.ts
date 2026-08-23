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
const BASE_IMAGES = '/images/exercises';

// Specific movement named WebP images in /images/exercises/
const NAMED_EXERCISE_WEBP: Record<string, string> = {
  'goblet-squat': `${BASE_IMAGES}/goblet-squat.webp`,
  'romanian-deadlift': `${BASE_IMAGES}/romanian-deadlift.webp`,
  'lat-pulldown': `${BASE_IMAGES}/lat-pulldown.webp`,
  'chest-supported-row': `${BASE_IMAGES}/chest-supported-row.webp`,
  'hip-thrust': `${BASE_IMAGES}/hip-thrust.webp`,
};

// Muscle / pattern category WebP images in /images/exercises/
const CATEGORY_WEBP: Record<string, string> = {
  chest: `${BASE_IMAGES}/chest.webp`,
  pectorals: `${BASE_IMAGES}/chest.webp`,
  back: `${BASE_IMAGES}/back.webp`,
  lats: `${BASE_IMAGES}/back.webp`,
  traps: `${BASE_IMAGES}/back.webp`,
  arms: `${BASE_IMAGES}/arms.webp`,
  biceps: `${BASE_IMAGES}/arms.webp`,
  triceps: `${BASE_IMAGES}/arms.webp`,
  shoulders: `${BASE_IMAGES}/shoulders.webp`,
  deltoids: `${BASE_IMAGES}/shoulders.webp`,
  legs: `${BASE_IMAGES}/quadriceps.webp`,
  quads: `${BASE_IMAGES}/quadriceps.webp`,
  quadriceps: `${BASE_IMAGES}/quadriceps.webp`,
  hamstrings: `${BASE_IMAGES}/hamstrings.webp`,
  glutes: `${BASE_IMAGES}/glutes.webp`,
  calves: `${BASE_IMAGES}/calves.webp`,
  abs: `${BASE_IMAGES}/abs.webp`,
  core: `${BASE_IMAGES}/core.webp`,
  abdominals: `${BASE_IMAGES}/abs.webp`,
  squat: `${BASE_IMAGES}/squat.webp`,
  lunge: `${BASE_IMAGES}/lunge.webp`,
  hinge: `${BASE_IMAGES}/hinge.webp`,
  push: `${BASE_IMAGES}/push.webp`,
  pull: `${BASE_IMAGES}/pull.webp`,
  carry: `${BASE_IMAGES}/carry.webp`,
  mobility: `${BASE_IMAGES}/mobility.webp`,
};

export function resolveCatalogExerciseId(id?: string | null): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  // Pattern 1: ex_catalog_..._0001
  const match1 = trimmed.match(/(\d{4})$/);
  if (match1) return match1[1];
  // Pattern 2: direct 4-digit number e.g. "0001"
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  // Pattern 3: integer number e.g. "1" -> "0001"
  if (/^\d+$/.test(trimmed) && Number(trimmed) <= 3700) {
    return String(trimmed).padStart(4, '0');
  }
  return null;
}

function resolveNamedOrCategoryWebp(name: string, movementPattern?: string | null, muscleGroup?: string | null): string {
  const normName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Exact named exercise match
  for (const [key, path] of Object.entries(NAMED_EXERCISE_WEBP)) {
    if (normName.includes(key)) {
      return path;
    }
  }

  // Name keyword match
  if (normName.includes('squat')) return `${BASE_IMAGES}/squat.webp`;
  if (normName.includes('lunge') || normName.includes('split-squat')) return `${BASE_IMAGES}/lunge.webp`;
  if (normName.includes('deadlift') || normName.includes('rdl') || normName.includes('good-morning')) return `${BASE_IMAGES}/hinge.webp`;
  if (normName.includes('press') || normName.includes('pushup') || normName.includes('bench') || normName.includes('dip')) return `${BASE_IMAGES}/push.webp`;
  if (normName.includes('row') || normName.includes('pullup') || normName.includes('chin') || normName.includes('pulldown')) return `${BASE_IMAGES}/pull.webp`;
  if (normName.includes('carry') || normName.includes('walk')) return `${BASE_IMAGES}/carry.webp`;
  if (normName.includes('plank') || normName.includes('crunch') || normName.includes('core') || normName.includes('ab')) return `${BASE_IMAGES}/abs.webp`;
  if (normName.includes('stretch') || normName.includes('mobility')) return `${BASE_IMAGES}/mobility.webp`;

  // Muscle / category match
  const muscleKey = (muscleGroup || '').toLowerCase().trim();
  if (muscleKey && CATEGORY_WEBP[muscleKey]) {
    return CATEGORY_WEBP[muscleKey];
  }

  const patternKey = (movementPattern || '').toLowerCase().trim();
  if (patternKey && CATEGORY_WEBP[patternKey]) {
    return CATEGORY_WEBP[patternKey];
  }

  return `${BASE_IMAGES}/fallback.webp`;
}

export function resolveExerciseVisual(input: ExerciseVisualInput): ExerciseVisualResult {
  // 1. Direct explicit media URL passed from API (if webp/png/jpg)
  if (input.media?.imageUrl && !input.media.imageUrl.endsWith('.svg')) {
    return {
      kind: 'media',
      url: input.media.imageUrl,
      media: input.media,
    };
  }

  // 2. Deterministic PhysioCoach-owned catalog visual (.webp)
  const catalogNum = resolveCatalogExerciseId(input.masterExerciseId);
  const fallbackWebp = resolveNamedOrCategoryWebp(input.name, input.movementPattern, input.muscleGroup);

  if (catalogNum) {
    return {
      kind: 'media',
      url: `${CATALOG_BASE}/${catalogNum}.webp`,
      fallbackUrl: fallbackWebp,
      media: {
        imageUrl: `${CATALOG_BASE}/${catalogNum}.webp`,
        source: 'PhysioCoach Visual Library',
        attributionText: 'PhysioCoach-owned visual pack',
      },
    };
  }

  // 3. Category / movement WebP fallback
  return {
    kind: 'media',
    url: fallbackWebp,
    media: {
      imageUrl: fallbackWebp,
      source: 'PhysioCoach Visual Library',
      attributionText: 'PhysioCoach visual assets',
    },
  };
}
