/**
 * PhysioCoach AI — Exercise Catalog API methods.
 */

import { request } from './client';

export interface ExerciseCatalogItem {
  id: string;
  canonicalId?: string;
  name: string;
  nameLocalized?: string;
  bodyPart?: string;
  target?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  movementPattern?: string;
  recommendedLevel?: string;
  mediaUrl?: string;
  mediaType?: string;
  excludedLimitations?: string[];
  equipment?: string | string[];
  instructions?: string[] | string;
}

export interface ExerciseCatalogResponse {
  data: ExerciseCatalogItem[];
  pagination: {
    total: number;
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

export interface ExerciseFilterParams {
  q?: string;
  bodyPart?: string;
  primaryMuscle?: string;
  movementPattern?: string;
  equipment?: string;
  safetyTags?: string;
  limit?: number;
  offset?: number;
}

/** GET /exercise-catalog/exercises — browse and search exercises with filters. */
export async function getExerciseCatalog(
  params: ExerciseFilterParams = {},
): Promise<ExerciseCatalogResponse> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.bodyPart && params.bodyPart !== 'all') query.set('bodyPart', params.bodyPart);
  if (params.primaryMuscle && params.primaryMuscle !== 'all') query.set('primaryMuscle', params.primaryMuscle);
  if (params.movementPattern && params.movementPattern !== 'all') query.set('movementPattern', params.movementPattern);
  if (params.equipment && params.equipment !== 'all') query.set('equipment', params.equipment);
  if (params.safetyTags) query.set('safetyTags', params.safetyTags);
  query.set('limit', String(params.limit || 30));
  if (params.offset) query.set('offset', String(params.offset));

  const endpoint = `/exercise-catalog/exercises?${query.toString()}`;
  try {
    return await request<ExerciseCatalogResponse>(endpoint, { method: 'GET', auth: false });
  } catch {
    return {
      data: [],
      pagination: { total: 0, hasMore: false, limit: 30, offset: 0 },
    };
  }
}

/** GET /exercise-catalog/exercises/:id — single exercise detail. */
export async function getExerciseById(id: string): Promise<{ data: ExerciseCatalogItem | null }> {
  try {
    return await request<{ data: ExerciseCatalogItem }>(`/exercise-catalog/exercises/${encodeURIComponent(id)}`, {
      method: 'GET',
      auth: false,
    });
  } catch {
    return { data: null };
  }
}

/**
 * GET /exercises/:id/alternatives (fallback: /exercise-catalog/exercises/:id/alternatives)
 * Direct exercise alternatives query supporting limitations and biomechanical pattern filters.
 */
export async function getDirectExerciseAlternatives(
  exerciseId: string,
  limitations?: string[],
  movementPattern?: string,
  primaryMuscle?: string,
): Promise<{ data: ExerciseCatalogItem[] }> {
  const query = new URLSearchParams();
  if (limitations && limitations.length > 0) {
    query.set('limitations', limitations.join(','));
  }
  if (movementPattern?.trim()) {
    query.set('movementPattern', movementPattern.trim());
  }
  if (primaryMuscle?.trim()) {
    query.set('primaryMuscle', primaryMuscle.trim());
  }
  const queryString = query.toString();
  const querySuffix = queryString ? `?${queryString}` : '';

  try {
    const res = await request<{ data: ExerciseCatalogItem[] }>(
      `/exercises/${encodeURIComponent(exerciseId)}/alternatives${querySuffix}`,
      { method: 'GET' },
    );
    return { data: Array.isArray(res?.data) ? res.data : [] };
  } catch {
    try {
      const fallback = await request<{ data: ExerciseCatalogItem[] }>(
        `/exercise-catalog/exercises/${encodeURIComponent(exerciseId)}/alternatives${querySuffix}`,
        { method: 'GET' },
      );
      return { data: Array.isArray(fallback?.data) ? fallback.data : [] };
    } catch {
      return { data: [] };
    }
  }
}

