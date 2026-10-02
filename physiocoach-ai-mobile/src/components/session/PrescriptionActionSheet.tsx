import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Clock,
  Flame,
  Minus,
  Plus,
  Sparkles,
  Timer,
  X,
  Check,
  Activity,
  CheckCircle2,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { Button } from '../ui';
import type { Exercise, PlanSet } from '../../api/plans';

export interface PrescriptionActionSheetProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  currentWeightKg?: number | null;
  weightUnit?: 'kg' | 'lbs';
  onSave?: (updatedRir?: number, updatedRestSeconds?: number) => void;
}

interface RirOption {
  value: number;
  label: string;
  badge: string;
  shortDesc: string;
  clinicalDesc: string;
  color: string;
  bgActive: string;
}

const RIR_OPTIONS: RirOption[] = [
  {
    value: 0,
    label: 'RIR 0',
    badge: '0 left',
    shortDesc: 'Max Effort (Failure)',
    clinicalDesc: 'Muscular failure. Zero repetitions left in the tank with proper form.',
    color: colors.accentRed,
    bgActive: 'rgba(239, 68, 68, 0.15)',
  },
  {
    value: 1,
    label: 'RIR 1',
    badge: '1 left',
    shortDesc: 'Very Hard (1 rep in reserve)',
    clinicalDesc: 'Near-maximal effort. Exactly 1 more repetition possible before form breaks.',
    color: colors.accentCyan,
    bgActive: 'rgba(6, 182, 212, 0.15)',
  },
  {
    value: 2,
    label: 'RIR 2',
    badge: '2 left 🔥',
    shortDesc: 'Hard (Hypertrophy sweet spot)',
    clinicalDesc: 'Optimal stimulus-to-fatigue ratio for hypertrophy and high motor-unit recruitment.',
    color: colors.accentVolt,
    bgActive: 'rgba(16, 231, 96, 0.15)',
  },
  {
    value: 3,
    label: 'RIR 3',
    badge: '2-3 left',
    shortDesc: 'Moderate (2-3 reps in reserve)',
    clinicalDesc: 'Moderate exertion. Crisp bar speed, excellent for volume building and technique.',
    color: colors.accentAmber,
    bgActive: 'rgba(245, 158, 11, 0.15)',
  },
  {
    value: 4,
    label: 'RIR 4+',
    badge: '4+ left',
    shortDesc: 'Light / Warmup',
    clinicalDesc: 'Submaximal primer load. Low neuromuscular fatigue, priming joint mobility.',
    color: colors.textSecondary,
    bgActive: 'rgba(148, 163, 184, 0.15)',
  },
];

const REST_PRESETS = [45, 60, 90, 120, 180];

