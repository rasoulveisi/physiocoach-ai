import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Clock, Flame, Pause, Play, RefreshCw, Sparkles } from 'lucide-react-native';
import { Badge, Button, Card } from '../ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { generatePrehab, isNetworkError } from '../../api/explore';
import type { PrehabItem, PrehabExerciseInput } from '../../api/explore';

// ---------------------------------------------------------------------------
// Joint regions + offline clinical mobility matrix
// ---------------------------------------------------------------------------

const JOINT_REGIONS = ['Shoulders', 'Lower Back', 'Hips', 'Knees', 'Ankles'] as const;
type JointRegion = (typeof JOINT_REGIONS)[number];

interface LocalMatrixItem {
  id: string;
  name: string;
  targetJoint: string;
  repsOrDuration: string;
  durationSeconds?: number;
  instructions: string;
}

/** Instant clinical mobility matrix used offline (mirrors the server catalog). */
const CLINICAL_MATRIX: Record<JointRegion, LocalMatrixItem[]> = {
  Shoulders: [
    {
      id: 'local-band-pull-aparts',
      name: 'Band Pull-Aparts',
      targetJoint: 'Shoulders & Scapulae',
      repsOrDuration: '15 reps',
      instructions:
        'Primes rear delts and lower traps — ' +
        'Hold a band at shoulder height, pull straight apart to the chest, squeeze shoulder blades 1s.',
    },
    {
      id: 'local-scapular-wall-slides',
      name: 'Scapular Wall Slides',
      targetJoint: 'Scapulothoracic & Shoulders',
      repsOrDuration: '10 reps',
      instructions:
        'Restores upward scapular rotation — ' +
        'Back flat against a wall, slide arms overhead keeping ribs down and contact throughout.',
    },
    {
      id: 'local-cuff-er',
      name: 'Cable/Band External Rotations',
      targetJoint: 'Rotator Cuff',
      repsOrDuration: '12 / side',
      instructions:
        'Activates infraspinatus before pressing — ' +
        'Elbow pinned at 90°, rotate out slowly against light tension, no shrugging.',
    },
  ],
  'Lower Back': [
    {
      id: 'local-deadbug',
      name: 'Deadbug Breathing',
      targetJoint: 'Lumbar Spine & Core',
      repsOrDuration: '8 / side',
      instructions:
        'Braces the anterior core before hinging — ' +
        'Press lumbar into the floor, extend the opposite arm/leg slowly, exhale at full reach.',
    },
    {
      id: 'local-cat-camel',
      name: 'Cat-Camel Flow',
      targetJoint: 'Thoracic & Lumbar Spine',
      repsOrDuration: '10 cycles',
      instructions:
        'Segmental spinal mobility — ' +
        'Move slowly between flexion and extension, pausing at each end range without forcing.',
    },
    {
      id: 'local-bird-dog',
      name: 'Bird-Dog Holds',
      targetJoint: 'Spine & Core',
      repsOrDuration: '6 / side · 5s hold',
      instructions:
        'Anti-rotation stability — ' +
        'From quadruped, reach opposite arm/leg level with the torso, hips square to the floor.',
    },
  ],
  Hips: [
    {
      id: 'local-90-90-flow',
      name: '90/90 Hip Flow',
      targetJoint: 'Hips',
      repsOrDuration: '60s flow',
      durationSeconds: 60,
      instructions:
        'Restores internal/external rotation for squat depth — ' +
        'Sit tall, smoothly pivot knees side-to-side keeping heels pinned, spine neutral.',
    },
    {
      id: 'local-cossack',
      name: 'Cossack Squat Shifts',
      targetJoint: 'Hips & Adductors',
      repsOrDuration: '8 / side',
      instructions:
        'Loads the adductors progressively — ' +
        'Shift side-to-side at depth, keep the working heel down and chest tall.',
    },
    {
      id: 'local-glute-bridge',
      name: 'Glute Bridge Activations',
      targetJoint: 'Glutes & Hips',
      repsOrDuration: '15 reps',
      instructions:
        'Wakes up glute max before hinging — ' +
        'Drive through heels, squeeze at the top 2s, ribs locked down, no lumbar arch.',
    },
  ],
  Knees: [
    {
      id: 'local-terminal-extension',
      name: 'Terminal Knee Extensions',
      targetJoint: 'Knees',
      repsOrDuration: '12 / leg',
      instructions:
        'Primes vastus medialis for patellar tracking — ' +
        'Band behind the knee, straighten fully against tension, hold lockout 2s.',
    },
    {
      id: 'local-slow-squats',
      name: 'Slow Bodyweight Box Squats',
      targetJoint: 'Knees & Hips',
      repsOrDuration: '10 reps',
      instructions:
        'Gradual tendon loading — ' +
        '3s descent to a box, vertical shins, drive up through mid-foot without knee valgus.',
    },
    {
      id: 'local-calf-raises',
      name: 'Calf Raise Energizers',
      targetJoint: 'Ankles & Knees',
      repsOrDuration: '15 reps',
      instructions:
        'Ankle stiffness for squat/lunge mechanics — ' +
        'Full stretch at bottom, pause 1s at the top, controlled tempo throughout.',
    },
  ],
  Ankles: [
    {
      id: 'local-ankle-rock',
      name: 'Kneeling Ankle Rocks',
      targetJoint: 'Ankles',
      repsOrDuration: '12 / side',
      instructions:
        'Improves dorsiflexion for depth — ' +
        'Knee tracks over toes against a wall, heel glued to the floor, slow oscillation.',
    },
    {
      id: 'local-tib-raises',
      name: 'Tibialis Raises',
      targetJoint: 'Ankles & Shins',
      repsOrDuration: '15 reps',
      instructions:
        'Balances anterior lower leg — ' +
        'Heels elevated, pull toes toward the shin slowly, full control both directions.',
    },
    {
      id: 'local-ankle-circles',
      name: 'Weight-Bearing Ankle Circles',
      targetJoint: 'Ankles',
      repsOrDuration: '8 / direction',
      instructions:
        'Synovial warm-up — ' +
        'Slow, deliberate circles on each foot, keeping pressure even across the sole.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PrehabSectionProps {
  /**
   * Active workout exercises — when provided, joint regions are auto-detected
   * from movement patterns/muscle groups (LiveSessionScreen integration).
   */
  exercises?: PrehabExerciseInput[];
  /** Compact rendering for embedding inside the live session. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PrehabSection({ exercises, compact = false }: PrehabSectionProps) {
  const [selectedRegions, setSelectedRegions] = useState<JointRegion[]>([]);
  const [autoDetected, setAutoDetected] = useState(false);
  const [routine, setRoutine] = useState<PrehabItem[] | null>(null);
  const [routineName, setRoutineName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [source, setSource] = useState<'api' | 'offline' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive checklist state
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [timerItem, setTimerItem] = useState<{ id: string; remaining: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-detect joints from active workout exercises on mount.
  useEffect(() => {
    if (!exercises || exercises.length === 0) return;
    const regions = detectJointRegions(exercises);
    if (regions.length > 0) {
      setSelectedRegions(regions);
      setAutoDetected(true);
    }
  }, [exercises]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerItem(null);
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const startTimer = useCallback(
    (item: PrehabItem, seconds: number) => {
      stopTimer();
      setTimerItem({ id: item.id, remaining: seconds });
      timerRef.current = setInterval(() => {
        setTimerItem((prev) => {
          if (!prev || prev.remaining <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setDoneIds((done) => new Set(done).add(prev?.id ?? ''));
            return null;
          }
          return { id: prev.id, remaining: prev.remaining - 1 };
        });
      }, 1000);
    },
    [stopTimer],
  );

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDoneIds(new Set());
    stopTimer();

    const inputs: PrehabExerciseInput[] = exercises ?? [];
    const limits: string[] = selectedRegions;

    try {
      const result = await generatePrehab(inputs, limits);
      setRoutine(result.exercises);
      setRoutineName(result.routineName);
      setDurationMinutes(result.durationMinutes);
      setSource('api');
    } catch (err) {
      if (isNetworkError(err) || (err instanceof Error && err.message.includes('timed out'))) {
        // Offline fallback: instant clinical mobility matrix.
        const regions = selectedRegions.length > 0 ? selectedRegions : (['Shoulders', 'Hips'] as JointRegion[]);
        const items = regions.flatMap((region) => CLINICAL_MATRIX[region]);
        setRoutine(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            targetJoint: item.targetJoint,
            repsOrDuration: item.repsOrDuration,
            instructions: item.instructions,
          })),
        );
        setRoutineName('Clinical Warm-up (Offline)');
        setDurationMinutes(Math.max(5, Math.round(items.length * 2)));
        setSource('offline');
      } else {
        setError('Could not generate your routine. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [exercises, selectedRegions, stopTimer]);

  const toggleRegion = useCallback((region: JointRegion) => {
    setAutoDetected(false);
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region],
    );
  }, []);

  const toggleDone = useCallback((id: string) => {
    void Haptics.selectionAsync();
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const progress = useMemo(() => {
    if (!routine || routine.length === 0) return 0;
    return Math.round((doneIds.size / routine.length) * 100);
  }, [doneIds, routine]);

  const secondsForItem = useCallback((item: PrehabItem): number | null => {
    if (item.id.startsWith('local-')) {
      const local = Object.values(CLINICAL_MATRIX)
        .flat()
        .find((m) => m.id === item.id);
      return local?.durationSeconds ?? null;
    }
    const match = item.repsOrDuration.match(/^(\d+)s$/);
    return match ? Number(match[1]) : null;
  }, []);

  return (
    <Card style={[compact && styles.cardCompact]}>
      {/* Section header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <Flame size={16} color={colors.accentAmber} strokeWidth={2.2} />
          <Text style={styles.headerTitle}>SMART WARM-UP & PREHAB</Text>
        </View>
        {source === 'offline' ? <Badge label="Offline" variant="amber" /> : null}
      </View>
      <Text style={styles.headerBody}>
        {exercises && exercises.length > 0
          ? 'Joints auto-detected from your session — adjust or generate your priming routine.'
          : 'Pick the joints you want to safeguard, then generate a clinical priming routine.'}
      </Text>

      {/* Joint region selector */}
      <View style={styles.regionWrap}>
        {JOINT_REGIONS.map((region) => {
          const active = selectedRegions.includes(region);
          return (
            <Pressable
              key={region}
              accessibilityRole="button"
              accessibilityLabel={`${active ? 'Deselect' : 'Select'} ${region}`}
              onPress={() => toggleRegion(region)}
              style={[styles.regionChip, active && styles.regionChipActive]}
            >
              {autoDetected && active ? <Sparkles size={12} color={colors.accentVolt} strokeWidth={2.2} /> : null}
              <Text style={[styles.regionText, active && styles.regionTextActive]}>{region}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Generate CTA */}
      {routine ? (
        <View style={styles.actionRow}>
          <View style={styles.flex}>
            <Button
              label="Regenerate"
              variant="secondary"
              size="sm"
              loading={loading}
              onPress={() => void handleGenerate()}
            />
          </View>
          <View style={styles.flex}>
            <Button label="Reset" variant="ghost" size="sm" onPress={() => {
              setRoutine(null);
              setSource(null);
              setDoneIds(new Set());
              stopTimer();
            }} />
          </View>
        </View>
      ) : (
        <Button
          label={loading ? 'Generating…' : 'Generate Warm-up Routine'}
          variant="volt"
          fullWidth
          loading={loading}
          disabled={selectedRegions.length === 0 && (!exercises || exercises.length === 0)}
          onPress={() => void handleGenerate()}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Generated routine checklist */}
      {routine && routine.length > 0 ? (
        <View style={styles.routineWrap}>
          {/* Routine meta + progress */}
          <View style={styles.routineMetaRow}>
            <Text style={styles.routineName} numberOfLines={1}>
              {routineName}
            </Text>
            <View style={styles.routineMetaChips}>
              <Badge label={`${durationMinutes} min`} variant="cyan" />
              <Badge label={`${progress}% ready`} variant={progress === 100 ? 'volt' : 'zinc'} />
            </View>
          </View>

          {routine.map((item, idx) => {
            const done = doneIds.has(item.id);
            const seconds = secondsForItem(item);
            const running = timerItem?.id === item.id;
            return (
              <View key={item.id} style={[styles.checklistRow, done && styles.checklistRowDone]}>
                {/* Step number / check */}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`Mark ${item.name} complete`}
                  onPress={() => toggleDone(item.id)}
                  style={[styles.stepCircle, done && styles.stepCircleDone]}
                >
                  {done ? (
                    <Check size={14} color={colors.bgPrimary} strokeWidth={3} />
                  ) : (
                    <Text style={styles.stepNumber}>{idx + 1}</Text>
                  )}
                </Pressable>

                {/* Copy */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle details for ${item.name}`}
                  onPress={() => toggleDone(item.id)}
                  style={styles.flex}
                >
                  <View style={styles.stepTitleRow}>
                    <Text style={[styles.stepName, done && styles.stepNameDone]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Badge label={item.targetJoint} variant="cyan" />
                  </View>
                  <Text style={styles.stepDose}>{item.repsOrDuration}</Text>
                  <Text style={styles.stepInstructions} numberOfLines={3}>
                    {item.instructions}
                  </Text>
                </Pressable>

                {/* Timer (duration-based steps only) */}
                {seconds != null ? (
                  running ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Pause timer"
                      onPress={stopTimer}
                      style={[styles.timerBtn, styles.timerBtnRunning]}
                    >
                      <Pause size={14} color={colors.accentVolt} strokeWidth={2.4} />
                      <Text style={styles.timerTextRunning}>{`${timerItem?.remaining ?? seconds}s`}</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Start ${seconds} second timer`}
                      onPress={() => startTimer(item, seconds)}
                      style={styles.timerBtn}
                    >
                      <Play size={14} color={colors.textSecondary} strokeWidth={2.4} />
                      <Text style={styles.timerText}>{`${seconds}s`}</Text>
                    </Pressable>
                  )
                ) : done ? null : (
                  <Clock size={16} color={colors.textMuted} strokeWidth={1.8} />
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {loading && !routine ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accentVolt} />
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Auto-detection heuristics
// ---------------------------------------------------------------------------

export function detectJointRegions(exercises: PrehabExerciseInput[]): JointRegion[] {
  const regions = new Set<JointRegion>();
  for (const exercise of exercises) {
    const haystack = [
      exercise.name ?? '',
      exercise.movementPattern ?? '',
      ...(exercise.muscleGroups ?? []),
    ]
      .join(' ')
      .toLowerCase();
    if (/shoulder|press|bench|delt|rotator|scap|chest|lat|row|pull-?up|pulldown/.test(haystack)) {
      regions.add('Shoulders');
    }
    if (/deadlift|hinge|good.?morning|back extension|hyper|lower.?back|lumbar|erector/.test(haystack)) {
      regions.add('Lower Back');
    }
    if (/squat|lunge|hip|glute|thrust|step.?up|leg press|cossack/.test(haystack)) {
      regions.add('Hips');
    }
    if (/squat|lunge|leg extension|leg press|step.?up|knee/.test(haystack)) {
      regions.add('Knees');
    }
    if (/calf|ankle|jump|plyo|sprint|tibialis/.test(haystack)) {
      regions.add('Ankles');
    }
  }
  return Array.from(regions);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  cardCompact: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  headerBody: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: fontSize.xs,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  regionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  regionChipActive: {
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
    borderColor: colors.accentVolt,
  },
  regionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  regionTextActive: {
    color: colors.accentVolt,
    fontWeight: fontWeight.semibold,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: { flex: 1 },
  errorText: {
    marginTop: 10,
    fontSize: fontSize.xs,
    color: colors.accentRed,
  },
  routineWrap: {
    marginTop: 14,
  },
  routineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  routineName: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  routineMetaChips: {
    flexDirection: 'row',
    gap: 6,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  checklistRowDone: {
    opacity: 0.6,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepCircleDone: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  stepNumber: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  stepNameDone: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  stepDose: {
    marginTop: 2,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.accentAmber,
  },
  stepInstructions: {
    marginTop: 3,
    fontSize: fontSize.xs,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  timerBtnRunning: {
    borderColor: colors.accentVolt,
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
  },
  timerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  timerTextRunning: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accentVolt,
  },
  loadingRow: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});

export { PrehabSection };
