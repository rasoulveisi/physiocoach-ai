import { apiClient } from '../../../../services/api-client';

export interface FilterItem {
  id: string;
  name: string;
  count: number;
  bodyRegion?: 'anterior' | 'posterior';
}

export interface CatalogFilters {
  bodyParts: FilterItem[];
  muscles: FilterItem[];
  movementPatterns: FilterItem[];
  equipment: FilterItem[];
  safetyTags: FilterItem[];
}

export interface CatalogExerciseItem {
  id: string;
  canonicalId: string;
  name: string;
  nameLocalized?: string | null;
  bodyPart: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  movementPattern: string;
  recommendedLevel: string;
  equipment: string[];
  safetySummary: {
    overallRating: 'safe' | 'caution' | 'avoid';
    highlightTags: string[];
    excludedLimitations?: string[];
  };
}

export interface SafetyConsiderationItem {
  code: string;
  displayName: string;
  severity: string;
  rating: string;
  reason: string;
  requiredModification?: string | null;
}

export interface SaferAlternativeItem {
  id: string;
  canonicalId?: string;
  name: string;
  movementPattern: string;
  primaryMuscle: string;
  reason: string;
}

export interface ExerciseDetailItem extends CatalogExerciseItem {
  instructions: string[];
  safetyConsiderations: SafetyConsiderationItem[];
  saferAlternatives: SaferAlternativeItem[];
}

export interface CatalogQueryParams {
  q?: string;
  bodyPart?: string;
  primaryMuscle?: string;
  movementPattern?: string;
  equipment?: string;
  safetyTags?: string;
  level?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogExercisesResponse {
  data: CatalogExerciseItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function fetchCatalogFilters(): Promise<CatalogFilters> {
  const res = await apiClient.get<{ data: CatalogFilters }>('exercise-catalog/filters');
  return res.data;
}

export async function fetchCatalogExercises(
  params: CatalogQueryParams = {},
): Promise<CatalogExercisesResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.bodyPart && params.bodyPart !== 'all') query.set('bodyPart', params.bodyPart);
  if (params.primaryMuscle && params.primaryMuscle !== 'all') query.set('primaryMuscle', params.primaryMuscle);
  if (params.movementPattern && params.movementPattern !== 'all') query.set('movementPattern', params.movementPattern);
  if (params.equipment && params.equipment !== 'all') query.set('equipment', params.equipment);
  if (params.safetyTags && params.safetyTags !== 'all') query.set('safetyTags', params.safetyTags);
  if (params.level && params.level !== 'all') query.set('level', params.level);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));

  const path = `exercise-catalog/exercises${query.toString() ? `?${query.toString()}` : ''}`;
  return apiClient.get<CatalogExercisesResponse>(path);
}

export async function fetchExerciseDetail(id: string): Promise<ExerciseDetailItem> {
  const res = await apiClient.get<{ data: ExerciseDetailItem }>(`exercise-catalog/exercises/${encodeURIComponent(id)}`);
  return res.data;
}

export interface AlternativeMovement {
  id: string;
  name: string;
  targetMuscle: string;
  shearReductionReason: string;
  setupCue: string;
  mediaUrl: string | null;
}

export interface PainConditionInfo {
  code: string;
  displayName: string;
  bodyRegion: string;
  biomechanicalCause: string;
  jointShearRating: 'high' | 'moderate' | 'low';
}

export interface OriginalExerciseInfo {
  id: string;
  name: string;
  movementPattern: string;
  target: string;
  bodyPart: string;
  mediaUrl: string | null;
}

export interface SeoMetadata {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  schemaJsonLd: Record<string, unknown>;
}

export interface ExerciseAlternativesData {
  originalExercise: OriginalExerciseInfo;
  painCondition: PainConditionInfo;
  alternatives: AlternativeMovement[];
  seoMetadata: SeoMetadata;
}

export async function fetchExerciseAlternatives(slug: string): Promise<ExerciseAlternativesData> {
  const res = await apiClient.get<{ data: ExerciseAlternativesData }>(
    `exercise-catalog/alternatives/${encodeURIComponent(slug)}`,
  );
  return res.data;
}

