/**
 * PhysioCoach AI — Visual & Media URL Resolvers.
 */

const PLAN_COVERS: Record<string, string> = {
  push_pull_legs: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop',
  ppl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop',
  upper_lower: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
  'upper/lower': 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
  full_body: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop',
  'full body': 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop',
  knee: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=800&auto=format&fit=crop',
  shoulder: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=800&auto=format&fit=crop',
  spine: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop',
  hypertrophy: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=800&auto=format&fit=crop',
  strength: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=800&auto=format&fit=crop',
};

const MUSCLE_COVERS: Record<string, string> = {
  chest: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop',
  back: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?q=80&w=600&auto=format&fit=crop',
  lats: 'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?q=80&w=600&auto=format&fit=crop',
  legs: 'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?q=80&w=600&auto=format&fit=crop',
  quads: 'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?q=80&w=600&auto=format&fit=crop',
  hamstrings: 'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?q=80&w=600&auto=format&fit=crop',
  calves: 'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?q=80&w=600&auto=format&fit=crop',
  glutes: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?q=80&w=600&auto=format&fit=crop',
  shoulders: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop',
  deltoids: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop',
  arms: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=600&auto=format&fit=crop',
  biceps: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=600&auto=format&fit=crop',
  triceps: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=600&auto=format&fit=crop',
  core: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=600&auto=format&fit=crop',
  abs: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=600&auto=format&fit=crop',
  neck: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=600&auto=format&fit=crop',
  mobility: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=600&auto=format&fit=crop',
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop';
const WEB_ASSET_BASE = 'https://physiocoach.otconnect.ir';

/** Get high-res cover banner for workout routine cards. */
export function getPlanCoverImage(splitOrTitle: string, tags: string[] = []): string {
  const query = `${splitOrTitle} ${tags.join(' ')}`.toLowerCase();
  for (const [key, url] of Object.entries(PLAN_COVERS)) {
    if (query.includes(key)) return url;
  }
  return DEFAULT_COVER;
}

/** Resolve exercise thumbnail/demonstration visual. */
export function getExerciseMediaUrl(exercise: {
  id?: string;
  canonicalId?: string;
  name?: string;
  mediaUrl?: string;
  primaryMuscle?: string;
  bodyPart?: string;
}): string {
  if (exercise.mediaUrl) {
    if (exercise.mediaUrl.startsWith('http://') || exercise.mediaUrl.startsWith('https://')) {
      return exercise.mediaUrl;
    }
    return `${WEB_ASSET_BASE}${exercise.mediaUrl.startsWith('/') ? '' : '/'}${exercise.mediaUrl}`;
  }

  // Check 4-digit catalog ID (e.g. 0025, 0142)
  const idStr = exercise.canonicalId || exercise.id;
  if (idStr) {
    const match = idStr.match(/(\d{4})$/);
    if (match) {
      return `${WEB_ASSET_BASE}/images/exercises/catalog/${match[1]}.webp`;
    }
  }

  // Fallback to muscle group visual
  const muscleKey = (exercise.primaryMuscle || exercise.bodyPart || exercise.name || '').toLowerCase();
  for (const [key, url] of Object.entries(MUSCLE_COVERS)) {
    if (muscleKey.includes(key)) return url;
  }

  return DEFAULT_COVER;
}
