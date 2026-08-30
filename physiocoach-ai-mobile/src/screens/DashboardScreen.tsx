import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Activity, Flame, Footprints, ShieldCheck, Dumbbell } from 'lucide-react-native';
import { ScreenContainer, Header, Card, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';
import { fontSize, fontWeight } from '../theme/typography';
import { getCurrentPlan } from '../api/plans';
import type { WorkoutPlan } from '../api/plans';
import { getRecentSessions } from '../api/sessions';
import type { WorkoutSession } from '../api/sessions';
import type { RootStackParamList } from '../navigation/types';

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList>;

/** Safeguards preset until the injury-tracking phase lands. */
const PLACEHOLDER_SAFEGUARDS = 0;

/** "Mon, Aug 30 · 14:05" style timestamp for history rows. */
function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "42 min" style duration from seconds. */
function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

/** Midnight (local) of today, for weekly volume + streak windows. */
function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Distinct training days in a row ending today (or yesterday). */
function computeStreakDays(sessions: WorkoutSession[]): number {
  const daySet = new Set<number>(
    sessions
      .filter((s) => s.status !== 'ABANDONED')
      .map((s) => {
        const d = new Date(s.startedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }),
  );
  if (daySet.size === 0) return 0;
  const today = startOfToday();
  let cursor = daySet.has(today) ? today : today - DAY_MS;
  if (!daySet.has(cursor)) return 0;
  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Sets completed within the trailing 7-day window. */
function computeWeeklySets(sessions: WorkoutSession[]): number {
  const windowStart = startOfToday() - 6 * DAY_MS;
  return sessions.reduce((total, session) => {
    const started = new Date(session.startedAt).getTime();
    if (Number.isNaN(started) || started < windowStart) return total;
    return total + (session.totalSets ?? session.loggedSets?.length ?? 0);
  }, 0);
}

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigationProp>();
  const isFocused = useIsFocused();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadError(null);
    const [planResult, sessionsResult] = await Promise.allSettled([
      getCurrentPlan(),
      getRecentSessions(),
    ]);
    if (planResult.status === 'fulfilled') {
      setPlan(planResult.value.plan);
    }
    if (sessionsResult.status === 'fulfilled') {
      setSessions(sessionsResult.value.sessions ?? []);
    }
    if (planResult.status === 'rejected' && sessionsResult.status === 'rejected') {
      setLoadError('Could not sync your training data. Pull to retry.');
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchData().finally(() => setLoading(false));
    }
  }, [fetchData, isFocused]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const todayDay = plan?.days?.find((day) => day.dayIndex === plan.currentDayIndex) ?? plan?.days?.[0] ?? null;

  const weeklySets = useMemo(() => computeWeeklySets(sessions), [sessions]);
  const streakDays = useMemo(() => computeStreakDays(sessions), [sessions]);

  const recentSessions = sessions.slice(0, 5);

  const startWorkout = useCallback(() => {
    navigation.navigate('LiveSession', {
      plan,
      dayIndex: todayDay?.dayIndex,
      dayName: todayDay?.name,
    });
  }, [navigation, plan, todayDay]);

  return (
    <ScreenContainer scrollable onRefresh={handleRefresh} refreshing={refreshing}>
      <Header
        title="Dashboard"
        subtitle="Athlete readiness at a glance"
        rightAction={<Activity size={22} color={colors.accentCyan} />}
      />

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.accentVolt} />
        </Card>
      ) : (
        <>
          {/* -------------------------------------------------- Hero Card */}
          <Card elevated>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardLabel}>ACTIVE PLAN</Text>
                <Text style={styles.planTitle} numberOfLines={2}>
                  {plan?.title ?? 'No active plan'}
                </Text>
              </View>
              {plan?.split ? <Badge label={plan.split} variant="volt" /> : null}
            </View>

            <View style={styles.todayRow}>
              <Dumbbell size={16} color={colors.accentCyan} strokeWidth={2} />
              <Text style={styles.todayText}>
                {todayDay ? `Today: Day ${todayDay.dayIndex} — ${todayDay.name}` : 'Rest day — no session scheduled'}
              </Text>
            </View>

            {plan?.goal ? <Text style={styles.goalText}>{plan.goal}</Text> : null}

            <View style={styles.gapTop}>
              <Button label="Start Today's Workout" variant="volt" size="lg" fullWidth onPress={startWorkout} />
            </View>
          </Card>

          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

          {/* -------------------------------------------------- Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Footprints size={18} color={colors.accentCyan} strokeWidth={2} />
              <Text style={styles.statValue}>{weeklySets}</Text>
              <Text style={styles.statLabel}>Weekly Sets</Text>
            </View>
            <View style={styles.statCard}>
              <Flame size={18} color={colors.accentAmber} strokeWidth={2} />
              <Text style={styles.statValue}>{streakDays}</Text>
              <Text style={styles.statLabel}>Streak Days</Text>
            </View>
            <View style={styles.statCard}>
              <ShieldCheck size={18} color={colors.accentVolt} strokeWidth={2} />
              <Text style={styles.statValue}>{PLACEHOLDER_SAFEGUARDS}</Text>
              <Text style={styles.statLabel}>Safeguards</Text>
            </View>
          </View>

          {/* -------------------------------------------- Recent Sessions */}
          <Card style={styles.gapTop}>
            <Text style={styles.cardLabel}>RECENT SESSIONS</Text>
            {recentSessions.length === 0 ? (
              <Text style={styles.emptyText}>
                No sessions logged yet. Your history will appear here after your first workout.
              </Text>
            ) : (
              <View style={styles.gapSm}>
                {recentSessions.map((session) => (
                  <View key={session.id} style={styles.sessionRow}>
                    <View style={styles.flex}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>
                        {session.planDayName ?? 'Workout'}
                      </Text>
                      <Text style={styles.sessionDate}>{formatSessionDate(session.startedAt)}</Text>
                    </View>
                    <View style={styles.sessionStats}>
                      <Text style={styles.sessionStatValue}>
                        {session.totalSets ?? session.loggedSets?.length ?? 0} sets
                      </Text>
                      <Text style={styles.sessionStatLabel}>
                        {formatDuration(session.durationSeconds)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
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
  planTitle: {
    fontSize: fontSize.xxl,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  todayText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  goalText: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  gapTop: { marginTop: 16 },
  gapSm: { gap: 8 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: 14,
    alignItems: 'flex-start',
    gap: 6,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorText: {
    marginTop: 12,
    fontSize: fontSize.sm,
    color: colors.accentAmber,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  sessionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  sessionDate: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  sessionStatValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.accentCyan,
  },
  sessionStatLabel: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export { DashboardScreen };
