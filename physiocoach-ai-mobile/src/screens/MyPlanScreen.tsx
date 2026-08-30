import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Library,
  Star,
  Zap,
} from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';
import { activatePlan, getCurrentPlan, getMyPlans, ratePlan } from '../api/plans';
import type { Exercise, PlanSet, WorkoutDay, WorkoutPlan } from '../api/plans';
import type { RootStackParamList } from '../navigation/types';
import { useSync } from '../context/SyncContext';
import { isNetworkError } from '../services/offlineSync';
import { getExerciseMediaUrl, getPlanCoverImage } from '../utils/mediaUtils';

type MyPlanNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Reasonable defaults when the API omits prescription fields. */
const DEFAULT_SETS = 3;
const DEFAULT_REPS = '8-10';
const DEFAULT_REST = 90;
const DEFAULT_TEMPO = '3-0-1-0';

/** "82.5 kg (+2.5 kg overload)" — first AI-flagged overload target on an exercise. */
function findOverload(exercise: Exercise): { set: PlanSet; increment: number } | null {
  for (const set of exercise.sets ?? []) {
    if (set.isProgressiveOverload || (set.overloadIncrementKg ?? 0) > 0) {
      return { set, increment: set.overloadIncrementKg ?? 2.5 };
    }
  }
  return null;
}

function formatReps(min?: number | null, max?: number | null): string {
  if (min != null && max != null) return `${min}-${max}`;
  if (min != null) return `${min}+`;
  if (max != null) return `≤${max}`;
  return DEFAULT_REPS;
}

