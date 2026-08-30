import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { isNetworkError } from '../../services/offlineSync';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flag,
  Flame,
  Minus,
  Plus,
  Zap,
} from 'lucide-react-native';
import { ScreenContainer, Button, Badge, OfflineBanner } from '../../components/ui';
import { colors } from '../../theme/colors';
import { fontSize, fontWeight } from '../../theme/typography';
import { createSession, completeSession, sendPainAlert } from '../../api/sessions';
import type { LoggedSet, SetType, WorkoutSession } from '../../api/sessions';
import type { Exercise, PlanSet, WorkoutDay, WorkoutPlan } from '../../api/plans';
import type { RootStackParamList } from '../../navigation/types';
import { useSettings } from '../../context/SettingsContext';
import { useSync } from '../../context/SyncContext';
import { useRestTimer } from './useRestTimer';
import { RestTimerHud } from './RestTimerHud';
import { PainAlertModal } from './PainAlertModal';
import { FinishSummaryModal } from './FinishSummaryModal';
import PrehabSection from '../../components/workout/PrehabSection';
import type {
  SessionExerciseState,
  SessionFinishSummary,
  SetDraft,
} from './sessionTypes';

type LiveSessionProps = NativeStackScreenProps<RootStackParamList, 'LiveSession'>;

const SET_TYPES: SetType[] = ['NORMAL', 'WARMUP', 'DROP', 'FAILURE'];

const KG_PER_LB = 0.453592;
/** ≈ 5 lb per tap when logging in pounds. */
const LB_STEP_KG = 2.268;

const PAIN_BODY_PARTS = ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle', 'Lower Back', 'Neck'];

const REST_COMPLETE_CUE = 'Rest complete. Get ready for your next set.';

