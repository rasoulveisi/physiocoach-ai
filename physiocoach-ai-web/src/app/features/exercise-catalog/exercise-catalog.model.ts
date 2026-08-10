export interface ExerciseCatalogMediaRequest {
  exerciseId?: string;
  name?: string;
  movementPattern?: string;
  muscleGroup?: string;
}

export interface ExerciseCatalogMediaDto {
  exerciseId?: string | null;
  name?: string | null;
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

export interface ExerciseCatalogMediaBatchRequestItem extends ExerciseCatalogMediaRequest {
  key: string;
}
