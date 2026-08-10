import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, of, take, tap } from 'rxjs';
import { WorkoutSessionApiService } from './workout-session-api.service';
import {
  type CreateSessionPayload,
  type SaveSetLogPayload,
  type WorkoutSessionDto,
} from './workout-session.model';

@Injectable({ providedIn: 'root' })
export class WorkoutSessionStore {
  private readonly api = inject(WorkoutSessionApiService);
  private hasLoadedActiveSession = false;
  private hasLoadedRecentSessions = false;
  private recentSessionsLoading = signal(false);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeSession = signal<WorkoutSessionDto | null>(null);
  readonly recentSessions = signal<WorkoutSessionDto[]>([]);
  readonly loading$ = toObservable(this.loading);
  readonly error$ = toObservable(this.error);
  readonly activeSession$ = toObservable(this.activeSession);
  readonly recentSessions$ = toObservable(this.recentSessions);

  readonly completedSets = computed(() => this.activeSession()?.progress.completedSets ?? 0);
  readonly totalSets = computed(() => this.activeSession()?.progress.totalSets ?? 0);

  ensureActiveSession(): void {
    if (this.hasLoadedActiveSession || this.loading()) {
      return;
    }

    this.loadActiveSession();
  }

  ensureRecentSessions(): void {
    if (this.hasLoadedRecentSessions || this.recentSessionsLoading()) {
      return;
    }

    this.loadRecentSessions();
  }

  loadActiveSession(force = false): void {
    if (!force && (this.hasLoadedActiveSession || this.loading())) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .loadActiveSession()
      .pipe(
        take(1),
        tap((session) => {
          this.activeSession.set(session);
          this.hasLoadedActiveSession = true;
        }),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not load active session.');
          this.hasLoadedActiveSession = true;
          return EMPTY;
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }

  loadRecentSessions(force = false): void {
    if (!force && (this.hasLoadedRecentSessions || this.recentSessionsLoading())) {
      return;
    }

    this.recentSessionsLoading.set(true);
    this.api
      .loadRecentSessions()
      .pipe(
        take(1),
        catchError((error) => {
          this.error.set(
            error instanceof Error ? error.message : 'Could not load recent sessions.',
          );
          return of([]);
        }),
        finalize(() => {
          this.recentSessionsLoading.set(false);
        }),
      )
      .subscribe((sessions) => {
        this.recentSessions.set(sessions);
        this.hasLoadedRecentSessions = true;
      });
  }

  createSession(payload: CreateSessionPayload, idempotencyKey?: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .createSession(payload, idempotencyKey)
      .pipe(
        take(1),
        tap((session) => {
          this.activeSession.set(session);
          this.hasLoadedActiveSession = true;
        }),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not start workout.');
          return EMPTY;
        }),
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe();
  }

  saveSetLog(logId: string, payload: SaveSetLogPayload): void {
    this.api
      .saveSetLog(logId, payload)
      .pipe(
        take(1),
        tap((updatedLog) => {
          this.activeSession.update((session) => {
            if (!session) return session;
            const logs = session.logs.map((log) => (log.id === logId ? updatedLog : log));
            const completedSets = logs.filter((log) => log.completed).length;
            return {
              ...session,
              logs,
              progress: {
                completedSets,
                totalSets: logs.length,
              },
            };
          });
        }),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not save set log.');
          return EMPTY;
        }),
      )
      .subscribe();
  }

  completeSession(): void {
    const session = this.activeSession();
    if (!session) return;
    this.api
      .completeSession(session.id)
      .pipe(
        take(1),
        tap((completed) => {
          this.activeSession.set(null);
          this.recentSessions.update((sessions) => [completed, ...sessions]);
        }),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not complete workout.');
          return EMPTY;
        }),
      )
      .subscribe();
  }
}
