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
