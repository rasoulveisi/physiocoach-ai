import { TestBed } from '@angular/core/testing';
import { WorkoutSessionStore } from './workout-session.store';
import { WorkoutSessionApiService } from './workout-session-api.service';
import { Observable, of } from 'rxjs';
import type {
  CreateSessionPayload,
  SaveSetLogPayload,
  SwapExercisePayload,
  WorkoutSessionDto,
} from './workout-session.model';

class FakeWorkoutSessionApiService {
  loadActiveSession(): Observable<WorkoutSessionDto | null> {
    return of(null);
  }

  loadRecentSessions(): Observable<WorkoutSessionDto[]> {
    return of([]);
  }

  createSession(payload: CreateSessionPayload) {
    void payload;
    return of({
      id: 'session_1',
      workoutPlanId: 'plan_1',
      dayIndex: 0,
      status: 'active',
      scheduledDate: '2026-06-01',
      startedAt: '2026-06-01T10:00:00.000Z',
      completedAt: null,
      notes: null,
      progress: { completedSets: 0, totalSets: 1 },
      logs: [],
    });
  }

  saveSetLog(logId: string, payload: SaveSetLogPayload) {
    void logId;
    void payload;
    return of({
      id: 'log_1',
      exerciseName: 'Goblet squat',
      movementPattern: 'squat',
      muscleGroups: ['legs'],
      setIndex: 1,
      targetReps: '8-10',
      reps: 10,
      weightKg: 30,
      rpe: 7,
      completed: true,
    });
  }

  swapExercise(sessionId: string, payload: SwapExercisePayload) {
    void sessionId;
    void payload;
    return of({
      id: 'session_1',
      workoutPlanId: 'plan_1',
      dayIndex: 0,
      status: 'active',
      scheduledDate: '2026-06-01',
      startedAt: '2026-06-01T10:00:00.000Z',
      completedAt: null,
      notes: null,
      progress: { completedSets: 0, totalSets: 1 },
      logs: [],
    });
  }

  completeSession(sessionId: string) {
    void sessionId;
    return of({
      id: 'session_1',
      workoutPlanId: 'plan_1',
      dayIndex: 0,
      status: 'completed',
      scheduledDate: '2026-06-01',
      startedAt: '2026-06-01T10:00:00.000Z',
      completedAt: '2026-06-01T11:00:00.000Z',
      notes: null,
      progress: { completedSets: 1, totalSets: 1 },
      logs: [],
    });
  }
}

describe('WorkoutSessionStore', () => {
  it('starts a session and updates local state', () => {
    TestBed.configureTestingModule({
      providers: [
        WorkoutSessionStore,
        { provide: WorkoutSessionApiService, useClass: FakeWorkoutSessionApiService },
      ],
    });

    const store = TestBed.inject(WorkoutSessionStore);
    expect(store.activeSession()).toBeNull();

    store.createSession({ workoutPlanId: 'plan_1', dayIndex: 0, scheduledDate: '2026-06-01' });
    expect(store.activeSession()?.id).toBe('session_1');
    expect(store.completedSets()).toBe(0);
  });
});