export function PrescriptionActionSheet({
  visible,
  onClose,
  exercise,
  currentWeightKg,
  weightUnit = 'kg',
  onSave,
}: PrescriptionActionSheetProps) {
  // Extract initial values from exercise sets or notes
  const initialRir = useMemo(() => {
    if (!exercise) return 2;
    const fromSet = exercise.sets?.find((s) => typeof s.targetRir === 'number')?.targetRir;
    if (typeof fromSet === 'number') return Math.min(4, Math.max(0, Math.round(fromSet)));
    if (exercise.notes) {
      const match = exercise.notes.match(/@?\s*RIR\s*([0-9.]+)/i);
      if (match) return Math.min(4, Math.max(0, Math.round(parseFloat(match[1]))));
    }
    return 2;
  }, [exercise]);

  const initialRest = useMemo(() => {
    if (!exercise) return 90;
    const fromSet = exercise.sets?.find((s) => typeof s.restSeconds === 'number')?.restSeconds;
    if (typeof fromSet === 'number' && fromSet > 0) return fromSet;
    if (exercise.notes) {
      const match = exercise.notes.match(/rest\s*:?\s*([0-9]+)/i);
      if (match) return parseInt(match[1], 10);
    }
    return 90;
  }, [exercise]);

  const tempoString = useMemo(() => {
    if (!exercise) return '3-0-1-0';
    const fromSet = exercise.sets?.find((s) => s.tempo)?.tempo;
    if (fromSet) return fromSet;
    if (exercise.notes) {
      const match = exercise.notes.match(/tempo\s*:?\s*([0-9–-]+)/i);
      if (match) return match[1];
    }
    return '3-0-1-0';
  }, [exercise]);

  const [selectedRir, setSelectedRir] = useState<number>(initialRir);
  const [restSeconds, setRestSeconds] = useState<number>(initialRest);

  useEffect(() => {
    if (visible) {
      setSelectedRir(initialRir);
      setRestSeconds(initialRest);
    }
  }, [visible, initialRir, initialRest]);

  if (!visible || !exercise) return null;

  const tempoParts = tempoString.split('-');
  const eccentric = tempoParts[0] || '3';
  const pauseBottom = tempoParts[1] || '0';
  const concentric = tempoParts[2] || '1';
  const pauseTop = tempoParts[3] || '0';

  const handleApply = () => {
    onSave?.(selectedRir, restSeconds);
    onClose();
  };

  const adjustRest = (delta: number) => {
    setRestSeconds((prev) => Math.max(15, Math.min(360, prev + delta)));
  };

  const sets = exercise.sets && exercise.sets.length > 0 ? exercise.sets : [
    {
      id: 'set-1',
      setNumber: 1,
      targetRepsMin: 8,
      targetRepsMax: 10,
      targetWeightKg: currentWeightKg ?? 60,
      targetRir: selectedRir,
      tempo: tempoString,
      restSeconds,
    } as PlanSet,
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Mobile Drag Handle */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <View style={styles.badgeRow}>
                <View style={styles.rxBadge}>
                  <Sparkles size={12} color={colors.accentVolt} strokeWidth={2.4} />
                  <Text style={styles.rxBadgeText}>PRESCRIPTION GUIDE</Text>
                </View>
                {exercise.muscleGroup ? (
                  <Text style={styles.muscleText}>{exercise.muscleGroup.toUpperCase()}</Text>
                ) : null}
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Text style={styles.subtitle}>
                {`${sets.length} sets prescribed · ${restSeconds}s rest · Tempo ${tempoString}`}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close prescription sheet"
              hitSlop={10}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Scrollable Body */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Prescribed Sets Overview Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PRESCRIBED SETS & TARGETS</Text>
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableCol, styles.colSet]}>SET</Text>
                  <Text style={[styles.tableCol, styles.colType]}>TYPE</Text>
                  <Text style={[styles.tableCol, styles.colTarget]}>TARGET LOAD & REPS</Text>
                  <Text style={[styles.tableCol, styles.colRir]}>TARGET</Text>
                </View>
                {sets.map((set, idx) => {
                  const isWarmup = idx === 0 && sets.length >= 4;
                  const repsText =
                    set.targetRepsMin && set.targetRepsMax
                      ? set.targetRepsMin === set.targetRepsMax
                        ? `${set.targetRepsMin} reps`
                        : `${set.targetRepsMin}-${set.targetRepsMax} reps`
                      : set.targetRepsMin != null
                        ? `${set.targetRepsMin} reps`
                        : '8-10 reps';

                  const loadText =
                    set.targetWeightKg != null
                      ? `${set.targetWeightKg} ${weightUnit}`
                      : currentWeightKg != null
                        ? `${currentWeightKg} ${weightUnit}`
                        : 'BW';

                  return (
                    <View key={set.id || idx} style={styles.tableRow}>
                      <View style={styles.colSet}>
                        <Text style={styles.setNumber}>#{set.setNumber || idx + 1}</Text>
                      </View>
                      <View style={styles.colType}>
                        <View
                          style={[
                            styles.typePill,
                            isWarmup ? styles.typePillWarmup : styles.typePillWorking,
                          ]}
                        >
                          <Text
                            style={[
                              styles.typePillText,
                              isWarmup ? styles.typeWarmupText : styles.typeWorkingText,
                            ]}
                          >
                            {isWarmup ? 'WARM' : 'WORK'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.colTarget}>
                        <Text style={styles.loadRepsText}>{`${loadText} × ${repsText}`}</Text>
                      </View>
                      <View style={styles.colRir}>
                        <Text style={[styles.rirTag, { color: colors.accentVolt }]}>
                          {`RIR ${set.targetRir ?? selectedRir}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Interactive RIR Selector with Clinical Exertion Descriptions */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>EFFORT & RIR SELECTOR</Text>
                <Text style={styles.sectionHint}>Tap to apply to session</Text>
              </View>

              <View style={styles.rirCards}>
                {RIR_OPTIONS.map((item) => {
                  const isSelected = selectedRir === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.label}`}
                      onPress={() => setSelectedRir(item.value)}
                      style={[
                        styles.rirCard,
                        isSelected && {
                          borderColor: item.color,
                          backgroundColor: item.bgActive,
                        },
                      ]}
                    >
                      <View style={styles.rirCardTop}>
                        <View style={styles.rirCardTitleGroup}>
                          <Text style={[styles.rirLabel, { color: item.color }]}>
                            {item.label}
                          </Text>
                          <View
                            style={[
                              styles.badgeSmall,
                              { backgroundColor: isSelected ? item.color : 'rgba(255,255,255,0.06)' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeSmallText,
                                { color: isSelected ? colors.bgPrimary : colors.textSecondary },
                              ]}
                            >
                              {item.badge}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.rirShortDesc}>{item.shortDesc}</Text>
                        {isSelected ? (
                          <View style={styles.checkWrap}>
                            <Check size={14} color={item.color} strokeWidth={3} />
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.rirClinicalDesc}>{item.clinicalDesc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Lifting Tempo Breakdown */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>LIFTING TEMPO</Text>
                <Text style={[styles.sectionHint, { color: colors.accentCyan }]}>
                  {tempoString}
                </Text>
              </View>

              <View style={styles.tempoGrid}>
                <View style={styles.tempoBox}>
                  <Text style={styles.tempoValue}>{eccentric}s</Text>
                  <Text style={styles.tempoPhase}>Eccentric</Text>
                  <Text style={styles.tempoDesc}>Lower with control</Text>
                </View>
                <View style={styles.tempoBox}>
                  <Text style={styles.tempoValue}>{pauseBottom}s</Text>
                  <Text style={styles.tempoPhase}>Pause</Text>
                  <Text style={styles.tempoDesc}>Bottom isometric</Text>
                </View>
                <View style={styles.tempoBox}>
                  <Text style={styles.tempoValue}>{concentric}s</Text>
                  <Text style={styles.tempoPhase}>Concentric</Text>
                  <Text style={styles.tempoDesc}>Explosive drive</Text>
                </View>
                <View style={styles.tempoBox}>
                  <Text style={styles.tempoValue}>{pauseTop}s</Text>
                  <Text style={styles.tempoPhase}>Pause</Text>
                  <Text style={styles.tempoDesc}>Top lockout / brace</Text>
                </View>
              </View>
            </View>

            {/* Rest Timer Quick Adjustment */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>INTER-SET REST TIMER</Text>
                <Text style={styles.sectionHint}>{restSeconds} seconds</Text>
              </View>

              <View style={styles.restStepperRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease rest by 15 seconds"
                  onPress={() => adjustRest(-15)}
                  style={styles.restStepBtn}
                >
                  <Minus size={18} color={colors.textPrimary} strokeWidth={2.4} />
                </Pressable>

                <View style={styles.restDisplay}>
                  <Timer size={18} color={colors.accentVolt} strokeWidth={2.2} />
                  <Text style={styles.restDisplayText}>{`${restSeconds}s`}</Text>
                  <Text style={styles.restDisplaySub}>
                    {restSeconds >= 60
                      ? `${Math.floor(restSeconds / 60)}m ${restSeconds % 60 ? `${restSeconds % 60}s` : ''}`.trim()
                      : 'High density'}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase rest by 15 seconds"
                  onPress={() => adjustRest(15)}
                  style={styles.restStepBtn}
                >
                  <Plus size={18} color={colors.textPrimary} strokeWidth={2.4} />
                </Pressable>
              </View>

              {/* Preset Chips */}
              <View style={styles.presetRow}>
                {REST_PRESETS.map((seconds) => {
                  const active = restSeconds === seconds;
                  return (
                    <Pressable
                      key={seconds}
                      accessibilityRole="button"
                      accessibilityLabel={`Set rest to ${seconds}s`}
                      onPress={() => setRestSeconds(seconds)}
                      style={[styles.presetChip, active && styles.presetChipActive]}
                    >
                      <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                        {`${seconds}s`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Coaching Notes (if present) */}
            {exercise.notes ? (
              <View style={styles.coachingCard}>
                <Text style={styles.coachingLabel}>COACHING CUE</Text>
                <Text style={styles.coachingText}>{exercise.notes}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Action Button */}
          <View style={styles.footer}>
            <Button
              label={`Apply RIR ${selectedRir} & ${restSeconds}s Rest`}
              variant="volt"
              size="lg"
              fullWidth
              onPress={handleApply}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rxBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accentVolt,
    letterSpacing: 0.5,
  },
  muscleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  table: {
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableCol: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  colSet: { width: 36 },
  colType: { width: 56 },
  colTarget: { flex: 1, paddingHorizontal: 6 },
  colRir: { width: 54, alignItems: 'flex-end' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  setNumber: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typePillWorking: {
    backgroundColor: 'rgba(16, 231, 96, 0.15)',
  },
  typePillWarmup: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  typePillText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
  },
  typeWorkingText: {
    color: colors.accentVolt,
  },
  typeWarmupText: {
    color: colors.accentAmber,
  },
  loadRepsText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  rirTag: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textAlign: 'right',
  },
  rirCards: {
    gap: 8,
  },
  rirCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  rirCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rirCardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rirLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeSmallText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  rirShortDesc: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  checkWrap: {
    marginLeft: 6,
  },
  rirClinicalDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  tempoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  tempoBox: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 10,
    alignItems: 'center',
  },
  tempoValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.accentCyan,
  },
  tempoPhase: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  tempoDesc: {
    marginTop: 2,
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
  },
  restStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 10,
  },
  restStepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restDisplayText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  restDisplaySub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: {
    borderColor: colors.accentVolt,
    backgroundColor: 'rgba(16, 231, 96, 0.12)',
  },
  presetChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  presetChipTextActive: {
    color: colors.accentVolt,
    fontWeight: fontWeight.bold,
  },
  coachingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  coachingLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.accentVolt,
    letterSpacing: 1,
    marginBottom: 4,
  },
  coachingText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
});

export default PrescriptionActionSheet;