export default function LiveSessionScreen({ route, navigation }: LiveSessionProps) {
  const { plan: planParam, dayIndex: dayIndexParam, dayName: dayNameParam } = route.params ?? {};

  // ------------------------------------------------------------ User settings
  const { settings } = useSettings();
  const { enqueueAction, isConnected } = useSync();

  // ------------------------------------------------------------- Session state
  const [plan] = useState<WorkoutPlan | null>(() => (planParam as WorkoutPlan | undefined) ?? null);
  const [day] = useState<WorkoutDay | null>(() => {
    if (planParam && Array.isArray((planParam as WorkoutPlan).days)) {
      const days = (planParam as WorkoutPlan).days;
      return (
        days.find((d) => d.dayIndex === dayIndexParam) ??
        days.find((d) => d.dayIndex === (planParam as WorkoutPlan).currentDayIndex) ??
        days[0] ??
        null
      );
    }
    if (dayNameParam) {
      return {
        id: `day-${dayIndexParam ?? 0}`,
        dayIndex: dayIndexParam ?? 1,
        name: dayNameParam,
        exercises: [],
      };
    }
    return null;
  });

  const exercises: Exercise[] = day?.exercises ?? [];

  const [exerciseStates, setExerciseStates] = useState<SessionExerciseState[]>(() =>
    exercises.map((exercise) => ({
      exercise,
      logged: [],
      appliedTargetKg: null,
    })),
  );

  // Active exercise accordion + log-entry draft.
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(exercises[0]?.id ?? null);
  const [draft, setDraft] = useState<SetDraft>({ setType: 'NORMAL', weightKg: 60, reps: 8 });

  // Display unit for the weight stepper (stored internally in kg).
  // Defaults to the athlete's preferred unit from Settings.
  const [unit, setUnit] = useState<'kg' | 'lbs'>(settings.weightUnit);
  useEffect(() => {
    setUnit(settings.weightUnit);
  }, [settings.weightUnit]);
  const weightStep = unit === 'kg' ? 2.5 : LB_STEP_KG;
  const displayWeight = useCallback(
    (kg: number) => (unit === 'kg' ? kg : Math.round((kg / KG_PER_LB) * 10) / 10),
    [unit],
  );

  // Remote session handle (created on mount; optional if the API is unreachable).
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  // Finish flow.
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<SessionFinishSummary | null>(null);
  /** True when the session was queued offline instead of synced live. */
  const [offlineSaved, setOfflineSaved] = useState(false);

  // Pain alert flow.
  const [painVisible, setPainVisible] = useState(false);
  const [painLevel, setPainLevel] = useState(3);
  const [painBodyPart, setPainBodyPart] = useState<string | null>(null);
  const [painSubmitting, setPainSubmitting] = useState(false);
  const [painAdvice, setPainAdvice] = useState<string | null>(null);
  const [painDeload, setPainDeload] = useState<boolean | null>(null);
  const [painError, setPainError] = useState<string | null>(null);

  // Smart warm-up / prehab flow (rendered before lifting).
  const [prehabVisible, setPrehabVisible] = useState(false);

  // ---------------------------------------------------------------- Keep-awake
  // Only keep the screen awake when the athlete has keep-awake enabled.
  useEffect(() => {
    if (!settings.keepAwakeEnabled) {
      deactivateKeepAwake();
      return;
    }
    activateKeepAwakeAsync().catch(() => undefined);
    return () => {
      deactivateKeepAwake();
    };
  }, [settings.keepAwakeEnabled]);

  // Always stop any in-flight speech on unmount.
  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

  // ---------------------------------------------------------------- API sync
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await createSession({
          planId: plan?.id,
          dayIndex: day?.dayIndex,
        });
        if (!cancelled && result?.session) setSession(result.session);
      } catch {
        // Offline-tolerant: local logging continues; finish still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, day]);

  // ---------------------------------------------------------------- Rest timer
  // Voice cues + haptics fire only when the athlete has them enabled.
  const restTimer = useRestTimer(
    useCallback(() => {
      if (settings.hapticsEnabled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (settings.voiceCuesEnabled) {
        Speech.speak(REST_COMPLETE_CUE, { language: 'en', rate: 1.0 });
      }
    }, [settings.hapticsEnabled, settings.voiceCuesEnabled]),
  );

  // ---------------------------------------------------------------- Derived
  const totals = useMemo(() => {
    let totalSets = 0;
    let totalReps = 0;
    let totalVolumeKg = 0;
    for (const state of exerciseStates) {
      for (const loggedSet of state.logged) {
        totalSets += 1;
        totalReps += loggedSet.reps ?? 0;
        totalVolumeKg += (loggedSet.weightKg ?? 0) * (loggedSet.reps ?? 0);
      }
    }
    return { totalSets, totalReps, totalVolumeKg };
  }, [exerciseStates]);

  const completedExercises = useMemo(
    () => exerciseStates.filter((state) => state.logged.length > 0).length,
    [exerciseStates],
  );

  // ---------------------------------------------------------------- Actions
  const patchExercise = useCallback(
    (exerciseId: string, patch: (state: SessionExerciseState) => SessionExerciseState) => {
      setExerciseStates((prev) => prev.map((s) => (s.exercise.id === exerciseId ? patch(s) : s)));
    },
    [],
  );

  const completeSet = useCallback(
    (exerciseId: string) => {
      if (settings.hapticsEnabled) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const exerciseState = exerciseStates.find((s) => s.exercise.id === exerciseId);
      const nextSetNumber = (exerciseState?.logged.length ?? 0) + 1;

      const loggedSet: LoggedSet = {
        planSetId: null,
        exerciseId,
        exerciseName: exerciseState?.exercise.name ?? null,
        setNumber: nextSetNumber,
        setType: draft.setType,
        weightKg: draft.weightKg,
        reps: draft.reps,
        completedAt: new Date().toISOString(),
      };

      patchExercise(exerciseId, (state) => ({
        ...state,
        logged: [...state.logged, loggedSet],
      }));

      // Durable offline capture: queue a LOG_SET replay so every set survives
      // a dead zone even if the session never completes online. When a real
      // session exists, its pre-created placeholder row (per exercise, in set
      // order) is matched so the replay PATCHes the prescribed row —
      // preserving the AI previous-performance pipeline — instead of
      // inserting a duplicate row.
      const placeholderRow = (() => {
        if (!session || !exerciseState) return null;
        const rows = session.loggedSets.filter(
          (candidate) => candidate.exerciseName === exerciseState.exercise.name,
        );
        const candidate = rows[nextSetNumber - 1];
        return candidate?.id && candidate.reps === 0 ? candidate : null;
      })();

      void enqueueAction('LOG_SET', {
        workoutSessionId: session?.id ?? null,
        exerciseLogId: placeholderRow?.id ?? null,
        exerciseId,
        exerciseName: exerciseState?.exercise.name ?? null,
        muscleGroup: exerciseState?.exercise.muscleGroup ?? null,
        setNumber: nextSetNumber,
        setType: draft.setType,
        weightKg: draft.weightKg,
        reps: draft.reps,
        completedAt: loggedSet.completedAt,
        planId: plan?.id ?? null,
        planDayId: day?.id ?? null,
      }).catch(() => undefined);

      // Rest HUD: prescribed rest first, then the user's default from Settings.
      const lastSet: PlanSet | undefined =
        exerciseState?.exercise.sets?.[
          Math.min(nextSetNumber, exerciseState.exercise.sets?.length ?? 1) - 1
        ];
      restTimer.start(lastSet?.restSeconds ?? settings.defaultRestSeconds);
    },
    [draft, enqueueAction, exerciseStates, patchExercise, restTimer, session, settings, plan, day],
  );

  const applyOverloadTarget = useCallback(
    (exerciseId: string, targetSet: PlanSet) => {
      const target = targetSet.targetWeightKg ?? null;
      patchExercise(exerciseId, (state) => ({
        ...state,
        appliedTargetKg: target,
      }));
      setDraft((prev) => ({ ...prev, weightKg: target ?? prev.weightKg }));
      if (settings.hapticsEnabled) {
        void Haptics.selectionAsync();
      }
    },
    [patchExercise, settings.hapticsEnabled],
  );

  const submitPainAlert = useCallback(async () => {
    if (!painBodyPart) return;
    setPainSubmitting(true);
    setPainError(null);
    const painPayload = {
      bodyPart: painBodyPart,
      painLevel,
      exerciseName: exercises.find((e) => e.id === activeExerciseId)?.name,
    };
    try {
      const response = await sendPainAlert(session?.id ?? 'local', painPayload);
      setPainAdvice(response.advice);
      setPainDeload(response.deloadRecommended);
      if (settings.hapticsEnabled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      if (isNetworkError(error)) {
        // Clinical safety data must never be lost: queue the alert for replay
        // and reassure the athlete it is captured locally.
        await enqueueAction('PAIN_ALERT', painPayload);
        setPainAdvice(
          'Your pain report is saved on this device and will reach your coach as soon as you are back online. Until then: stop the set, keep the range of motion pain-free, and do not push through sharp pain.',
        );
        setPainDeload(true);
      } else {
        setPainError('Could not reach the coach. Check your connection and retry.');
      }
    } finally {
      setPainSubmitting(false);
    }
  }, [
    activeExerciseId,
    enqueueAction,
    exercises,
    painBodyPart,
    painLevel,
    session,
    settings.hapticsEnabled,
  ]);

  const finishWorkout = useCallback(async () => {
    if (totals.totalSets === 0) {
      Alert.alert('Nothing logged yet', 'Complete at least one set before finishing the workout.');
      return;
    }
    setFinishing(true);
    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 1000));
      const localSummary: SessionFinishSummary = {
        totalSets: totals.totalSets,
        totalReps: totals.totalReps,
        totalVolumeKg: totals.totalVolumeKg,
        durationSeconds,
        completedExercises,
      };
      const allLoggedSets: LoggedSet[] = exerciseStates.flatMap((state) => state.logged);

      const result = await completeSession(session?.id ?? 'local', { durationSeconds });

      if (result.networkError) {
        // 100% resilient completion: the workout is durably queued on-device
        // and replayed on reconnect. The celebration still happens.
        await enqueueAction('COMPLETE_SESSION', {
          sessionId: session?.id ?? null,
          durationSeconds,
          planId: plan?.id ?? null,
        });
        void Speech.speak(
          'Workout saved on your device. It will sync automatically when you are back online.',
          { language: 'en', rate: 1.0 },
        );
      } else if (settings.voiceCuesEnabled) {
        void Speech.speak('Workout complete. Great work!', { language: 'en', rate: 1.0 });
      }

      if (settings.hapticsEnabled) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setSummary(localSummary);
      setOfflineSaved(result.networkError === true);
    } finally {
      setFinishing(false);
    }
  }, [
    completedExercises,
    day,
    enqueueAction,
    exerciseStates,
    plan,
    session,
    settings.hapticsEnabled,
    settings.voiceCuesEnabled,
    totals,
  ]);

  const closeSummary = useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

  // ---------------------------------------------------------------- Render
  const activeExercise = exerciseStates.find((s) => s.exercise.id === activeExerciseId) ?? null;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenContainer scrollable padded={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.headerLabel}>LIVE SESSION</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {day ? `Day ${day.dayIndex} — ${day.name}` : 'Freestyle Session'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report joint pain"
              hitSlop={8}
              onPress={() => {
                setPainAdvice(null);
                setPainDeload(null);
                setPainError(null);
                setPainVisible(true);
              }}
              style={styles.painButton}
            >
              <AlertTriangle size={20} color={colors.accentRed} strokeWidth={2.2} />
            </Pressable>
          </View>

          {/* Smart warm-up launcher — priming routine before lifting */}
          {prehabVisible ? (
            <View style={styles.prehabWrap}>
              <PrehabSection exercises={exercises} compact />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open smart warm-up and prehab"
              onPress={() => setPrehabVisible(true)}
              style={styles.prehabLauncher}
            >
              <Flame size={16} color={colors.accentAmber} strokeWidth={2.2} />
              <Text style={styles.prehabLauncherText}>Smart Warm-up & Prehab</Text>
              <Text style={styles.prehabLauncherHint}>Joint priming · 5-10 min</Text>
            </Pressable>
          )}

          <View style={styles.body}>
            {/* Exercise accordion */}
            {exerciseStates.map((state, index) => {
              const expanded = state.exercise.id === activeExerciseId;
              const firstSet = state.exercise.sets?.[0];
              const targetLabel =
                state.appliedTargetKg != null
                  ? `${state.appliedTargetKg} kg`
                  : firstSet?.targetWeightKg != null
                    ? `${firstSet.targetWeightKg} kg`
                    : 'BW';
              return (
                <View key={state.exercise.id} style={[styles.exerciseCard, index > 0 && styles.gapSm]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${state.exercise.name}`}
                    onPress={() => setActiveExerciseId(expanded ? null : state.exercise.id)}
                    style={styles.exerciseHeader}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.exerciseName}>{state.exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {`${state.logged.length}/${state.exercise.sets?.length ?? 0} sets · target ${targetLabel}`}
                      </Text>
                    </View>
                    {state.appliedTargetKg != null ? (
                      <Badge label="AI" variant="amber" />
                    ) : null}
                    {expanded ? (
                      <ChevronUp size={18} color={colors.textSecondary} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />
                    )}
                  </Pressable>

                  {expanded ? (
                    <View style={styles.exerciseBody}>
                      {/* AI overload chip */}
                      {(() => {
                        const overloadSet =
                          state.exercise.sets?.find((s) => s.isProgressiveOverload || (s.overloadIncrementKg ?? 0) > 0) ??
                          null;
                        if (!overloadSet) return null;
                        const increment = overloadSet.overloadIncrementKg ?? 2.5;
                        return (
                          <View style={styles.overloadChip}>
                            <Zap size={14} color={colors.accentAmber} strokeWidth={2.2} />
                            <Text style={styles.overloadText} numberOfLines={1}>
                              {`Target: ${overloadSet.targetWeightKg ?? 'BW'} kg (+${increment} kg overload)`}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Apply AI overload target"
                              onPress={() => applyOverloadTarget(state.exercise.id, overloadSet)}
                              style={styles.applyBtn}
                            >
                              <Text style={styles.applyBtnText}>Apply</Text>
                            </Pressable>
                          </View>
                        );
                      })()}

                      {/* Logged sets matrix */}
                      {state.logged.length > 0 ? (
                        <View style={styles.loggedWrap}>
                          {state.logged.map((loggedSet, setIdx) => (
                            <View key={`${loggedSet.completedAt ?? ''}-${setIdx}`} style={styles.loggedRow}>
                              <Text style={styles.loggedIndex}>{setIdx + 1}</Text>
                              <Text style={styles.loggedType}>{loggedSet.setType}</Text>
                              <Text style={styles.loggedDetail}>
                                {`${loggedSet.weightKg ?? 0} kg × ${loggedSet.reps ?? 0}`}
                              </Text>
                              <Flag size={14} color={colors.accentVolt} strokeWidth={2.2} />
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {/* Log-entry form (only for the active exercise) */}
                      {state.exercise.id === activeExerciseId ? (
                        <View style={styles.logForm}>
                          {/* Set type pills */}
                          <View style={styles.pillRow}>
                            {SET_TYPES.map((type) => {
                              const activeType = draft.setType === type;
                              return (
                                <Pressable
                                  key={type}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Set type ${type}`}
                                  onPress={() => setDraft((prev) => ({ ...prev, setType: type }))}
                                  style={[styles.pill, activeType && styles.pillActive]}
                                >
                                  <Text style={[styles.pillText, activeType && styles.pillTextActive]}>
                                    {type}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          {/* Weight + reps steppers */}
                          <View style={styles.stepperRow}>
                            <View style={styles.stepper}>
                              <View style={styles.stepperHeader}>
                                <Text style={styles.stepperLabel}>{`WEIGHT (${unit.toUpperCase()})`}</Text>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Toggle weight unit"
                                  onPress={() => setUnit((prev) => (prev === 'kg' ? 'lbs' : 'kg'))}
                                  style={styles.unitToggle}
                                >
                                  <Text style={styles.unitToggleText}>{unit === 'kg' ? '→ lbs' : '→ kg'}</Text>
                                </Pressable>
                              </View>
                              <View style={styles.stepperControls}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Decrease weight"
                                  onPress={() =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      weightKg: Math.max(0, Math.round((prev.weightKg - weightStep) * 100) / 100),
                                    }))
                                  }
                                  style={styles.stepperBtn}
                                >
                                  <Minus size={18} color={colors.textPrimary} strokeWidth={2.4} />
                                </Pressable>
                                <TextInput
                                  style={styles.stepperValue}
                                  value={String(displayWeight(draft.weightKg))}
                                  onChangeText={(text) => {
                                    const parsed = parseFloat(text.replace(',', '.'));
                                    if (!Number.isFinite(parsed)) return;
                                    const kg = unit === 'kg' ? parsed : parsed * KG_PER_LB;
                                    setDraft((prev) => ({ ...prev, weightKg: kg }));
                                  }}
                                  keyboardType="decimal-pad"
                                />
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Increase weight"
                                  onPress={() =>
                                    setDraft((prev) => ({
                                      ...prev,
                                      weightKg: Math.round((prev.weightKg + weightStep) * 100) / 100,
                                    }))
                                  }
                                  style={styles.stepperBtn}
                                >
                                  <Plus size={18} color={colors.textPrimary} strokeWidth={2.4} />
                                </Pressable>
                              </View>
                            </View>

                            <View style={styles.stepper}>
                              <Text style={styles.stepperLabel}>REPS</Text>
                              <View style={styles.stepperControls}>
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Decrease reps"
                                  onPress={() =>
                                    setDraft((prev) => ({ ...prev, reps: Math.max(0, prev.reps - 1) }))
                                  }
                                  style={styles.stepperBtn}
                                >
                                  <Minus size={18} color={colors.textPrimary} strokeWidth={2.4} />
                                </Pressable>
                                <TextInput
                                  style={styles.stepperValue}
                                  value={String(draft.reps)}
                                  onChangeText={(text) => {
                                    const parsed = parseInt(text, 10);
                                    setDraft((prev) => ({
                                      ...prev,
                                      reps: Number.isFinite(parsed) ? parsed : 0,
                                    }));
                                  }}
                                  keyboardType="number-pad"
                                />
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel="Increase reps"
                                  onPress={() =>
                                    setDraft((prev) => ({ ...prev, reps: prev.reps + 1 }))
                                  }
                                  style={styles.stepperBtn}
                                >
                                  <Plus size={18} color={colors.textPrimary} strokeWidth={2.4} />
                                </Pressable>
                              </View>
                            </View>
                          </View>

                          {/* Complete set button */}
                          <Button
                            label={`✓ Complete Set ${state.logged.length + 1}`}
                            variant="volt"
                            size="lg"
                            fullWidth
                            onPress={() => completeSet(state.exercise.id)}
                          />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}

            {exerciseStates.length === 0 ? (
              <View style={styles.emptyCard}>
                <Dumbbell size={28} color={colors.textMuted} strokeWidth={1.8} />
                <Text style={styles.emptyText}>
                  No exercises prescribed for this day. Log freely — your coach adapts.
                </Text>
              </View>
            ) : null}

            {/* Finish workout */}
            <View style={styles.finishWrap}>
              <Button
                label={`Finish Workout · ${totals.totalSets} sets`}
                variant="secondary"
                size="lg"
                fullWidth
                loading={finishing}
                onPress={() => void finishWorkout()}
              />
            </View>
          </View>
        </ScreenContainer>

        {/* Offline / pending-sync ribbon */}
        <View style={styles.bannerWrap}>
          <OfflineBanner />
        </View>

        {/* Floating Rest Timer HUD */}
        <RestTimerHud
          phase={restTimer.phase}
          remaining={restTimer.remaining}
          duration={restTimer.duration}
          onAddSeconds={restTimer.addSeconds}
          onSubtractSeconds={restTimer.subtractSeconds}
          onSkip={restTimer.skip}
          onDismiss={restTimer.dismiss}
        />

        {/* Pain alert modal */}
        <PainAlertModal
          visible={painVisible}
          painLevel={painLevel}
          bodyPart={painBodyPart}
          bodyParts={PAIN_BODY_PARTS}
          submitting={painSubmitting}
          advice={painAdvice}
          deloadRecommended={painDeload}
          error={painError}
          onClose={() => setPainVisible(false)}
          onPainChange={setPainLevel}
          onBodyPartChange={setPainBodyPart}
          onSubmit={() => void submitPainAlert()}
        />

        {/* Celebration summary modal */}
        <FinishSummaryModal
          visible={summary !== null || finishing}
          summary={summary}
          dayName={day?.name ?? 'Workout'}
          finishing={finishing}
          offlineSaved={offlineSaved}
          onClose={closeSummary}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  flex: { flex: 1 },
  bannerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 132, // sits just above the floating rest HUD
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.4,
    color: colors.accentVolt,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 2,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  prehabLauncher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  prehabLauncherText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  prehabLauncherHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  prehabWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 120, // clearance for the floating rest HUD
  },
  painButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
  },
  gapSm: { marginTop: 10 },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  exerciseMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  exerciseBody: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 12,
  },
  overloadChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
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
  loggedWrap: {
    marginBottom: 10,
    gap: 4,
  },
  loggedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bgPrimary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  loggedIndex: {
    width: 18,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  loggedType: {
    width: 64,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accentCyan,
  },
  loggedDetail: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  logForm: {
    gap: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: colors.accentVolt,
    borderColor: colors.accentVolt,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.bgPrimary,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepper: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 10,
  },
  stepperLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggle: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  unitToggleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accentCyan,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  finishWrap: {
    marginTop: 16,
  },
});

export { LiveSessionScreen };
