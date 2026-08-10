import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from '../../core/api/api-client';
import {
  type ExerciseCatalogMediaBatchRequestItem,
  type ExerciseCatalogMediaDto,
  type ExerciseCatalogMediaRequest,
} from './exercise-catalog.model';

interface ApiResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class ExerciseCatalogApiService {
  private readonly api = inject(ApiClient);

  loadExerciseMedia(
    request: ExerciseCatalogMediaRequest,
  ): Observable<ExerciseCatalogMediaDto | null> {
    return this.api
      .get<ApiResponse<ExerciseCatalogMediaDto | null>>('/exercise-catalog/media', {
        params: compactParams(request),
      })
      .pipe(map((response) => response.data));
  }

  loadExerciseMediaBatch(
    items: ExerciseCatalogMediaBatchRequestItem[],
  ): Observable<Record<string, ExerciseCatalogMediaDto | null>> {
    const compactItems = items
      .map((item) => compactBatchItem(item))
      .filter((item) => item.key && (item.exerciseId || item.name));

    if (!compactItems.length) {
      return new Observable((subscriber) => {
        subscriber.next({});
        subscriber.complete();
      });
    }

    return this.api
      .post<ApiResponse<Record<string, ExerciseCatalogMediaDto | null>>>(
        '/exercise-catalog/media/batch',
        { items: compactItems },
      )
      .pipe(map((response) => response.data));
  }
}

function compactParams(request: ExerciseCatalogMediaRequest): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(request)) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) {
      params[key] = text;
    }
  }

  return params;
}

function compactBatchItem(
  request: ExerciseCatalogMediaBatchRequestItem,
): ExerciseCatalogMediaBatchRequestItem {
  return {
    key: request.key.trim(),
    ...compactParams(request),
  };
}
