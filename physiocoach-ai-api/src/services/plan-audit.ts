/**
 * Deterministic Clinical Safety Audit Engine
 *
 * Performs rule-based biomechanical checks on a workout plan JSON.
 * No AI/LLM calls — all logic is deterministic and monotonic.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type AuditSeverity = 'ok' | 'warning' | 'critical';

export type AuditBadge =
  | 'PhysioCoach Certified Safe'
  | 'Needs Adjustment'
  | 'Medical Review Required';

export interface AuditCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: AuditSeverity;
  message: string;
  fixSuggestion?: string;
}

export interface AuditResult {
  auditLogId: string;
  traceId: string;
  certified: boolean;
  score: number;
  badge: AuditBadge;
  checks: AuditCheck[];
}

// ─── Internal plan shape (loose — we don't require strict schema) ───────────

interface PlanExercise {
  name?: string;
  movementPattern?: string;
  muscleGroup?: string;
  sets?: number | unknown[];
}

interface PlanDay {
  exercises?: PlanExercise[];
}

interface PlanJson {
  days?: PlanDay[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const SPINAL_LOAD_PATTERNS = new Set(['hinge', 'squat', 'horizontal_push']);

const HIGH_SHEAR_KEYWORDS = [
  'leg press',
  'hack squat',
  'upright row',
  'behind neck',
  'behind-neck',
  'behind the neck',
  'smith machine squat',
  'sissy squat',
];

const MAJOR_COMPOUND_MUSCLES = new Set(['chest', 'back', 'quads', 'hamstrings']);

const MRV_PER_WEEK = 25; // Maximum Recoverable Volume
const MEV_COMPOUND = 6; // Minimum Effective Volume for major compound muscles

// ─── Helpers ───────────────────────────────────────────────────────────────

function countSets(exercise: PlanExercise): number {
  if (typeof exercise.sets === 'number') return exercise.sets;
  if (Array.isArray(exercise.sets)) return exercise.sets.length;
  return 1;
}

function normPattern(p: string | undefined): string {
  return (p || '').toLowerCase().trim();
}

function normMuscle(m: string | undefined): string {
  return (m || '').toLowerCase().replace(/[_\s]+/g, '_').trim();
}

function normName(n: string | undefined): string {
  return (n || '').toLowerCase();
}

// ─── Individual Checks ────────────────────────────────────────────────────

function checkPushPullBalance(days: PlanDay[]): AuditCheck {
  let pushSets = 0;
  let pullSets = 0;

  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      const pattern = normPattern(ex.movementPattern);
      const sets = countSets(ex);
      if (pattern === 'push' || pattern === 'horizontal_push' || pattern === 'vertical_push') {
        pushSets += sets;
      } else if (pattern === 'pull' || pattern === 'horizontal_pull' || pattern === 'vertical_pull') {
        pullSets += sets;
      }
    }
  }

  if (pushSets === 0 && pullSets === 0) {
    return {
      id: 'push_pull_balance',
      name: 'Push:Pull Balance',
      passed: true,
      severity: 'ok',
      message: 'No push or pull exercises detected — balance check skipped.',
    };
  }

  // Allow pull to dominate slightly (rehab-friendly); flag if ratio is outside 1:0.8 – 1:1.5
  const ratio = pullSets / Math.max(pushSets, 1);
  const inRange = ratio >= 0.8 && ratio <= 1.5;

  if (inRange) {
    return {
      id: 'push_pull_balance',
      name: 'Push:Pull Balance',
      passed: true,
      severity: 'ok',
      message: `Push:Pull ratio ${pushSets}:${pullSets} is within safe range (0.8–1.5).`,
    };
  }

  const severity: AuditSeverity = ratio < 0.5 || ratio > 2.5 ? 'critical' : 'warning';
  return {
    id: 'push_pull_balance',
    name: 'Push:Pull Balance',
    passed: false,
    severity,
    message: `Push:Pull ratio is ${pushSets}:${pullSets} (ratio ${ratio.toFixed(2)}). Target range: 1:0.8 to 1:1.5.`,
    fixSuggestion:
      pullSets < pushSets
        ? 'Add more pulling movements (rows, pull-ups, face pulls) to match push volume.'
        : 'Reduce pull volume or add more pressing exercises to restore balance.',
  };
}

function checkWeeklyVolume(days: PlanDay[]): AuditCheck {
  const muscleSetCount: Record<string, number> = {};

  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      const muscle = normMuscle(ex.muscleGroup);
      const sets = countSets(ex);
      if (muscle) {
        muscleSetCount[muscle] = (muscleSetCount[muscle] ?? 0) + sets;
      }
    }
  }

  const mrvViolations: string[] = [];
  const mevViolations: string[] = [];

  for (const [muscle, sets] of Object.entries(muscleSetCount)) {
    if (sets > MRV_PER_WEEK) {
      mrvViolations.push(`${muscle} (${sets} sets > ${MRV_PER_WEEK} MRV)`);
    }
  }

  for (const compoundMuscle of MAJOR_COMPOUND_MUSCLES) {
    const sets = muscleSetCount[compoundMuscle] ?? 0;
    if (sets > 0 && sets < MEV_COMPOUND) {
      mevViolations.push(`${compoundMuscle} (${sets} sets < ${MEV_COMPOUND} MEV)`);
    }
  }

  if (mrvViolations.length === 0 && mevViolations.length === 0) {
    return {
      id: 'weekly_volume',
      name: 'Weekly Volume per Muscle Group',
      passed: true,
      severity: 'ok',
      message: 'Weekly volume is within safe MRV and MEV thresholds for all muscle groups.',
    };
  }

  const parts: string[] = [];
  if (mrvViolations.length > 0) {
    parts.push(`MRV exceeded: ${mrvViolations.join(', ')}`);
  }
  if (mevViolations.length > 0) {
    parts.push(`Below MEV: ${mevViolations.join(', ')}`);
  }

  const severity: AuditSeverity = mrvViolations.length > 0 ? 'warning' : 'warning';

  const fixes: string[] = [];
  if (mrvViolations.length > 0) {
    fixes.push('Reduce total weekly sets for flagged muscles to stay below 25 sets/week.');
  }
  if (mevViolations.length > 0) {
    fixes.push(
      `Add at least ${MEV_COMPOUND} sets/week for each major compound muscle group.`,
    );
  }

  return {
    id: 'weekly_volume',
    name: 'Weekly Volume per Muscle Group',
    passed: false,
    severity,
    message: parts.join(' | '),
    fixSuggestion: fixes.join(' '),
  };
}

function checkSpinalLoad(days: PlanDay[]): AuditCheck {
  let spinalLoadExercises = 0;
  const flagged: string[] = [];

  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      const pattern = normPattern(ex.movementPattern);
      if (SPINAL_LOAD_PATTERNS.has(pattern)) {
        spinalLoadExercises++;
        if (ex.name) flagged.push(ex.name);
      }
    }
  }

  const limit = 15;
  if (spinalLoadExercises <= limit) {
    return {
      id: 'spinal_load',
      name: 'Spinal Load Management',
      passed: true,
      severity: 'ok',
      message: `Spinal-loading exercises: ${spinalLoadExercises}/${limit} — within safe threshold.`,
    };
  }

  return {
    id: 'spinal_load',
    name: 'Spinal Load Management',
    passed: false,
    severity: 'warning',
    message: `${spinalLoadExercises} spinal-loading exercises detected this week (limit: ${limit}). Exercises: ${flagged.slice(0, 5).join(', ')}${flagged.length > 5 ? '…' : ''}.`,
    fixSuggestion:
      'Reduce hinge, squat, and heavy press frequency. Substitute some sessions with machine or unilateral alternatives to reduce axial spinal compression.',
  };
}

function checkJointShearRisk(days: PlanDay[]): AuditCheck {
  const flaggedExercises: { name: string; keyword: string }[] = [];

  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      const exName = normName(ex.name);
      for (const keyword of HIGH_SHEAR_KEYWORDS) {
        if (exName.includes(keyword)) {
          flaggedExercises.push({ name: ex.name ?? keyword, keyword });
          break;
        }
      }
    }
  }

  if (flaggedExercises.length === 0) {
    return {
      id: 'joint_shear_risk',
      name: 'Joint Shear Risk Assessment',
      passed: true,
      severity: 'ok',
      message: 'No high-shear risk exercises detected.',
    };
  }

  const names = [...new Set(flaggedExercises.map((f) => f.name))];
  const guidance = names.map((name) => {
    const lower = name.toLowerCase();
    if (lower.includes('leg press'))
      return `"${name}" — limit range of motion to 90° knee flexion; avoid deep leg press.`;
    if (lower.includes('hack squat'))
      return `"${name}" — high patellofemoral shear; replace with belt squat or goblet squat.`;
    if (lower.includes('upright row'))
      return `"${name}" — subacromial impingement risk; replace with face pull or high cable row.`;
    if (lower.includes('behind neck') || lower.includes('behind-neck'))
      return `"${name}" — cervical spine risk; replace with front-of-neck pulldown or overhead press.`;
    return `"${name}" — high joint shear risk; consult physiotherapist before performing.`;
  });

  return {
    id: 'joint_shear_risk',
    name: 'Joint Shear Risk Assessment',
    passed: false,
    severity: 'critical',
    message: `${flaggedExercises.length} high-shear risk exercise(s) detected: ${names.join(', ')}.`,
    fixSuggestion: guidance.join(' '),
  };
}

// ─── Scoring ───────────────────────────────────────────────────────────────

function computeScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 100;

  const weights = { ok: 0, warning: 15, critical: 35 };
  let deductions = 0;

  for (const check of checks) {
    if (!check.passed) {
      deductions += weights[check.severity] ?? 10;
    }
  }

  return Math.max(0, Math.min(100, 100 - deductions));
}

function computeBadge(score: number, checks: AuditCheck[]): AuditBadge {
  const hasCritical = checks.some((c) => !c.passed && c.severity === 'critical');
  if (hasCritical || score < 50) return 'Medical Review Required';
  if (score < 80) return 'Needs Adjustment';
  return 'PhysioCoach Certified Safe';
}

// ─── Main Audit Function ───────────────────────────────────────────────────

export function runPlanAudit(
  planJson: PlanJson,
  auditLogId: string,
  traceId: string,
): AuditResult {
  const days: PlanDay[] = Array.isArray(planJson.days) ? planJson.days : [];

  const checks: AuditCheck[] = [
    checkPushPullBalance(days),
    checkWeeklyVolume(days),
    checkSpinalLoad(days),
    checkJointShearRisk(days),
  ];

  const score = computeScore(checks);
  const badge = computeBadge(score, checks);
  const certified = badge === 'PhysioCoach Certified Safe';

  return {
    auditLogId,
    traceId,
    certified,
    score,
    badge,
    checks,
  };
}
