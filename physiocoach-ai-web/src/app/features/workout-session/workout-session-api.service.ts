import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../../core/api/api-client';
import { type ApiClientOptions } from '../../core/api/api-client';

import {
  type ExerciseLogDto,
  type WorkoutSessionDto,
  type CreateSessionPayload,
  type SaveSetLogPayload,
} from './workout-session.model';

interface ApiResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class WorkoutSessionApiService {
  private readonly api = inject(ApiClient);

  loadActiveSession(): Observable<WorkoutSessionDto | null> {
    return this.api
      .get<ApiResponse<WorkoutSessionDto | null>>('/workout-sessions?status=active')
      .pipe(map((response) => response.data));
  }

  loadRecentSessions(): Observable<WorkoutSessionDto[]> {
    return this.api
      .get<ApiResponse<WorkoutSessionDto[]>>('/workout-sessions?status=recent')
      .pipe(map((response) => response.data));
  }

  createSession(
    payload: CreateSessionPayload,
    idempotencyKey?: string,
  ): Observable<WorkoutSessionDto> {
    const options: ApiClientOptions = idempotencyKey
      ? { headers: { 'Idempotency-Key': idempotencyKey } }
      : {};
    return this.api
      .post<
        ApiResponse<WorkoutSessionDto>,
        CreateSessionPayload
      >('/workout-sessions', payload, options)
      .pipe(map((response) => response.data));
  }

  saveSetLog(logId: string, payload: SaveSetLogPayload): Observable<ExerciseLogDto> {
    return this.api
      .patch<ApiResponse<ExerciseLogDto>, SaveSetLogPayload>(`/exercise-logs/${logId}`, payload)
      .pipe(map((response) => response.data));
  }

  completeSession(sessionId: string): Observable<WorkoutSessionDto> {
    return this.api
      .post<
        ApiResponse<WorkoutSessionDto>,
        Record<string, never>
      >(`/workout-sessions/${sessionId}/complete`, {})
      .pipe(map((response) => response.data));
  }
}
