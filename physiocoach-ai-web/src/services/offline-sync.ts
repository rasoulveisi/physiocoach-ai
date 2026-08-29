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

const OFFLINE_QUEUE_KEY = 'physiocoach_offline_sync_queue';
const SYNC_EVENT_NAME = 'physiocoach:sync-queue-updated';

class OfflineSyncService {
  private isSyncing = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.syncPendingQueue();
      });
    }
  }

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
      } catch (err) {
        // If network error occurred, stop processing queue and keep remaining items
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

        // If it's a 4xx client logic error with too many retries, discard or mark error
        if (!isNetworkError && item.retryCount >= 3) {
          failed++;
        } else {
          remainingQueue.push(updatedItem);
          if (isNetworkError) {
            // Re-append the rest and pause
            const currIdx = queue.indexOf(item);
            remainingQueue.push(...queue.slice(currIdx + 1));
            break;
          }
        }
      }
    }

    this.saveQueue(remainingQueue);
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
  syncNow: () => Promise<{ synced: number; failed: number }>;
}

export function useNetworkSyncStatus(): NetworkSyncStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => offlineSyncService.isOnline());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() =>
    offlineSyncService.getPendingCount(),
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(() => offlineSyncService.getIsSyncing());

  const updateState = useCallback(() => {
    setIsOnline(offlineSyncService.isOnline());
    setPendingSyncCount(offlineSyncService.getPendingCount());
    setIsSyncing(offlineSyncService.getIsSyncing());
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
    syncNow,
  };
}
