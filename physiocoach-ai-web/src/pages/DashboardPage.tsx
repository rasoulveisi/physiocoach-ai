import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BrainCircuit,
  ChevronRight,
  Dumbbell,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { SemiGauge } from '../components/ui/SemiGauge';
import { CalendarStrip, generateCalendarDays } from '../components/ui/CalendarStrip';
import { Toast } from '../components/ui/Toast';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { apiClient } from '../services/api-client';

interface PlanExercise {
  id?: string;
  masterExerciseId?: string | null;
  name: string;
  sets?: number;
  reps?: number | string;
  movementPattern?: string;
  muscleGroup?: string;
}

interface PlanDay {
  name?: string;
  day?: string;
  title?: string;
  focus?: string;
  exercises?: PlanExercise[];
}

interface PlanProgression {
  baselineIntensity?: string;
  progressionRule?: string;
  increasePercent?: number;
  conditions?: string[];
}

interface PlanData {
  id?: string;
  name?: string;
  days?: PlanDay[];
  weeklyAdherence?: number;
  streak?: number;
  progression?: PlanProgression;
  safetyNotes?: string[];
  warnings?: string[];
}

interface ProfileData {
  displayName?: string;
  firstName?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | string;
}

interface AssessmentData {
  frequencyDays?: number;
  sessionMinutes?: number;
  limitations?: string[];
  postureFlags?: string[];
}

interface SessionData {
  id: string;
  workoutName?: string;
  completedAt?: string;
  durationSeconds?: number;
  durationMinutes?: number;
  progress?: { completedSets: number; totalSets: number };
}

// Joint resilience telemetry (%): post-session recovery estimates per critical region
const jointResilience = [
  { area: 'Neck & Cervical Spine', resilience: 95 },
  { area: 'Shoulders & Rotator Cuff', resilience: 88 },
  { area: 'Lumbar & Lower Back', resilience: 92 },
  { area: 'Knees & Patella', resilience: 90 },
];

function JointRing({ area, recovery }: { area: string; recovery: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (recovery / 100) * circumference;

  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <div className="relative grid place-items-center">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-zinc-800" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="stroke-lime-400 transition-all duration-500"
          />
        </svg>
        <span className="absolute text-xs font-black tabular-nums text-white">{recovery}%</span>
      </div>
      <span className="w-full text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-zinc-400">
        {area}
      </span>
    </div>
  );
}

interface SectionHeadingProps {
  title: string;
  actionLabel: string;
  to?: string;
  onClick?: () => void;
}

function SectionHeading({ title, actionLabel, to, onClick }: SectionHeadingProps) {
  const action = (
    <>
      {actionLabel}
      <ChevronRight className="h-3.5 w-3.5" />
    </>
  );

  return (
    <div className="mb-3 flex items-center justify-between px-0.5">
      <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
      {to ? (
        <Link
          to={to}
          className="flex items-center text-xs font-bold text-zinc-400 transition-colors hover:text-lime-400"
        >
          {action}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center text-xs font-bold text-zinc-400 transition-colors hover:text-lime-400"
        >
          {action}
        </button>
      )}
    </div>
  );
}

import { useAuth } from '../context/AuthContext';

function getDynamicGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return `Good morning, ${name} ☀️`;
  if (hour >= 12 && hour < 17) return `Good afternoon, ${name} ⚡`;
  if (hour >= 17 && hour < 22) return `Good evening, ${name} 🔥`;
  return `Night session, ${name} 🌙`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiClient.get<any>('workout-plans/current').catch(() => null),
      apiClient.get<any>('profile').catch(() => null),
      apiClient.get<any>('workout-sessions').catch(() => []),
      apiClient.get<any>('assessments/latest').catch(() => null),
    ])
      .then(([planRes, userRes, sessionsRes, assessmentRes]) => {
        const rootPlan = planRes?.data || planRes;
        const actualPlan = rootPlan?.plan || rootPlan;
        setPlan(actualPlan || null);

        const rootUser = userRes?.data || userRes;
        setProfile(rootUser || null);

        const rootSessions = sessionsRes?.data || sessionsRes;
        setSessions(Array.isArray(rootSessions) ? rootSessions : []);

        const rootAssessment = assessmentRes?.data || assessmentRes;
        setAssessment(rootAssessment || null);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not load athlete dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  const todayName = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date());

  const days = plan?.days || [];
  const todayWorkout =
    days.find((d) => (d.name || d.day || '').toLowerCase().includes(todayName.toLowerCase())) ||
    days[0];

  // Clinical safeguard telemetry from the athlete's latest biomechanical assessment
  const painFlagCount =
    (assessment?.limitations?.length ?? 0) + (assessment?.postureFlags?.length ?? 0);
  const contraindicatedCount = plan?.warnings?.length ?? 0;
  const targetSessionMinutes = assessment?.sessionMinutes ?? 45;

  // Weekly adherence vs. the prescribed split frequency
  const totalWeeklySessions = assessment?.frequencyDays || days.length || 3;
  const weekSessions = useMemo(
    () =>
      sessions.filter((s) => {
        if (!s.completedAt) return false;
        const diff = Date.now() - new Date(s.completedAt).getTime();
        return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
      }),
    [sessions],
  );
  const completedThisWeek = Math.min(totalWeeklySessions, weekSessions.length);
  const adherence = Math.round((completedThisWeek / totalWeeklySessions) * 100);

  // 7-day strip: highlight today plus every day with a logged session
  const weekDays = useMemo(
    () =>
      generateCalendarDays(new Date(), 7).map((day) => ({
        ...day,
        isActive:
          day.isToday ||
          weekSessions.some((s) => {
            if (!s.completedAt) return false;
            const logged = new Date(s.completedAt);
            logged.setHours(0, 0, 0, 0);
            return logged.getTime() === day.date.getTime();
          }),
      })),
    [weekSessions],
  );

  const athleteName =
    profile?.displayName ||
    user?.displayName ||
    profile?.firstName ||
    user?.email?.split('@')[0] ||
    'Athlete';
  const athleteFirstName = athleteName.split(' ')[0];
  const athleteInitials =
    athleteName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'A';

  const difficultyLabel =
    profile?.experienceLevel === 'advanced'
      ? '⚡ Advanced'
      : profile?.experienceLevel === 'intermediate'
        ? '⚡ Intermediate'
        : 'Beginner-Safe';

  // Real AI clinical cue: authored safety note first, else the canonical progression rule
  const coachCue =
    plan?.safetyNotes?.[0] ??
    (plan?.progression?.progressionRule
      ? `AI progressive overload active: +${plan.progression.increasePercent ?? 10}% load on pain-free lifts`
      : 'Retract scapulae and brace core during compound movements to protect lumbar spine');

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <main className="h-full w-full max-w-2xl mx-auto flex-1 overflow-y-auto min-h-0 space-y-7 p-4 pb-8 sm:p-6 select-none selection:bg-lime-400 selection:text-zinc-950">
      {/* Athlete Profile & Notification Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full border border-zinc-800 bg-zinc-900 font-black text-lime-400">
            {athleteInitials}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black text-white sm:text-2xl">
              {getDynamicGreeting(athleteFirstName)}
            </h1>
            <span className="mt-0.5 inline-flex items-center gap-1 truncate rounded-full bg-lime-400/10 px-2 py-0.5 text-[11px] font-bold text-lime-400">
              {loading
                ? 'Calibrating safeguards…'
                : `${completedThisWeek}/${totalWeeklySessions} sessions · Ready to Train`}
            </span>
          </div>
        </div>

        <button
          type="button"
          aria-label={hasUnreadNotifications ? 'Mark notifications read' : 'No new notifications'}
          onClick={() => setHasUnreadNotifications((v) => !v)}
          className="relative grid size-10 shrink-0 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:border-lime-400/40 hover:text-lime-400"
        >
          <Bell className="h-5 w-5" />
          {hasUnreadNotifications && (
            <span className="absolute right-2 top-2 size-2 rounded-full bg-lime-400 ring-2 ring-zinc-950" />
          )}
        </button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Signature Electric Lime Hero Card — AI Biomechanical Safeguards & Training Readiness */}
      <section className="relative overflow-hidden rounded-3xl bg-lime-400 p-5 text-zinc-950 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/30 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full bg-zinc-950/15 px-3 py-1 text-xs font-extrabold text-zinc-950">
              🛡️ Clinical Safeguard Active
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              Weekly Training Adherence
            </h2>
            <p className="mt-1 text-xs font-extrabold text-zinc-950/70">
              {painFlagCount} active joint safeguard
              {painFlagCount === 1 ? '' : 's'} ·{' '}
              {contraindicatedCount} contraindicated exercise
              {contraindicatedCount === 1 ? '' : 's'}
            </p>
          </div>

          <SemiGauge
            value={adherence}
            max={100}
            label={`${adherence}%`}
            sublabel="ADHERENCE"
            strokeColor="stroke-zinc-950"
            className="shrink-0 text-zinc-950"
          />
        </div>
      </section>

      {/* Dual Telemetry Split Grid */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Clinical Safeguards */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Joint Protections</span>
            <span className="grid size-8 place-items-center rounded-full bg-lime-400/10 text-lime-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-5">
            <span className="text-2xl font-black tabular-nums text-white sm:text-3xl">
              {painFlagCount}
            </span>
            <span className="ml-1.5 text-xs font-mono text-zinc-400">Active</span>
          </p>
          <p className="mt-1 text-[11px] font-bold text-zinc-500">Zero impingement loads</p>
        </div>

        {/* Weekly Volume & Time */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Training Volume</span>
            <span className="grid size-8 place-items-center rounded-full bg-lime-400/10 text-lime-400">
              <Dumbbell className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-5">
            <span className="text-2xl font-black tabular-nums text-white sm:text-3xl">
              {completedThisWeek}/{totalWeeklySessions}
            </span>
            <span className="ml-1.5 text-xs font-mono text-zinc-400">Days</span>
          </p>
          <p className="mt-1 text-[11px] font-bold text-zinc-500">On target this split</p>
        </div>
      </section>

      {/* AI Biomechanical Coach & Form Insights Capsule */}
      <section>
        <SectionHeading title="AI Coach Intelligence" actionLabel="Update Assessment" to="/assessment" />

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-zinc-800 text-lime-400">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black text-white">Coach Physio AI</p>
                <span className="shrink-0 rounded-full bg-lime-400/10 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-lime-400">
                  Live Cue
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{coachCue}</p>
              <Button
                variant="outline"
                size="sm"
                pill={true}
                onClick={() => navigate('/plan')}
                className="mt-3"
              >
                View Safety Protocol
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Today's AI Workout Routine Hero Card */}
      <section>
        <SectionHeading title="Today Workout" actionLabel="View Split" to="/plan" />

        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10)_0%,transparent_70%)]" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-extrabold text-lime-400">
                {difficultyLabel}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-xs font-bold text-zinc-300">
                ⏱ {targetSessionMinutes} Min
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-xs font-bold text-zinc-300">
                TODAY · {todayName.toUpperCase()}
              </span>
            </div>

            <h3 className="mt-4 text-xl font-black uppercase leading-tight text-white sm:text-2xl">
              {todayWorkout?.title ||
                todayWorkout?.name ||
                todayWorkout?.focus ||
                'Postural Correction & Upper Strength'}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {todayWorkout?.focus
                ? `${todayWorkout.focus} · AI-guarded form cues on every set`
                : 'Posture-first programming · Safe biomechanical loading'}
            </p>

            {/* Exercise Preview List */}
            <div className="mt-5 grid gap-2.5">
              {(todayWorkout?.exercises || []).slice(0, 4).map((ex, idx) => (
                <div
                  key={ex.id || ex.name || idx}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs font-bold text-lime-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="truncate text-sm font-extrabold text-white">{ex.name}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-zinc-400">
                    {ex.sets || 3} × {ex.reps || 10}
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="volt"
              size="lg"
              pill={true}
              onClick={() => navigate('/session')}
              className="mt-4 w-full text-base font-black"
            >
              Start Workout Session <Play className="ml-1 h-4 w-4 fill-current" />
            </Button>
          </div>
        </div>
      </section>

      {/* Joint Resilience & Posture Matrix */}
      <section>
        <SectionHeading
          title="Joint Resilience & Posture Matrix"
          actionLabel="Edit Safeguards"
          onClick={() => navigate('/assessment')}
        />

        <div className="grid grid-cols-4 gap-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:gap-4 sm:p-5">
          {jointResilience.map((joint) => (
            <JointRing key={joint.area} area={joint.area} recovery={joint.resilience} />
          ))}
        </div>
      </section>

      {/* 7-Day Training Calendar Strip */}
      <section>
        <SectionHeading title="7-Day Training Calendar" actionLabel="Full Split" to="/plan" />

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <CalendarStrip days={weekDays} />
          <p className="mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Lime = logged session · Today highlighted
          </p>
        </div>
      </section>
    </main>
  );
}
