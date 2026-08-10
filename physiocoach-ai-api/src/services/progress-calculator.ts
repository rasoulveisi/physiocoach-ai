import {
  bodyMeasurementInputSchema,
  type BodyMeasurementInput,
  type ProgressDb,
  type ProgressSummary,
  progressSummarySchema,
  type SessionLogRow,
} from '../types/progress';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export { bodyMeasurementInputSchema, type BodyMeasurementInput, type ProgressDb };

export { progressSummarySchema };

export function getFallbackProgressSummary(): ProgressSummary {
  return { ...DEFAULT_SETTINGS_SUMMARY };
}

export function getWeekBoundsUTC(reference = new Date()): { start: string; end: string } {
  const now = new Date(reference.getTime());
  const utcDay = now.getUTCDay();
  const utcShiftToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const weekStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + utcShiftToMonday,
      0,
      0,
      0,
      0,
    ),
  );

  return {
    start: weekStart.toISOString(),
    end: now.toISOString(),
  };
}

export function toDateDay(value: string): string {
  if (value.length >= 10) {
    return value.slice(0, 10);
  }
  return value;
}

export function isDateInRange(value: string, start: string, end: string): boolean {
  const normalized = toUtcDateTime(value);
  return normalized >= start && normalized <= end;
}

export function calculateStreak(completedSessionDates: string[]): number {
  if (completedSessionDates.length === 0) {
    return 0;
  }

  const dateSet = new Set(completedSessionDates.map((value) => toDateDay(value)));
  const days = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  const latest = days[0];
  if (!latest) return 0;

  const baseDate = new Date(`${latest}T00:00:00.000Z`);
  if (Number.isNaN(baseDate.getTime())) return 1;

  let streak = 0;
  for (let offset = 0; ; offset += 1) {
    const cursor = new Date(baseDate.getTime() - offset * MS_PER_DAY).toISOString().slice(0, 10);
    if (!dateSet.has(cursor)) {
      return streak;
    }
    streak += 1;
  }
}

export function calculateWeeklyCompliance(
  logs: SessionLogRow[],
  weekBounds: { start: string; end: string },
) {
  const weeklyLogs = logs.filter((log) =>
    isDateInRange(
      log.sessionCompletedAt ?? log.sessionScheduledDate,
      weekBounds.start,
      weekBounds.end,
    ),
  );

  const relevantLogs = weeklyLogs.filter((log) => log.weight > 0 && log.reps > 0);
  if (relevantLogs.length === 0) {
    return 0;
  }

  const completedLogs = relevantLogs.filter((log) => log.completed === 1).length;
  return Math.round((completedLogs / relevantLogs.length) * 100);
}

export function detectPlateau(
  logs: SessionLogRow[],
  bounds: { start: string; end: string },
  workoutsCompletedThisWeek: number,
  personalRecords: number,
) {
  const weeklyLogs = logs.filter((log) =>
    isDateInRange(log.sessionCompletedAt ?? log.sessionScheduledDate, bounds.start, bounds.end),
  );

  if (weeklyLogs.length < 3) {
    return false;
  }

  return workoutsCompletedThisWeek >= 2 && personalRecords === 0;
}

export function computePersonalRecords(
  logs: SessionLogRow[],
  weekBounds: { start: string; end: string },
): number {
  const beforeWeekMax = new Map<string, number>();
  const weekMax = new Map<string, number>();

  for (const log of logs) {
    if (log.completed !== 1 || log.weight <= 0 || log.reps <= 0) continue;
    const isInCurrentWeek = isDateInRange(
      log.sessionCompletedAt ?? log.sessionScheduledDate,
      weekBounds.start,
      weekBounds.end,
    );

    const bucket = isInCurrentWeek ? weekMax : beforeWeekMax;
    const existing = bucket.get(log.exerciseName) ?? 0;
    if (log.weight > existing) {
      bucket.set(log.exerciseName, log.weight);
    }
  }

  let total = 0;
  for (const [exercise, weeklyBest] of weekMax.entries()) {
    const priorBest = beforeWeekMax.get(exercise) ?? 0;
    if (weeklyBest > priorBest) {
      total += 1;
    }
  }

  return total;
}

export function calculateVolumeThisWeek(
  logs: SessionLogRow[],
  weekBounds: { start: string; end: string },
): number {
  return logs.reduce((acc, log) => {
    const sessionCompletedDate = log.sessionCompletedAt ?? log.sessionScheduledDate;
    if (
      log.completed !== 1 ||
      log.weight <= 0 ||
      log.reps <= 0 ||
      !isDateInRange(sessionCompletedDate, weekBounds.start, weekBounds.end)
    ) {
      return acc;
    }
    return acc + log.weight * log.reps;
  }, 0);
}

export async function getProgressSummary(
  dbClient: ProgressDb,
  userId: string,
  referenceDate = new Date(),
): Promise<ProgressSummary> {
  const bounds = getWeekBoundsUTC(referenceDate);

  const [sessionsThisWeek, allSessions] = await Promise.all([
    dbClient.findCompletedSessionsForUserInRange(userId, bounds.start, bounds.end),
    dbClient.findCompletedSessionsForUser(userId),
  ]);

  const completedSessions = allSessions
    .map((row) => row.completedAt)
    .filter((value): value is string => !!value);
  const streakDays = calculateStreak(completedSessions);
  const sessionIds = allSessions.map((row) => row.id);
  const sessionLogs = await dbClient.findExerciseLogsForSessionIds(sessionIds);

  const personalRecords = computePersonalRecords(sessionLogs, bounds);
  const totalVolumeThisWeek = calculateVolumeThisWeek(sessionLogs, bounds);
  const complianceScore = calculateWeeklyCompliance(sessionLogs, bounds);
  const plateauDetected = detectPlateau(
    sessionLogs,
    bounds,
    sessionsThisWeek.length,
    personalRecords,
  );

  const warnings =
    sessionsThisWeek.length === 0
      ? allSessions.length === 0
        ? DEFAULT_SETTINGS_SUMMARY.warnings
        : ['No completed sessions this week.']
      : [];

  const summary: ProgressSummary = {
    workoutsCompletedThisWeek: sessionsThisWeek.length,
    streakDays,
    personalRecords,
    totalVolumeThisWeek,
    plateauDetected,
    complianceScore,
    warnings,
  };

  return progressSummarySchema.parse(summary);
}

function toUtcDateTime(value: string): string {
  return value.length >= 20 ? value : `${value}T00:00:00.000Z`;
}

const DEFAULT_SETTINGS_SUMMARY: ProgressSummary = {
  workoutsCompletedThisWeek: 0,
  streakDays: 0,
  personalRecords: 0,
  totalVolumeThisWeek: 0,
  plateauDetected: false,
  complianceScore: 0,
  warnings: ['No completed sessions yet. Start your first workout session to see progress.'],
};
