import { describe, it, expect, beforeEach, vi } from 'vitest';
import { offlineSyncService, OFFLINE_QUEUE_KEY, CACHE_KEY_PREFIX, ACTIVE_SESSION_DRAFT_KEY } from './offline-sync';
import { apiClient } from './api-client';

// Polyfill localStorage for Node test runner
const memoryStorage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStorage.set(key, String(value)),
  removeItem: (key: string) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
  get length() {
    return memoryStorage.size;
  },
  key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

describe('OfflineSyncService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  describe('Cache Operations', () => {
    it('stores and retrieves cached data by endpoint', () => {
      const mockPlan = {
        id: 'plan-123',
        plan: {
          name: 'Hypertrophy 4-Day',
          days: [{ dayNumber: 1, name: 'Upper Body', exercises: [] }],
        },
      };

      offlineSyncService.setCachedData('workout-plans/current', mockPlan);
      const retrieved = offlineSyncService.getCachedData<typeof mockPlan>('workout-plans/current');

      expect(retrieved).toEqual(mockPlan);
      expect(offlineSyncService.getCachedCurrentPlan()).toEqual(mockPlan);
    });

    it('normalizes endpoint paths with slashes and query strings', () => {
      const data = { foo: 'bar' };
      offlineSyncService.setCachedData('/workout-plans/current?refresh=true/', data);
      expect(offlineSyncService.getCachedData('workout-plans/current')).toEqual(data);
    });

    it('clears specific and all cached data', () => {
      offlineSyncService.setCachedData('endpoint-a', { a: 1 });
      offlineSyncService.setCachedData('endpoint-b', { b: 2 });

      offlineSyncService.clearCachedData('endpoint-a');
      expect(offlineSyncService.getCachedData('endpoint-a')).toBeNull();
      expect(offlineSyncService.getCachedData('endpoint-b')).toEqual({ b: 2 });

      offlineSyncService.clearCachedData();
      expect(offlineSyncService.getCachedData('endpoint-b')).toBeNull();
    });
  });

  describe('Local Completed Session Recording', () => {
    it('records completed session into local cache with isOfflinePending flag', () => {
      const sessionPayload = {
        dayNumber: 2,
        dayName: 'Lower Hypertrophy',
        durationSeconds: 2400,
        notes: 'Great workout',
        exercises: [
          {
            name: 'Barbell Squat',
            sets: [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }],
          },
        ],
      };

      offlineSyncService.recordLocalCompletedSession(sessionPayload);
      const sessions = offlineSyncService.getCachedSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].dayNumber).toBe(2);
      expect(sessions[0].workoutName).toBe('Lower Hypertrophy');
      expect(sessions[0].isOfflinePending).toBe(true);
      expect(sessions[0].progress.completedSets).toBe(2);
      expect(sessions[0].progress.totalSets).toBe(2);
    });
  });

  describe('Active Session Draft Lifecycle', () => {
    it('saves, retrieves, and clears active session drafts', () => {
      expect(offlineSyncService.getActiveSessionDraft()).toBeNull();

      const draft = {
        planId: 'plan-1',
        dayNumber: 1,
        dayName: 'Day 1: Push',
        seconds: 450,
        sessionState: 'active' as const,
        logs: {
          0: [
            {
              setIndex: 1,
              setType: 'working' as const,
              weight: 80,
              reps: 10,
              completed: true,
            },
          ],
        },
        exercises: [{ name: 'Bench Press', sets: 3, reps: 10 }],
        sessionRpe: 8,
        sessionPainScore: 0,
        updatedAt: new Date().toISOString(),
      };

      offlineSyncService.saveActiveSessionDraft(draft);
      const savedDraft = offlineSyncService.getActiveSessionDraft();
      expect(savedDraft).toEqual(draft);

      offlineSyncService.clearActiveSessionDraft();
      expect(offlineSyncService.getActiveSessionDraft()).toBeNull();
    });
  });

  describe('Pending Queue Management', () => {
    it('enqueues, counts, and removes sync items', () => {
      expect(offlineSyncService.getPendingCount()).toBe(0);

      const item = offlineSyncService.enqueueSyncItem({
        type: 'workout-session-complete',
        endpoint: 'workout-logs',
        method: 'POST',
        payload: { dayNumber: 1, durationSeconds: 1800 },
      });

      expect(offlineSyncService.getPendingCount()).toBe(1);
      expect(offlineSyncService.getPendingQueue()[0].id).toBe(item.id);

      offlineSyncService.removeSyncItem(item.id);
      expect(offlineSyncService.getPendingCount()).toBe(0);
    });

    it('clears all items in queue', () => {
      offlineSyncService.enqueueSyncItem({
        type: 'workout-log',
        endpoint: 'workout-logs',
        payload: { a: 1 },
      });
      offlineSyncService.enqueueSyncItem({
        type: 'pain-alert',
        endpoint: 'workout-sessions/pain-alert',
        payload: { painScore: 5 },
      });

      expect(offlineSyncService.getPendingCount()).toBe(2);
      offlineSyncService.clearQueue();
      expect(offlineSyncService.getPendingCount()).toBe(0);
    });
  });

  describe('Sync Queue Processing', () => {
    it('syncs pending items successfully and updates local session status', async () => {
      vi.spyOn(offlineSyncService, 'isOnline').mockReturnValue(true);
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true } as any);

      offlineSyncService.recordLocalCompletedSession({ dayNumber: 1, durationSeconds: 1200 });
      expect(offlineSyncService.getCachedSessions()[0].isOfflinePending).toBe(true);

      offlineSyncService.enqueueSyncItem({
        type: 'workout-session-complete',
        endpoint: 'workout-logs',
        method: 'POST',
        payload: { dayNumber: 1 },
      });

      const res = await offlineSyncService.syncPendingQueue();
      expect(res.synced).toBe(1);
      expect(res.failed).toBe(0);
      expect(offlineSyncService.getPendingCount()).toBe(0);
      expect(postSpy).toHaveBeenCalledWith('workout-logs', { dayNumber: 1 });
      expect(offlineSyncService.getCachedSessions()[0].isOfflinePending).toBe(false);
      expect(offlineSyncService.getLastSyncTime()).toBeTruthy();
    });

    it('pauses and preserves items on network failure', async () => {
      vi.spyOn(offlineSyncService, 'isOnline').mockReturnValue(true);
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Failed to fetch'));

      offlineSyncService.enqueueSyncItem({
        type: 'workout-session-complete',
        endpoint: 'workout-logs',
        method: 'POST',
        payload: { dayNumber: 1 },
      });

      const res = await offlineSyncService.syncPendingQueue();
      expect(res.synced).toBe(0);
      expect(res.failed).toBe(0);
      expect(offlineSyncService.getPendingCount()).toBe(1);
      expect(offlineSyncService.getPendingQueue()[0].retryCount).toBe(1);
    });
  });

  describe('apiClient Offline Fallback', () => {
    it('returns cached plan data when network fetch throws a network error', async () => {
      const mockPlan = {
        id: 'cached-plan-1',
        plan: { name: 'Offline Push Pull', days: [{ dayNumber: 1, name: 'Push', exercises: [] }] },
      };

      offlineSyncService.setCachedData('workout-plans/current', mockPlan);

      // Mock fetch to simulate network failure
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      const plan = await apiClient.get<typeof mockPlan>('workout-plans/current');
      expect(plan).toEqual(mockPlan);
    });
  });
});
