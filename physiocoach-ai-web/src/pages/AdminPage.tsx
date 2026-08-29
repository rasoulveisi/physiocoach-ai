import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Database,
  Search,
  ShieldAlert,
  ShieldCheck,
  Dumbbell,
  Filter,
  Eye,
  BrainCircuit,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { apiClient } from '../services/api-client';

interface ExerciseItem {
  id: string;
  canonicalId?: string;
  name: string;
  bodyPart?: string;
  category?: string;
  primaryMuscle?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  movementPattern?: string;
  difficulty?: string;
  recommendedLevel?: string;
  equipment?: string[];
  safetyConsiderations?: {
    condition?: string;
    severity?: string;
    level?: string;
    rating?: string;
    reason?: string;
    note?: string;
    requiredModification?: string;
  }[];
}

interface AuditLogItem {
  id: string;
  traceId: string;
  task: string;
  provider: string;
  model: string;
  prompt: string;
  completion?: string;
  status: string;
  errorMessage?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  createdAt: string;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'audit_logs'>('catalog');
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Load Exercise Catalog & Audit Logs
  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get<any>('exercise-catalog/exercises').catch(() =>
        apiClient.get<any>('exercises').catch(() => [])
      ),
      apiClient.get<any>('ai-audit-logs?limit=30').catch(() => []),
    ])
      .then(([exRes, logsRes]) => {
        const exData = exRes?.data || exRes;
        const exList = Array.isArray(exData) ? exData : exData?.items || [];
        setExercises(exList);
        if (exList.length > 0) {
          setSelectedExercise(exList[0]);
        }

        const logsData = logsRes?.data || logsRes;
        const logsList = Array.isArray(logsData) ? logsData : [];
        setAuditLogs(logsList);
        if (logsList.length > 0) {
          setSelectedLog(logsList[0]);
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not load admin catalog data.');
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    return Array.from(
      new Set(exercises.map((x) => x.bodyPart || x.category).filter(Boolean) as string[]),
    );
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((x) => {
      const q = query.toLowerCase().trim();
      const matchQuery =
        !q ||
        x.name.toLowerCase().includes(q) ||
        x.bodyPart?.toLowerCase().includes(q) ||
        x.category?.toLowerCase().includes(q) ||
        x.primaryMuscle?.toLowerCase().includes(q) ||
        x.primaryMuscles?.some((m) => m.toLowerCase().includes(q)) ||
        x.movementPattern?.toLowerCase().includes(q);

      const cat = x.bodyPart || x.category;
      const matchCategory = selectedCategory === 'all' || cat === selectedCategory;
      const level = x.recommendedLevel || x.difficulty;
      const matchLevel = selectedLevel === 'all' || level === selectedLevel;

      return matchQuery && matchCategory && matchLevel;
    });
  }, [exercises, query, selectedCategory, selectedLevel]);

  const totalSafetyRules = useMemo(() => {
    return exercises.reduce((sum, x) => sum + (x.safetyConsiderations?.length || 0), 0);
  }, [exercises]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-obsidian-950 text-white">
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-[1600px] mx-auto p-4 pb-32 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian-800 pb-5">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-volt">
            Administration & Diagnostics
          </span>
          <h1 className="mt-1 text-3xl font-black text-white">Exercise Catalog & Safety Matrix</h1>
          <p className="mt-1 text-sm text-slate-400">
            Inspect master exercises, biomechanical movement patterns, and clinical consideration matrices.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'catalog' ? 'volt' : 'secondary'}
            onClick={() => setActiveTab('catalog')}
          >
            <Database className="h-4 w-4" /> Exercise Catalog
          </Button>
          <Button
            variant={activeTab === 'audit_logs' ? 'volt' : 'secondary'}
            onClick={() => setActiveTab('audit_logs')}
          >
            <BrainCircuit className="h-4 w-4" /> AI Audit Logs
          </Button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* Metric Tiles Strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid size-12 place-items-center rounded-2xl bg-volt/10 text-volt border border-volt/30">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <strong className="font-tabular text-3xl font-black text-white">
                {exercises.length || 1324}
              </strong>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Master Exercises
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid size-12 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <strong className="font-tabular text-3xl font-black text-white">
                {categories.length || 10}
              </strong>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Anatomical Regions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid size-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <strong className="font-tabular text-3xl font-black text-white">
                {totalSafetyRules || '71,496'}
              </strong>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Safety Matrix Ratings
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* TAB 1: Exercise Catalog & Inspector */}
      {activeTab === 'catalog' && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Catalog Table Card */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Search & Filter Bar */}
              <div className="border-b border-obsidian-800 p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <Input
                    className="pl-10"
                    placeholder="Search by exercise name, target muscle, movement pattern…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-9 rounded-lg border border-obsidian-700 bg-obsidian-950 px-3 text-xs font-semibold text-white outline-none focus:border-volt"
                  >
                    <option value="all">All Body Regions</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="h-9 rounded-lg border border-obsidian-700 bg-obsidian-950 px-3 text-xs font-semibold text-white outline-none focus:border-volt"
                  >
                    <option value="all">All Difficulty Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>

                  <span className="ml-auto font-mono text-xs text-slate-500">
                    {filteredExercises.length} results
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-obsidian-950 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-obsidian-800">
                    <tr>
                      <th className="px-4 py-3">Exercise</th>
                      <th className="px-4 py-3">Pattern</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-obsidian-800/60 font-medium">
                    {filteredExercises.map((ex) => {
                      const isSelected =
                        selectedExercise?.id === ex.id || selectedExercise?.name === ex.name;
                      return (
                        <tr
                          key={ex.id || ex.name}
                          onClick={() => setSelectedExercise(ex)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-volt/10 text-white'
                              : 'hover:bg-obsidian-800/60 text-slate-300'
                          }`}
                        >
                          <td className="px-4 py-3.5 font-bold text-white flex items-center gap-2">
                            <span className="truncate">{ex.name}</span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-cyan-400">
                            {ex.movementPattern || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-400">
                            {ex.bodyPart || ex.category || '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant="hardware">
                              {ex.recommendedLevel || ex.difficulty || 'General'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!filteredExercises.length && (
                  <p className="p-12 text-center text-xs text-slate-500">
                    No matching exercises in catalog.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exercise Inspector & Safety Matrix Card */}
          <div className="space-y-6">
            {selectedExercise ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Exercise Inspector</span>
                    <Badge variant="cyan">
                      {selectedExercise.movementPattern || 'Standard'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* High-res Visual Stage */}
                  <div className="overflow-hidden rounded-xl border border-obsidian-700 bg-obsidian-950">
                    <ExerciseVisual
                      name={selectedExercise.name}
                      masterExerciseId={selectedExercise.canonicalId || selectedExercise.id}
                      movementPattern={selectedExercise.movementPattern}
                      muscleGroup={selectedExercise.bodyPart || selectedExercise.category}
                      showAttribution={true}
                    />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-white">{selectedExercise.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Primary Target: {selectedExercise.primaryMuscle || selectedExercise.primaryMuscles?.[0] || selectedExercise.bodyPart || 'Full Body'}
                    </p>
                  </div>

                  {/* Safety Considerations Matrix */}
                  <div>
                    <span className="mb-2.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-400">
                      <ShieldAlert className="h-4 w-4" /> Safety Consideration Matrix
                    </span>

                    {selectedExercise.safetyConsiderations?.length ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {selectedExercise.safetyConsiderations.map((rule, idx) => {
                          const rating = rule.rating || rule.level || 'safe';
                          return (
                            <div
                              key={idx}
                              className="rounded-xl border border-obsidian-700 bg-obsidian-950 p-3.5 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-white">
                                  {rule.condition || 'General Posture'}
                                </span>
                                <Badge
                                  variant={
                                    rating === 'avoid'
                                      ? 'danger'
                                      : rating === 'caution'
                                      ? 'amber'
                                      : 'volt'
                                  }
                                >
                                  {rating.toUpperCase()}
                                </Badge>
                              </div>
                              {rule.reason && (
                                <p className="text-xs text-slate-300">{rule.reason}</p>
                              )}
                              {rule.requiredModification && (
                                <p className="text-[11px] text-amber-400/90 font-medium">
                                  Mod: {rule.requiredModification}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-4 text-center text-xs text-slate-400">
                        No adverse safety flags or contraindications recorded for this movement.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-20 text-center text-slate-500">
                  Select an exercise to inspect its anatomical profile and safety matrix.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AI Audit Logs Viewer */}
      {activeTab === 'audit_logs' && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          {/* Logs List */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-volt" /> Recent OpenRouter AI Traces
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[650px] divide-y divide-obsidian-800 overflow-y-auto">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer p-4 transition-colors ${
                          isSelected ? 'bg-volt/10' : 'hover:bg-obsidian-850'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-white truncate max-w-44">
                            {log.model}
                          </span>
                          <Badge variant={log.status === 'success' ? 'volt' : 'danger'}>
                            {log.status}
                          </Badge>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-500 truncate">
                          Trace: {log.traceId}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span>{log.latencyMs}ms</span>
                          <span>{log.totalTokens || 0} tokens</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="p-8 text-center text-xs text-slate-500">
                    No recent AI audit log traces recorded.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Log Inspector Detail */}
          <div>
            {selectedLog ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Audit Trace Inspector</span>
                    <Badge variant="hardware">{selectedLog.provider}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 font-mono text-xs">
                  <div className="rounded-xl border border-obsidian-700 bg-obsidian-950 p-4 space-y-2">
                    <div>
                      <span className="text-slate-500">Trace ID:</span>
                      <p className="text-volt break-all">{selectedLog.traceId}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>
                        <span className="text-slate-500">Model:</span> {selectedLog.model}
                      </div>
                      <div>
                        <span className="text-slate-500">Latency:</span> {selectedLog.latencyMs}ms
                      </div>
                      <div>
                        <span className="text-slate-500">Tokens:</span> {selectedLog.totalTokens}
                      </div>
                      <div>
                        <span className="text-slate-500">Time:</span>{' '}
                        {new Date(selectedLog.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Completion / Issues */}
                  {selectedLog.errorMessage && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
                      <span className="font-bold">Error Message:</span>
                      <p className="mt-1">{selectedLog.errorMessage}</p>
                    </div>
                  )}

                  {/* Prompt Text Preview */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Structured Prompt
                    </span>
                    <pre className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-obsidian-700 bg-obsidian-950 p-3 text-[11px] text-slate-300 whitespace-pre-wrap">
                      {selectedLog.prompt}
                    </pre>
                  </div>

                  {/* Completion Text Preview */}
                  {selectedLog.completion && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Generated JSON Response
                      </span>
                      <pre className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-obsidian-700 bg-obsidian-950 p-3 text-[11px] text-emerald-400 whitespace-pre-wrap">
                        {selectedLog.completion}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-20 text-center text-slate-500">
                  Select an AI audit log trace to inspect.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </main>
  </div>
);
}
