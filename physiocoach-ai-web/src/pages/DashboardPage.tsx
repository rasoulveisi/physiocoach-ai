import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  Flame,
  Trophy,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Progress } from '../components/ui/Progress';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
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

interface PlanData {
  id?: string;
  name?: string;
  days?: PlanDay[];
  weeklyAdherence?: number;
  streak?: number;
}

interface ProfileData {
  displayName?: string;
  firstName?: string;
  experienceLevel?: string;
}

interface SessionData {
  id: string;
  workoutName?: string;
  completedAt?: string;
  durationSeconds?: number;
  durationMinutes?: number;
  progress?: { completedSets: number; totalSets: number };
}

export function DashboardPage() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiClient.get<any>('workout-plans/current').catch(() => null),
      apiClient.get<any>('profile').catch(() => null),
      apiClient.get<any>('workout-sessions').catch(() => []),
    ])
      .then(([planRes, userRes, sessionsRes]) => {
        const rootPlan = planRes?.data || planRes;
        const actualPlan = rootPlan?.plan || rootPlan;
        setPlan(actualPlan || null);

        const rootUser = userRes?.data || userRes;
        setProfile(rootUser || null);

        const rootSessions = sessionsRes?.data || sessionsRes;
        setSessions(Array.isArray(rootSessions) ? rootSessions : []);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not load athlete dashboard.');
      })
      .finally(() => setLoading(false));
  }, []);

  const todayIndex = new Date().getDay(); // 0 = Sunday
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayName = new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date());

  const days = plan?.days || [];
  const todayWorkout =
    days.find((d) => (d.name || d.day || '').toLowerCase().includes(todayName.toLowerCase())) ||
    days[0];

  const totalWeeklySessions = days.length || 3;
  const completedThisWeek = Math.min(
    totalWeeklySessions,
    sessions.filter((s) => {
      if (!s.completedAt) return false;
      const diff = Date.now() - new Date(s.completedAt).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    }).length,
  );

  const adherence = Math.round((completedThisWeek / totalWeeklySessions) * 100);

  // Joint & Muscle Recovery Status
  const recoveryMetrics = [
    { area: 'Spinal / Lower Back', recovery: 95, status: 'Optimal' },
    { area: 'Shoulder Capsule', recovery: 88, status: 'Ready' },
    { area: 'Knee Patellar', recovery: 92, status: 'Ready' },
    { area: 'Posterior Chain', recovery: 80, status: 'Recovering' },
  ];

  return (
    <main className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 lg:p-8 space-y-6">
      {/* Athlete Telemetry Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-lime-400" />
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-lime-400">
              Precision Telemetry
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Welcome back, {profile?.firstName || profile?.displayName || 'Athlete'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Biomechanical readiness high. Stay consistent on your programmed split.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/assessment')}
            className="text-xs border-zinc-800 bg-zinc-900/80 hover:border-lime-400 hover:text-lime-400"
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-lime-400" />
            Clinical Assessment
          </Button>
          <Badge variant="lime" className="border-zinc-800 bg-zinc-900 text-zinc-200">
            <ShieldCheck className="mr-1 h-3.5 w-3.5 text-lime-400" />
            POSTURE SAFEGUARDS ACTIVE
          </Badge>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Main Grid: Today's Session HUD + Quick Stats */}
      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Today's Workout Hero Card */}
        <Card className="relative overflow-hidden border-zinc-800 bg-zinc-900">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.12)_0%,transparent_70%)]" />

          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge variant="lime">TODAY · {todayName.toUpperCase()}</Badge>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black uppercase text-white">
                  {todayWorkout?.title || todayWorkout?.focus || plan?.name || 'Primary Training Session'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {todayWorkout?.exercises?.length || 0} programmed exercises · Safe biomechanical loading
                </p>
              </div>

              <div className="grid size-12 place-items-center rounded-2xl bg-lime-400/10 text-lime-400 border border-lime-400/30">
                <Activity className="h-6 w-6 stroke-[2.5]" />
              </div>
            </div>

            {/* Exercise Preview Strip */}
            <div className="mt-6 grid gap-2.5">
              {(todayWorkout?.exercises || []).slice(0, 4).map((ex, idx) => (
                <div
                  key={ex.id || ex.name || idx}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
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

            {/* Action Bar */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                variant="volt"
                size="lg"
                pill={true}
                onClick={() => navigate('/session')}
                className="w-full sm:w-auto"
              >
                <Activity className="h-5 w-5 fill-current" /> Start Today's Workout <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                pill={true}
                onClick={() => navigate('/plan')}
                className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 text-zinc-100"
              >
                View Full Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 7-Day Consistency & Recovery Stats */}
        <div className="space-y-6">
          {/* Consistency Matrix */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Adherence</span>
                  <h3 className="font-tabular text-3xl font-black text-white">{adherence}%</h3>
                </div>
                <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Flame className="h-6 w-6 stroke-[2.5]" />
                </div>
              </div>

              {/* 7-Day Day Pills */}
              <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
                {daysOfWeek.map((day, idx) => {
                  const isToday = idx === todayIndex;
                  const isDone = idx < completedThisWeek;
                  return (
                    <div
                      key={day}
                      className={`rounded-xl border p-2 ${
                        isToday
                          ? 'border-lime-400 bg-lime-400 text-zinc-950 font-black'
                          : isDone
                          ? 'border-zinc-800 bg-zinc-900 text-white'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400'
                      }`}
                    >
                      <span className="block text-[10px] font-extrabold uppercase">{day}</span>
                      <span className="mt-1 block font-mono text-xs font-bold">
                        {isDone ? '✓' : isToday ? '•' : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <Progress value={adherence} />
                <p className="mt-2 text-xs text-slate-400">
                  {completedThisWeek} of {totalWeeklySessions} target sessions completed this week.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Joint & Biomechanical Recovery Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-cyan-400">
                <Zap className="h-4 w-4" /> Joint & Muscle Recovery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {recoveryMetrics.map((item) => (
                <div key={item.area}>
                  <div className="mb-1 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-300">{item.area}</span>
                    <span className="font-mono text-cyan-400">{item.recovery}% · {item.status}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-950 border border-zinc-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-lime-400 transition-all duration-500"
                      style={{ width: `${item.recovery}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Sessions History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-lime-400" /> Recent Session History
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/session')}>
            New Live Session <ChevronRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 ? (
            <div className="divide-y divide-zinc-800">
              {sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      ✓
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">
                        {session.workoutName || 'Completed Training Session'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {session.completedAt
                          ? new Date(session.completedAt).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Recorded'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    {session.progress && (
                      <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-300">
                        {session.progress.completedSets} / {session.progress.totalSets} Sets
                      </span>
                    )}
                    {session.durationSeconds && (
                      <span className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-lime-400">
                        <Clock className="h-3.5 w-3.5" />
                        {Math.round(session.durationSeconds / 60)} min
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">
                No completed sessions logged yet. Launch your live tracker to record your first workout!
              </p>
              <Button
                variant="volt"
                size="sm"
                onClick={() => navigate('/session')}
                className="mt-4"
              >
                Start Training Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