export default function MyPlanScreen() {
  const navigation = useNavigation<MyPlanNavigationProp>();
  const isFocused = useIsFocused();
  const { enqueueAction } = useSync();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  // 1-click "Apply Target" state (consumed by the live session in phase 4).
  const [appliedTarget, setAppliedTarget] = useState<{
    exerciseId: string;
    set: PlanSet;
  } | null>(null);
  const [appliedTargetId, setAppliedTargetId] = useState<string | null>(null);

  // Plans library modal state.
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [libraryPlans, setLibraryPlans] = useState<WorkoutPlan[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [activatingPlanId, setActivatingPlanId] = useState<string | null>(null);

  // Rating modal state.
  const [ratingVisible, setRatingVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setError(null);
    try {
      const result = await getCurrentPlan();
      setPlan(result.plan);
    } catch {
      setError('Could not load your plan. Pull to retry.');
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadPlan().finally(() => setLoading(false));
    }
  }, [isFocused, loadPlan]);

  const days: WorkoutDay[] = useMemo(() => plan?.days ?? [], [plan]);
  const selectedDay = useMemo(
    () => days.find((day) => day.id === selectedDayId) ?? days[0] ?? null,
    [days, selectedDayId],
  );

  // Keep the selected day valid whenever the plan refreshes.
  useEffect(() => {
    if (days.length > 0 && !days.some((day) => day.id === selectedDayId)) {
      const today = days.find((d) => d.dayIndex === plan?.currentDayIndex);
      setSelectedDayId((today ?? days[0]).id);
    }
  }, [days, selectedDayId, plan?.currentDayIndex]);

  const openLibrary = useCallback(async () => {
    setLibraryVisible(true);
    if (libraryPlans) return; // cached
    setLibraryLoading(true);
    try {
      const result = await getMyPlans();
      setLibraryPlans(result.plans ?? []);
    } catch {
      setLibraryPlans([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [libraryPlans]);

  const handleActivate = useCallback(async (planId: string) => {
    setActivatingPlanId(planId);
    try {
      const result = await activatePlan(planId);
      setPlan(result.plan);
      setLibraryPlans((prev) => (prev ?? []).map((p) => ({ ...p, isActive: p.id === planId })));
      setLibraryVisible(false);
    } catch {
      // Keep the library open so the athlete can retry activation.
    } finally {
      setActivatingPlanId(null);
    }
  }, []);

  const openRating = useCallback(() => {
    setRatingValue(plan ? Math.round(plan.averageRating ?? 0) : 0);
    setReviewText('');
    setRatingDone(false);
    setRatingError(null);
    setRatingVisible(true);
  }, [plan]);

  const submitRating = useCallback(async () => {
    if (!plan || ratingValue === 0) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      await ratePlan(plan.id, ratingValue, reviewText || undefined);
      setRatingDone(true);
    } catch (error) {
      if (isNetworkError(error)) {
        // Queue the rating for replay — feedback is never lost offline.
        await enqueueAction('RATE_PLAN', {
          planId: plan.id,
          planTitle: plan.title,
          rating: ratingValue,
          review: reviewText.trim() || undefined,
        });
        setRatingDone(true);
      } else {
        setRatingError('Could not submit your rating. Try again.');
      }
    } finally {
      setRatingSubmitting(false);
    }
  }, [plan, ratingValue, reviewText, enqueueAction]);

  const startToday = useCallback(() => {
    navigation.navigate('LiveSession', {
      plan,
      dayIndex: selectedDay?.dayIndex,
      dayName: selectedDay?.name,
    });
  }, [navigation, plan, selectedDay]);

  return (
    <ScreenContainer scrollable onRefresh={loadPlan}>
      <Header
        title="My Plan"
        subtitle="Your weekly training block"
        rightAction={<CalendarDays size={22} color={colors.accentVolt} />}
      />

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.accentVolt} />
        </Card>
      ) : error && !plan ? (
        <Card>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.gapTop}>
            <Button label="Retry" variant="outline" onPress={() => void loadPlan()} />
          </View>
        </Card>
      ) : (
        <>
          {/* ------------------------------------------------ Plan header */}
          <Card elevated>
            {plan?.title ? (
              <Image
                source={{ uri: getPlanCoverImage(plan?.split ?? '', [plan?.title ?? '']) }}
                style={styles.planCoverImage}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardLabel}>ACTIVE PLAN</Text>
                <Text style={styles.planTitle} numberOfLines={2}>
                  {plan?.title ?? 'No active plan'}
                </Text>
                {plan?.goal ? <Text style={styles.goalText}>{plan.goal}</Text> : null}
              </View>
              {plan?.split ? <Badge label={plan.split} variant="volt" /> : null}
            </View>
            <View style={styles.gapTop}>
              <Button
                label="My Plans Library"
                variant="outline"
                fullWidth
                onPress={() => void openLibrary()}
              />
            </View>
          </Card>

          {/* ------------------------------------------------ Day selector */}
          {days.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayScroller}
              contentContainerStyle={styles.dayRow}
            >
              {days.map((day) => {
                const isToday = day.dayIndex === plan?.currentDayIndex;
                const isSelected = selectedDay?.id === day.id;
                return (
                  <Pressable
                    key={day.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Day ${day.dayIndex}: ${day.name}`}
                    onPress={() => {
                      setSelectedDayId(day.id);
                      setExpandedExerciseId(null);
                    }}
                    style={[
                      styles.dayPill,
                      isSelected && styles.dayPillSelected,
                      !isSelected && isToday && styles.dayPillToday,
                    ]}
                  >
                    <Text style={[styles.dayPillIndex, isSelected && styles.dayPillTextSelected]}>
                      {`DAY ${day.dayIndex}`}
                    </Text>
                    <Text
                      style={[styles.dayPillName, isSelected && styles.dayPillTextSelected]}
                      numberOfLines={1}
                    >
                      {day.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* ---------------------------------------------- Exercise cards */}
          {selectedDay ? (
            <Card style={styles.gapTop}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardLabelNoMargin}>
                  {`DAY ${selectedDay.dayIndex} — ${String(selectedDay.name).toUpperCase()}`}
                </Text>
                <Badge label={`${selectedDay.exercises?.length ?? 0} exercises`} variant="cyan" />
              </View>

              {(selectedDay.exercises ?? []).map((exercise, index) => {
                const expanded = expandedExerciseId === exercise.id;
                const overload = findOverload(exercise);
                const firstSet = exercise.sets?.[0];
                return (
                  <View key={exercise.id} style={[styles.exerciseCard, index > 0 && styles.exerciseGap]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Expand ${exercise.name}`}
                      onPress={() => setExpandedExerciseId(expanded ? null : exercise.id)}
                      style={styles.exerciseHeader}
                    >
                      <Image
                        source={{ uri: getExerciseMediaUrl(exercise) }}
                        style={styles.exerciseThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.flex}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseSummary}>
                          {`${exercise.sets?.length ?? DEFAULT_SETS} sets · ${formatReps(firstSet?.targetRepsMin, firstSet?.targetRepsMax)} reps`}
                        </Text>
                      </View>
                      {expanded ? (
                        <ChevronUp size={20} color={colors.textSecondary} strokeWidth={2} />
                      ) : (
                        <ChevronDown size={20} color={colors.textSecondary} strokeWidth={2} />
                      )}
                    </Pressable>

                    {overload ? (
                      <View style={styles.overloadChip}>
                        <Zap size={14} color={colors.accentAmber} strokeWidth={2.2} />
                        <Text style={styles.overloadText} numberOfLines={1}>
                          {`Target: ${overload.set.targetWeightKg ?? 'BW'} kg (+${overload.increment} kg overload)`}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Apply target"
                          hitSlop={6}
                          onPress={() => {
                            setAppliedTarget({ exerciseId: exercise.id, set: overload.set });
                            setAppliedTargetId(exercise.id);
                          }}
                          style={styles.applyBtn}
                        >
                          <Text style={styles.applyBtnText}>
                            {appliedTargetId === exercise.id ? '✓ Applied' : 'Apply'}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}

                    {expanded ? (
                      <View style={styles.exerciseDetail}>
                        {(exercise.sets ?? []).map((set) => (
                          <View key={set.id} style={styles.setRow}>
                            <Text style={styles.setNumber}>{`Set ${set.setNumber}`}</Text>
                            <Text style={styles.setDetail}>
                              {`${set.targetWeightKg != null ? `${set.targetWeightKg} kg` : 'BW'} × ${formatReps(set.targetRepsMin, set.targetRepsMax)} @ RIR ${set.targetRir ?? '—'} · ${set.tempo ?? DEFAULT_TEMPO} · ${set.restSeconds ?? DEFAULT_REST}s rest`}
                            </Text>
                          </View>
                        ))}
                        {exercise.notes ? (
                          <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          {/* ------------------------------------------------- Footer CTAs */}
          <View style={styles.gapTop}>
            <Button label="Start This Day" variant="volt" fullWidth onPress={startToday} />
          </View>
          <View style={styles.gapSm}>
            <Button label="Rate This Plan ★" variant="secondary" fullWidth onPress={openRating} />
          </View>

          {/* ============================== My Plans Library modal */}
          <Modal
            visible={libraryVisible}
            animationType="slide"
            presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
            onRequestClose={() => setLibraryVisible(false)}
          >
            <View style={styles.modalRoot}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Library size={20} color={colors.accentVolt} strokeWidth={2} />
                  <Text style={styles.modalTitle}>My Plans Library</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close plans library"
                  hitSlop={8}
                  onPress={() => setLibraryVisible(false)}
                >
                  <Text style={styles.modalClose}>Done</Text>
                </Pressable>
              </View>

              {libraryLoading ? (
                <View style={styles.modalBody}>
                  <ActivityIndicator size="large" color={colors.accentVolt} />
                </View>
              ) : (
                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalBody}>
                  {(libraryPlans ?? []).map((item) => (
                    <View key={item.id} style={styles.libraryRow}>
                      <View style={styles.flex}>
                        <Text style={styles.libraryTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.libraryMeta}>
                          {`${item.split} · ${item.days?.length ?? 0} days${
                            item.averageRating != null ? ` · ★ ${item.averageRating.toFixed(1)}` : ''
                          }`}
                        </Text>
                      </View>
                      {item.isActive ? (
                        <Badge label="Active" variant="volt" />
                      ) : (
                        <Button
                          label={activatingPlanId === item.id ? 'Activating…' : 'Activate'}
                          variant="outline"
                          size="sm"
                          loading={activatingPlanId === item.id}
                          onPress={() => void handleActivate(item.id)}
                        />
                      )}
                    </View>
                  ))}
                  {(libraryPlans ?? []).length === 0 ? (
                    <Text style={styles.emptyText}>
                      No saved plans yet. Your routines will appear here.
                    </Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
          </Modal>

          {/* ================================================ Rating modal */}
          <Modal
            visible={ratingVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setRatingVisible(false)}
          >
            <Pressable style={styles.ratingOverlay} onPress={() => setRatingVisible(false)}>
              <Pressable style={styles.ratingCard} onPress={() => undefined}>
                <Text style={styles.ratingTitle}>Rate This Plan</Text>
                <Text style={styles.ratingSubtitle}>
                  {plan?.title ?? 'How is this plan working for you?'}
                </Text>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
                      hitSlop={6}
                      onPress={() => {
                        setRatingValue(value);
                        setRatingDone(false);
                      }}
                    >
                      <Star
                        size={34}
                        color={value <= ratingValue ? colors.accentAmber : colors.textMuted}
                        fill={value <= ratingValue ? colors.accentAmber : 'transparent'}
                        strokeWidth={1.8}
                      />
                    </Pressable>
                  ))}
                </View>

                {ratingDone ? (
                  <Text style={styles.ratingThanks}>Thanks for your feedback! ⚡</Text>
                ) : (
                  <>
                    <TextInput
                      style={styles.ratingInput}
                      placeholder="Optional review (what worked, what didn't)…"
                      placeholderTextColor={colors.textMuted}
                      value={reviewText}
                      onChangeText={setReviewText}
                      multiline
                      textAlignVertical="top"
                    />
                    {ratingError ? <Text style={styles.ratingError}>{ratingError}</Text> : null}
                    <View style={styles.ratingActions}>
                      <View style={styles.ratingActionFlex}>
                        <Button label="Cancel" variant="ghost" onPress={() => setRatingVisible(false)} />
                      </View>
                      <View style={styles.ratingActionFlex}>
                        <Button
                          label="Submit"
                          variant="volt"
                          loading={ratingSubmitting}
                          disabled={ratingValue === 0}
                          onPress={() => void submitRating()}
                        />
                      </View>
                    </View>
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  flex: { flex: 1 },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
  cardLabelNoMargin: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  planTitle: {
    fontSize: fontSize.xxl,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  goalText: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayScroller: {
    marginTop: 16,
    flexGrow: 0,
  },
  dayRow: {
    gap: 10,
    paddingHorizontal: 20,
  },
  dayPill: {
    width: 92,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    gap: 2,
  },
  dayPillSelected: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  dayPillToday: {
    borderColor: colors.accentVolt,
  },
  dayPillIndex: {
    fontSize: fontSize.xs,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  dayPillName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  dayPillTextSelected: {
    color: colors.bgPrimary,
  },
  planCoverImage: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: colors.bgElevated,
    marginBottom: 12,
  },
  exerciseThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
    marginRight: 10,
  },
  gapTop: { marginTop: 16 },
  gapSm: { marginTop: 10 },
  exerciseCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  exerciseGap: { marginTop: 10 },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  exerciseSummary: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  overloadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  overloadText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentAmber,
  },
  applyBtn: {
    backgroundColor: colors.accentAmber,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  applyBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.bgPrimary,
    textTransform: 'uppercase',
  },
  exerciseDetail: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 10,
  },
  setRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  setNumber: {
    width: 52,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.accentCyan,
  },
  setDetail: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  exerciseNotes: {
    marginTop: 8,
    fontStyle: 'italic',
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.accentAmber,
    lineHeight: 20,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.accentVolt,
  },
  modalScroll: { flex: 1 },
  modalBody: {
    padding: 20,
    paddingBottom: 40,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  libraryTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  libraryMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 24,
  },
  ratingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ratingCard: {
    width: '100%',
    backgroundColor: colors.bgElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 20,
  },
  ratingTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  ratingSubtitle: {
    marginTop: 4,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 16,
  },
  ratingInput: {
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    padding: 12,
    minHeight: 72,
  },
  ratingError: {
    marginTop: 8,
    fontSize: fontSize.xs,
    color: colors.accentRed,
  },
  ratingThanks: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.accentVolt,
    textAlign: 'center',
  },
  ratingActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  ratingActionFlex: { flex: 1 },
});

export { MyPlanScreen };
