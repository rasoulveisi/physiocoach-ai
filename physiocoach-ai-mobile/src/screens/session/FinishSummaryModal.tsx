import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloudOff, Flame, Trophy } from 'lucide-react-native';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import type { SessionFinishSummary } from './sessionTypes';

export interface FinishSummaryModalProps {
  visible: boolean;
  summary: SessionFinishSummary | null;
  dayName: string;
  /** True while completeSession is in flight (indeterminate overlay state). */
  finishing: boolean;
  /**
   * True when the session could not reach the API and was queued for offline
   * sync — shows the "safely saved locally" reassurance line.
   */
  offlineSaved?: boolean;
  onClose: () => void;
}

/** Static celebration copy shown under the stats grid. */
const CELEBRATION_LINES = [
  'Every set logged is a signal to your AI coach.',
  'Progressive overload unlocked. See you next session.',
  'Consistency compounds. Streak extended.',
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/** Celebration modal after a completed session. */
export function FinishSummaryModal({
  visible,
  summary,
  dayName,
  finishing,
  offlineSaved = false,
  onClose,
}: FinishSummaryModalProps) {
  const line = CELEBRATION_LINES[0];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {finishing || !summary ? (
            <>
              <Trophy size={40} color={colors.accentVolt} strokeWidth={1.8} />
              <Text style={styles.finishingTitle}>Finishing up…</Text>
              <Text style={styles.finishingText}>Syncing your session to the AI coach.</Text>
            </>
          ) : (
            <>
              <View style={styles.trophyRing}>
                <Trophy size={44} color={colors.accentVolt} strokeWidth={1.8} />
              </View>
              <Text style={styles.title}>Workout Complete!</Text>
              <Text style={styles.dayName}>{dayName}</Text>

              <View style={styles.statsGrid}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.accentVolt }]}>{summary.totalSets}</Text>
                  <Text style={styles.statLabel}>SETS</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.accentCyan }]}>{summary.totalReps}</Text>
                  <Text style={styles.statLabel}>REPS</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.accentAmber }]}>
                    {Math.round(summary.totalVolumeKg)}
                  </Text>
                  <Text style={styles.statLabel}>VOL (KG)</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {formatDuration(summary.durationSeconds)}
                  </Text>
                  <Text style={styles.statLabel}>DURATION</Text>
                </View>
              </View>

              <View style={styles.lineRow}>
                <Flame size={14} color={colors.accentAmber} strokeWidth={2.2} />
                <Text style={styles.lineText}>{line}</Text>
              </View>

              {offlineSaved ? (
                <View style={styles.offlineNote}>
                  <CloudOff size={16} color={colors.accentAmber} strokeWidth={2.2} />
                  <Text style={styles.offlineNoteText}>
                    Workout safely saved on your device. It syncs to your coach automatically
                    once you're back online.
                  </Text>
                </View>
              ) : null}

              <View style={styles.buttonWrap}>
                <Button label="Back to Dashboard" variant="volt" fullWidth onPress={onClose} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 24,
    alignItems: 'center',
  },
  trophyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 231, 96, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.heavy,
    color: colors.textPrimary,
  },
  dayName: {
    marginTop: 4,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentCyan,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
    gap: 12,
  },
  stat: {
    width: '47%',
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    marginTop: 4,
    fontSize: fontSize.xs,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  lineText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  finishingTitle: {
    marginTop: 12,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  finishingText: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    marginTop: 20,
  },
  offlineNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  offlineNoteText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});

export default FinishSummaryModal;
