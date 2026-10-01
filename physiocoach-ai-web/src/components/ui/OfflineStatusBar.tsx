import { useState } from 'react';
import { RefreshCw, WifiOff, CheckCircle2 } from 'lucide-react';
import { useNetworkSyncStatus } from '../../services/offline-sync';

export function OfflineStatusBar() {
  const { isOnline, pendingSyncCount, isSyncing, syncNow } = useNetworkSyncStatus();
  const [justSynced, setJustSynced] = useState(false);

  const handleSyncClick = async () => {
    const res = await syncNow();
    if (res.synced > 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3500);
    }
  };

  // If online and nothing is queued or syncing and not just synced, don't show the bar
  if (isOnline && pendingSyncCount === 0 && !isSyncing && !justSynced) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full shrink-0 border-b px-3 sm:px-6 py-1.5 text-xs transition-colors z-20 flex items-center justify-between gap-3 ${
        !isOnline
          ? 'bg-amber-950/70 border-amber-500/30 text-amber-200'
          : justSynced
            ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-200'
            : 'bg-zinc-900 border-zinc-800 text-zinc-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!isOnline ? (
          <>
            <WifiOff className="size-3.5 text-amber-400 shrink-0" />
            <span className="font-extrabold text-[11px] sm:text-xs">
              Offline Mode
            </span>
            <span className="hidden sm:inline text-amber-300/80 text-[11px]">
              — Current plan is available offline and new workouts will sync automatically when reconnected.
            </span>
          </>
        ) : justSynced ? (
          <>
            <CheckCircle2 className="size-3.5 text-[#10E760] shrink-0" />
            <span className="font-bold text-[11px] sm:text-xs text-white">
              All offline workouts synced with cloud!
            </span>
          </>
        ) : (
          <>
            <RefreshCw className={`size-3.5 text-lime-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="font-bold text-[11px] sm:text-xs text-white">
              Online — {pendingSyncCount} pending item{pendingSyncCount > 1 ? 's' : ''} queued for sync
            </span>
          </>
        )}
      </div>

      {isOnline && pendingSyncCount > 0 && (
        <button
          type="button"
          onClick={handleSyncClick}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded-lg border border-lime-400/40 bg-lime-400/10 hover:bg-lime-400/20 px-2.5 py-0.5 text-[11px] font-mono font-black text-lime-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing…' : 'Sync Now'}</span>
        </button>
      )}
    </div>
  );
}
