/**
 * PhysioCoach AI — Offline banner.
 *
 * Renders an amber ribbon when the device is offline or has queued offline
 * actions, with a manual "Sync Now" button. Gym-dark-zone first aid: the
 * athlete always knows their workout is saved locally and will sync.
 */

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WifiOff, Zap } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { useSync } from '../../context/SyncContext';

export interface OfflineBannerProps {
  /**
   * Optional external visibility control (e.g. only inside LiveSession).
   * Defaults to showing whenever offline OR pending items exist.
   */
  forceVisible?: boolean;
  /** Called after a manual "Sync Now" drain finishes. */
  onSynced?: (result: { syncedCount: number; errors: number }) => void;
}

/** Shown when the device is offline or has pending queued items. */
export function OfflineBanner({ forceVisible = false, onSynced }: OfflineBannerProps) {
  const { isConnected, pendingCount, isSyncing, processQueue } = useSync();
  const [justSynced, setJustSynced] = useState(false);

  const offline = isConnected === false;
  const visible = forceVisible || offline || pendingCount > 0;
  if (!visible) return null;

  const handleSyncNow = async () => {
    const result = await processQueue();
    if (result.errors === 0 && result.remaining === 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 4000);
    }
    onSynced?.(result);
  };

  const countLabel = `${pendingCount} item${pendingCount === 1 ? '' : 's'} pending sync`;
  const message = offline
    ? `⚡ Offline Gym Mode (${countLabel})`
    : `⚡ ${pendingCount} item${pendingCount === 1 ? '' : 's'} pending sync`;
  const bannerColor = offline ? colors.accentAmber : colors.accentVolt;

  return (
    <View
      style={[styles.root, { borderColor: `${bannerColor}55` }]}
      accessibilityRole="alert"
      accessibilityLabel={`${message}. ${offline ? 'You can keep training — everything is saved locally.' : 'Ready to sync.'}`}
    >
      {offline ? (
        <WifiOff size={15} color={bannerColor} strokeWidth={2.2} />
      ) : (
        <Zap size={15} color={bannerColor} width={15} height={15} strokeWidth={2.2} />
      )}
      <View style={styles.textWrap}>
        <Text style={[styles.message, { color: bannerColor }]} numberOfLines={1}>
          {justSynced ? '✓ All synced' : message}
        </Text>
        {!offline && !justSynced ? null : (
          <Text style={styles.hint} numberOfLines={1}>
            {offline ? 'Saved on device · will auto-sync' : 'Connected · tap Sync Now'}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sync now"
        disabled={isSyncing || pendingCount === 0}
        onPress={() => void handleSyncNow()}
        style={[styles.syncBtn, (isSyncing || pendingCount === 0) && styles.syncBtnDisabled]}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color={bannerColor} />
        ) : (
          <Text style={[styles.syncBtnText, { color: bannerColor }]}>Sync Now</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(18, 23, 34, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textWrap: {
    flex: 1,
    gap: 1,
  },
  message: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  syncBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnDisabled: {
    opacity: 0.5,
  },
  syncBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
});

export default OfflineBanner;
