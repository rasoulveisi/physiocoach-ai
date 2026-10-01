import { useState, useEffect, useCallback } from 'react';
import { apiClient } from './api-client';

export type SyncItemType =
  | 'workout-session-complete'
  | 'workout-log'
  | 'pain-alert'
  | 'exercise-log'
  | 'generic-post';

export interface SyncQueueItem {
  id: string;
  type: SyncItemType;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT';
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface ActiveSessionDraft {
  planId?: string;
  planTitle?: string;
  dayNumber: number;
  dayName?: string;
  seconds: number;
  sessionState: 'idle' | 'active' | 'paused';
  logs: Record<number, any[]>;
  exercises: any[];
  sessionRpe?: number;
  sessionPainScore?: number;
  painJointRegion?: string;
  painNotes?: string;
  updatedAt: string;
}

export const OFFLINE_QUEUE_KEY = 'physiocoach_offline_sync_queue';
export const CACHE_KEY_PREFIX = 'physiocoach_cache_';
export const ACTIVE_SESSION_DRAFT_KEY = 'physiocoach_active_session_draft';
export const LAST_SYNC_TIME_KEY = 'physiocoach_last_sync_time';
export const SYNC_EVENT_NAME = 'physiocoach:sync-queue-updated';

function normalizeEndpointKey(endpoint: string): string {
  return endpoint.replace(/^\/+/, '').split('?')[0].replace(/\/+$/, '');
}

class OfflineSyncService {
  private isSyncing = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.syncPendingQueue();
      });

      // Attempt background sync when user re-focuses or tabs back into app
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isOnline() && this.getPendingCount() > 0) {
          void this.syncPendingQueue();
        }
      });
      window.addEventListener('focus', () => {
        if (this.isOnline() && this.getPendingCount() > 0) {
          void this.syncPendingQueue();
        }
      });
    }
  }

  // --- Offline Data Caching (Read Path) ---

  public getCachedData<T>(endpoint: string): T | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const key = `${CACHE_KEY_PREFIX}${normalizeEndpointKey(endpoint)}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  public setCachedData<T>(endpoint: string, data: T): void {
    if (typeof localStorage === 'undefined' || data === undefined || data === null) return;
    try {
      const key = `${CACHE_KEY_PREFIX}${normalizeEndpointKey(endpoint)}`;
      localStorage.setItem(key, JSON.stringify(data));
      this.notifyListeners();
    } catch {
      // Storage quota or disabled storage handled safely
    }
  }

  public clearCachedData(endpoint?: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      if (endpoint) {
        const key = `${CACHE_KEY_PREFIX}${normalizeEndpointKey(endpoint)}`;
        localStorage.removeItem(key);
      } else {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(CACHE_KEY_PREFIX)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
      this.notifyListeners();
    } catch {}
  }

  public getCachedCurrentPlan(): any | null {
    return (
      this.getCachedData<any>('workout-plans/current') ||
      this.getCachedData<any>('workout-plans/active')
    );
  }

  public setCachedCurrentPlan(plan: any): void {
    this.setCachedData('workout-plans/current', plan);
    this.setCachedData('workout-plans/active', plan);
  }

  public getCachedSessions(): any[] {
    const data = this.getCachedData<any>('workout-sessions');
    const list = data?.data || data;
    return Array.isArray(list) ? list : [];
  }

  public recordLocalCompletedSession(sessionPayload: any): void {
    try {
      const currentList = this.getCachedSessions();
      const localId = `offline-session-${Date.now()}`;
      const now = new Date().toISOString();

      const newLocalSession = {
        id: localId,
        workoutName:
          sessionPayload.dayName ||
          (sessionPayload.dayNumber ? `Day ${sessionPayload.dayNumber} Workout` : 'Completed Workout'),
        completedAt: now,
        startedAt: new Date(Date.now() - (sessionPayload.durationSeconds || 0) * 1000).toISOString(),
        durationSeconds: sessionPayload.durationSeconds || 0,
        dayNumber: sessionPayload.dayNumber || 1,
        notes: sessionPayload.notes || null,
        isOfflinePending: true,
        progress: {
          completedSets: (sessionPayload.exercises || []).reduce(
            (sum: number, ex: any) => sum + (ex.sets?.length || 0),
            0,
          ),
          totalSets: (sessionPayload.exercises || []).reduce(
            (sum: number, ex: any) => sum + (ex.sets?.length || 0),
            0,
          ),
        },
      };

      const updated = [newLocalSession, ...currentList.filter((s: any) => s.id !== localId)];
      this.setCachedData('workout-sessions', updated);
    } catch (e) {
      console.warn('Could not record local completed session to offline cache:', e);
    }
  }

  // --- In-Progress Session Draft Persistence ---

  public getActiveSessionDraft(): ActiveSessionDraft | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as ActiveSessionDraft;
    } catch {
      return null;
    }
  }

  public saveActiveSessionDraft(draft: ActiveSessionDraft): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(ACTIVE_SESSION_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Best-effort storage
    }
  }

  public clearActiveSessionDraft(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(ACTIVE_SESSION_DRAFT_KEY);
      this.notifyListeners();
    } catch {}
  }

  // --- Pending Sync Queue (Write Path) ---

  public getPendingQueue(): SyncQueueItem[] {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public getPendingCount(): number {
    return this.getPendingQueue().length;
  }

  public isOnline(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  }

  public getLastSyncTime(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(LAST_SYNC_TIME_KEY);
  }

  public enqueueSyncItem(item: {
    type: SyncItemType;
    endpoint: string;
    method?: 'POST' | 'PATCH' | 'PUT';
    payload: unknown;
  }): SyncQueueItem {
    const queue = this.getPendingQueue();
    const newItem: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: item.type,
      endpoint: item.endpoint,
      method: item.method || 'POST',
      payload: item.payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    queue.push(newItem);
    this.saveQueue(queue);
    this.notifyListeners();
    return newItem;
  }

  public removeSyncItem(id: string): void {
    const queue = this.getPendingQueue().filter((item) => item.id !== id);
    this.saveQueue(queue);
    this.notifyListeners();
  }

  public clearQueue(): void {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    this.notifyListeners();
  }

  public async syncPendingQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0 };
    if (!this.isOnline()) return { synced: 0, failed: 0 };

    const queue = this.getPendingQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    this.isSyncing = true;
    this.notifyListeners();

    let synced = 0;
    let failed = 0;
    const remainingQueue: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        if (item.method === 'POST') {
          await apiClient.post(item.endpoint, item.payload);
        } else if (item.method === 'PATCH') {
          await apiClient.patch(item.endpoint, item.payload);
        } else {
          await apiClient.post(item.endpoint, item.payload);
        }
        synced++;

        // If completed session synced successfully, update local pending session status
        if (item.type === 'workout-session-complete') {
          try {
            const sessions = this.getCachedSessions();
            let changed = false;
            const updated = sessions.map((s: any) => {
              if (s.isOfflinePending) {
                changed = true;
                return { ...s, isOfflinePending: false };
              }
              return s;
            });
            if (changed) {
              this.setCachedData('workout-sessions', updated);
            }
          } catch {}
        }
      } catch (err) {
        const isNetworkError =
          !this.isOnline() ||
          (err instanceof Error &&
            (err.message.includes('Failed to fetch') ||
              err.message.includes('NetworkError') ||
              err.message.includes('offline')));

        const updatedItem: SyncQueueItem = {
          ...item,
          retryCount: item.retryCount + 1,
          lastError: err instanceof Error ? err.message : 'Sync failed',
        };

        if (!isNetworkError && item.retryCount >= 3) {
          failed++;
        } else {
          remainingQueue.push(updatedItem);
          if (isNetworkError) {
            const currIdx = queue.indexOf(item);
            remainingQueue.push(...queue.slice(currIdx + 1));
            break;
          }
        }
      }
    }

    this.saveQueue(remainingQueue);
    if (synced > 0) {
      try {
        localStorage.setItem(LAST_SYNC_TIME_KEY, new Date().toISOString());
      } catch {}
    }
    this.isSyncing = false;
    this.notifyListeners();

    return { synced, failed };
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  private saveQueue(queue: SyncQueueItem[]): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Best-effort storage
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch {
        // Safe listener trigger
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME));
    }
  }
}

export const offlineSyncService = new OfflineSyncService();

export interface NetworkSyncStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  activeDraft: ActiveSessionDraft | null;
  syncNow: () => Promise<{ synced: number; failed: number }>;
}

export function useNetworkSyncStatus(): NetworkSyncStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => offlineSyncService.isOnline());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    offlineSyncService.getPendingCount(),
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(() => offlineSyncService.getIsSyncing());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() =>
    offlineSyncService.getLastSyncTime(),
  );
  const [activeDraft, setActiveDraft] = useState<ActiveSessionDraft | null>(() =>
    offlineSyncService.getActiveSessionDraft(),
  );

  const updateState = useCallback(() => {
    setIsOnline(offlineSyncService.isOnline());
    setPendingSyncCount(offlineSyncService.getPendingCount());
    setIsSyncing(offlineSyncService.getIsSyncing());
    setLastSyncTime(offlineSyncService.getLastSyncTime());
    setActiveDraft(offlineSyncService.getActiveSessionDraft());
  }, []);

  useEffect(() => {
    updateState();

    const handleOnline = () => {
      setIsOnline(true);
      void offlineSyncService.syncPendingQueue().then(updateState);
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribe = offlineSyncService.subscribe(updateState);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [updateState]);

  const syncNow = useCallback(async () => {
    const res = await offlineSyncService.syncPendingQueue();
    updateState();
    return res;
  }, [updateState]);

  return {
    isOnline,
    pendingSyncCount,
    isSyncing,
    lastSyncTime,
    activeDraft,
    syncNow,
  };
}
