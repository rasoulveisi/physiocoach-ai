/**
 * PhysioCoach AI — Sync context.
 *
 * Wraps the offline sync service in a React context: tracks connectivity via
 * NetInfo, auto-drains the queue on reconnect and on app focus, and refreshes
 * the pending count so the OfflineBanner / Settings screen stay live.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { addEventListener, useNetInfo } from '@react-native-community/netinfo';
import {
  clearQueue,
  enqueueAction,
  getQueue,
  getQueueCount,
  processQueue,
  type ProcessResult,
  type QueueActionType,
  type QueueItem,
} from '../services/offlineSync';

export interface SyncContextValue {
  /** NetInfo reachability; null until the first NetInfo update lands. */
  isConnected: boolean | null;
  /** Raw NetInfo state (type, details) for diagnostics. */
  netInfo: ReturnType<typeof useNetInfo>;
  /** Number of actions waiting in the offline queue. */
  pendingCount: number;
  /** True while a sync drain is running. */
  isSyncing: boolean;
  /** Result summary of the last drain (for toasts / banners). */
  lastSyncResult: ProcessResult | null;
  /** Persist an action for later replay (thin wrapper over the service). */
  enqueueAction: (type: QueueActionType, payload: unknown, endpoint?: string) => Promise<void>;
  /** Manually drain the queue ("Sync Now"). */
  processQueue: () => Promise<ProcessResult>;
  /** Refresh the pending count from storage. */
  refreshPendingCount: () => Promise<void>;
  /** Diagnostic read of the full queue. */
  getQueue: () => Promise<QueueItem[]>;
  /** Danger-zone wipe of the queue ("Clear Local Cache"). */
  clearQueue: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const netInfo = useNetInfo();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<ProcessResult | null>(null);
  const isSyncingRef = useRef(false);

  const refreshPendingCount = useCallback(async (): Promise<void> => {
    try {
      setPendingCount(await getQueueCount());
    } catch {
      // Storage hiccup — keep the previous count.
    }
  }, []);

  const runSync = useCallback(async (): Promise<ProcessResult> => {
    if (isSyncingRef.current) {
      return { syncedCount: 0, errors: 0, remaining: -1 };
    }
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await processQueue();
      setLastSyncResult(result);
      return result;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [refreshPendingCount]);

  const wrappedEnqueue = useCallback(
    async (type: QueueActionType, payload: unknown, endpoint?: string): Promise<void> => {
      await enqueueAction(type, payload, endpoint);
      await refreshPendingCount();
    },
    [refreshPendingCount],
  );

  /** Auto-drain when online with pending items (shared by reconnect + focus). */
  const autoSyncIfOnline = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) return;
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;
      const count = await getQueueCount();
      if (count > 0) await runSync();
    } catch {
      // NetInfo unavailable (e.g. web) — skip auto-sync.
    }
  }, [runSync]);

  // Drain on connectivity regain (NetInfo event, not just render state).
  useEffect(() => {
    const unsubscribe = addEventListener((state) => {
      if (state.isConnected && !isSyncingRef.current) {
        void getQueueCount().then((count) => {
          if (count > 0) void runSync();
        });
      }
      void refreshPendingCount();
    });
    return () => {
      unsubscribe();
    };
  }, [runSync, refreshPendingCount]);

  // Drain when the app returns to the foreground (focus sync).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') {
        void autoSyncIfOnline();
        void refreshPendingCount();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [autoSyncIfOnline, refreshPendingCount]);

  // Initial pending count on mount.
  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  const wrappedClearQueue = useCallback(async (): Promise<void> => {
    await clearQueue();
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const value = useMemo<SyncContextValue>(
    () => ({
      isConnected: netInfo.isConnected,
      netInfo,
      pendingCount,
      isSyncing,
      lastSyncResult,
      enqueueAction: wrappedEnqueue,
      processQueue: runSync,
      refreshPendingCount,
      getQueue,
      clearQueue: wrappedClearQueue,
    }),
    [netInfo, pendingCount, isSyncing, lastSyncResult, wrappedEnqueue, runSync, refreshPendingCount, wrappedClearQueue],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/** Access connectivity + offline queue state. Must be used under SyncProvider. */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
