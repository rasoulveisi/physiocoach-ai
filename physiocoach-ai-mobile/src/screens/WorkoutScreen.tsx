import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Compass, Dumbbell, Flame, Play, Sparkles } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';
import { getCurrentPlan } from '../api/plans';
import type { WorkoutPlan } from '../api/plans';
import type { RootStackParamList } from '../navigation/types';

type WorkoutNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function WorkoutScreen() {
  const navigation = useNavigation<WorkoutNavigationProp>();
  const isFocused = useIsFocused();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPlan = useCallback(async () => {
    try {
      const result = await getCurrentPlan();
      setPlan(result.plan);
    } catch {
      setPlan(null);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchPlan().finally(() => setLoading(false));
    }
  }, [fetchPlan, isFocused]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPlan();
    } finally {
      setRefreshing(false);
    }
  }, [fetchPlan]);

  const todayDay =
    plan?.days?.find((day) => day.dayIndex === plan.currentDayIndex) ?? plan?.days?.[0] ?? null;

  const startSession = useCallback(() => {
    navigation.navigate('LiveSession', {
      plan,
      dayIndex: todayDay?.dayIndex,
      dayName: todayDay?.name,
    });
  }, [navigation, plan, todayDay]);

  const totalSets = todayDay?.exercises?.reduce(
    (acc, ex) => acc + (ex.sets?.length ?? 3),
    0,
  ) ?? 0;

  return (
    <ScreenContainer scrollable onRefresh={handleRefresh} refreshing={refreshing}>
      <Header
        title="Workout"
        subtitle="Live training hub"
        rightAction={<Dumbbell size={22} color={colors.accentVolt} />}
      />

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.accentVolt} />
          <Text style={styles.loadingText}>Loading your scheduled session…</Text>
        </Card>
      ) : todayDay && plan ? (
        <>
          {/* ------------------------------------------------ Active Day Hero Card */}
          <Card elevated>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardLabel}>TODAY'S SCHEDULED SESSION</Text>
                <Text style={styles.sessionTitle}>{todayDay.name}</Text>
                <Text style={styles.planSubtitle}>{plan.title}</Text>
              </View>
              {plan.split ? <Badge label={plan.split} variant="volt" /> : null}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Flame size={15} color={colors.accentVolt} />
                <Text style={styles.statPillText}>Day {todayDay.dayIndex}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillText}>{todayDay.exercises?.length ?? 0} Exercises</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillText}>{totalSets} Total Sets</Text>
              </View>
            </View>

            <View style={styles.gapTop}>
              <Button
                label="Start Live Session"
                variant="volt"
                size="lg"
                fullWidth
                onPress={startSession}
              />
            </View>
          </Card>

          {/* ------------------------------------------- Exercise Overview List */}
          <Card style={styles.gapTop}>
            <Text style={styles.cardLabel}>EXERCISE BREAKDOWN</Text>
            {todayDay.exercises?.map((exercise, index) => {
              const firstSet = exercise.sets?.[0];
              const repRange =
                firstSet?.targetRepsMin != null && firstSet?.targetRepsMax != null
                  ? `${firstSet.targetRepsMin}-${firstSet.targetRepsMax} reps`
                  : '8-10 reps';
              const restSec = firstSet?.restSeconds ?? 90;

              return (
                <View
                  key={exercise.id ?? `ex-${index}`}
                  style={[
                    styles.exerciseRow,
                    index === todayDay.exercises.length - 1 && styles.noBorder,
                  ]}
                >
                  <View style={styles.indexCircle}>
                    <Text style={styles.indexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.sets?.length ?? 3} sets · {repRange} · Rest {restSec}s
                    </Text>
                  </View>
                  {exercise.sets?.some((s) => s.isProgressiveOverload) ? (
                    <Badge label="⚡ Overload" variant="amber" />
                  ) : null}
                </View>
              );
            })}
          </Card>
        </>
      ) : (
        /* --------------------------------------------- No Plan / Freestyle Flow */
        <Card elevated style={styles.gapTop}>
          <Sparkles size={28} color={colors.accentVolt} />
          <Text style={[styles.sessionTitle, styles.gapSm]}>No Active Plan Scheduled</Text>
          <Text style={styles.emptyDescription}>
            You can start a freestyle open gym session right now, or explore verified community routines to set your active schedule.
          </Text>

          <View style={styles.gapTop}>
            <Button
              label="Start Freestyle Session"
              variant="volt"
              size="lg"
              fullWidth
              onPress={startSession}
            />
          </View>

          <View style={styles.gapSm}>
            <Button
              label="Browse Explore Marketplace"
              variant="outline"
              fullWidth
              onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' } as never)}
            />
          </View>
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 6,
  },
  sessionTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  planSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statPillText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  noBorder: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  indexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  indexText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.accentVolt,
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  exerciseMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  gapTop: { marginTop: 16 },
  gapSm: { marginTop: 10 },
});

export { WorkoutScreen };
