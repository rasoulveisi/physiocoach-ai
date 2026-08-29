import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Globe,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from './Button';
import { apiClient } from '../../services/api-client';
import { evaluateCandidatePersonas, getPersonaColorClasses } from '../../services/persona-matcher';

// ─── Types ─────────────────────────────────────────────────────────────────

type AuditSeverity = 'ok' | 'warning' | 'critical';
type AuditBadge =
  | 'PhysioCoach Certified Safe'
  | 'Needs Adjustment'
  | 'Medical Review Required';

interface AuditCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: AuditSeverity;
  message: string;
  fixSuggestion?: string;
}

interface AuditResult {
  auditLogId: string;
  traceId: string;
  certified: boolean;
  score: number;
  badge: AuditBadge;
  checks: AuditCheck[];
}

export interface PublishResultData {
  publishedPlanId: string;
  personas: string[];
  exploreUrl: string;
}

export interface SafetyAuditModalProps {
  planJson: Record<string, unknown>;
  planId?: string;
  onClose: () => void;
  onSavePlan?: () => void;
  onPublishPlan?: () => Promise<PublishResultData | null | void> | void;
}

// ─── Badge Config ──────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<
  AuditBadge,
  {
    label: string;
    color: string;
    borderColor: string;
    glowColor: string;
    bg: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  'PhysioCoach Certified Safe': {
    label: 'PhysioCoach Certified Safe',
    color: 'text-[#10E760]',
    borderColor: 'border-[#10E760]/40',
    glowColor: 'shadow-[#10E760]/20',
    bg: 'bg-[#10E760]/10',
    Icon: ShieldCheck,
  },
  'Needs Adjustment': {
    label: 'Needs Adjustment',
    color: 'text-[#F59E0B]',
    borderColor: 'border-[#F59E0B]/40',
    glowColor: 'shadow-[#F59E0B]/20',
    bg: 'bg-[#F59E0B]/10',
    Icon: Shield,
  },
  'Medical Review Required': {
    label: 'Medical Review Required',
    color: 'text-red-400',
    borderColor: 'border-red-500/40',
    glowColor: 'shadow-red-500/20',
    bg: 'bg-red-500/10',
    Icon: ShieldAlert,
  },
};

const SEVERITY_CONFIG: Record<
  AuditSeverity,
  { label: string; iconColor: string; Icon: React.FC<{ className?: string }> }
> = {
  ok: { label: 'Pass', iconColor: 'text-[#10E760]', Icon: CheckCircle2 },
  warning: { label: 'Warning', iconColor: 'text-[#F59E0B]', Icon: AlertTriangle },
  critical: { label: 'Critical', iconColor: 'text-red-400', Icon: XCircle },
};

// ─── Scanning HUD Animation ────────────────────────────────────────────────

function ScanningHUD() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-12">
      {/* Animated scanner */}
      <div className="relative size-32">
        <div className="absolute inset-0 rounded-full border-2 border-[#10E760]/20" />
        <div className="absolute inset-2 rounded-full border-2 border-[#10E760]/10" />
        <div className="absolute inset-4 rounded-full border border-[#10E760]/20" />
        {/* Rotating ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#10E760]"
          style={{ animation: 'spin 1.2s linear infinite' }}
        />
        {/* Inner pulse */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="size-6 rounded-full bg-[#10E760]/30"
            style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
          />
        </div>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-[#10E760]">
          Running Clinical Safety Scan
        </p>
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-zinc-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Analyzing biomechanical parameters…</span>
        </div>
        <div className="mt-3 flex items-center justify-center gap-3">
          {['Push:Pull', 'Volume', 'Spinal Load', 'Joint Shear'].map((check) => (
            <span
              key={check}
              className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[9px] font-mono text-zinc-400"
            >
              {check}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Check Card ────────────────────────────────────────────────────────────

function CheckCard({ check }: { check: AuditCheck }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[check.severity];
  const SevIcon = sev.Icon;

  return (
    <div
      className={`rounded-2xl border bg-[#121722] transition-colors ${
        check.passed
          ? 'border-zinc-800/80'
          : check.severity === 'critical'
            ? 'border-red-500/20'
            : 'border-[#F59E0B]/20'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <SevIcon className={`mt-0.5 h-4 w-4 shrink-0 ${sev.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-zinc-100">{check.name}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase ${
                check.passed
                  ? 'bg-[#10E760]/10 text-[#10E760]'
                  : check.severity === 'critical'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-[#F59E0B]/10 text-[#F59E0B]'
              }`}
            >
              {sev.label}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{check.message}</p>
        </div>
        {check.fixSuggestion && (
          <span className="shrink-0 text-zinc-600">
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>
        )}
      </button>

      {expanded && check.fixSuggestion && (
        <div className="border-t border-zinc-800 px-4 pb-4 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#06B6D4]">
            Fix Suggestion
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">{check.fixSuggestion}</p>
        </div>
      )}
    </div>
  );
}

// ─── Score Ring ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10E760' : score >= 50 ? '#F59E0B' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="#1F2937"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-black tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[9px] font-mono text-zinc-500">/ 100</span>
      </div>
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────

export function SafetyAuditModal({
  planJson,
  planId,
  onClose,
  onSavePlan,
  onPublishPlan,
}: SafetyAuditModalProps) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'results' | 'error'>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedData, setPublishedData] = useState<PublishResultData | null>(null);

  const navigate = useNavigate();

  const candidateEvaluation = useMemo(() => evaluateCandidatePersonas(planJson), [planJson]);

  const handleRunAudit = async () => {
    setPhase('scanning');
    setErrorMsg('');
    try {
      const data = await apiClient.post<AuditResult>('workout-plans/audit', { planJson });
      setResult(data);
      setPhase('results');
    } catch (err) {
      console.error('Safety audit failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Audit request failed.');
      setPhase('error');
    }
  };

  // Auto-trigger on mount
  React.useEffect(() => {
    handleRunAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (onPublishPlan) {
        const res = await onPublishPlan();
        if (res) {
          setPublishedData(res);
          return;
        }
      } else if (planId) {
        const res = await apiClient.post<PublishResultData>(`workout-plans/${planId}/publish`);
        if (res) {
          setPublishedData(res);
          return;
        }
      }
      // Fallback published data representation
      setPublishedData({
        publishedPlanId: planId || 'published-plan',
        personas: candidateEvaluation.personas,
        exploreUrl: `/explore?plan=${planId || ''}`,
      });
    } catch (err) {
      console.error('Publish to Explore failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not publish routine.');
    } finally {
      setIsPublishing(false);
    }
  };

  const badgeConfig = result ? BADGE_CONFIG[result.badge] : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-[#090D15]/90 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Medical Safety Audit & Marketplace Publishing"
      >
        <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-[#0E1420] shadow-2xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-xl bg-[#10E760]/10 border border-[#10E760]/20">
                <ClipboardList className="h-4 w-4 text-[#10E760]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-white">
                  Medical Safety Audit & Hub
                </h2>
                <p className="text-[10px] text-zinc-500">
                  Biomechanical Safety Validation
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-xl border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
              aria-label="Close audit modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {(phase === 'idle' || phase === 'scanning') && <ScanningHUD />}

            {phase === 'error' && (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <XCircle className="h-12 w-12 text-red-400" />
                <p className="text-sm font-bold text-red-400">Audit Failed</p>
                <p className="text-xs text-zinc-400">{errorMsg}</p>
                <Button variant="secondary" size="sm" onClick={() => handleRunAudit()}>
                  Retry
                </Button>
              </div>
            )}

            {/* Published Success Screen */}
            {publishedData && (
              <div className="space-y-6 py-4 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#10E760]/20 border border-[#10E760]/40 shadow-lg shadow-[#10E760]/20">
                  <Globe className="h-8 w-8 text-[#10E760]" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-[#10E760]">
                    Live in Community Hub
                  </span>
                  <h3 className="text-xl font-black text-white">Routine Successfully Published!</h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Your certified routine is now indexed in the Explore Marketplace with candidate persona matching.
                  </p>
                </div>

                {/* Persona Badges Live */}
                <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4 text-left space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                    <Users className="h-4 w-4 text-[#06B6D4]" />
                    <span>Matched Community Personas:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {publishedData.personas.map((persona) => {
                      const colors = getPersonaColorClasses(persona);
                      return (
                        <span
                          key={persona}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${colors.badgeBg} ${colors.textColor} ${colors.borderColor}`}
                        >
                          {persona}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    type="button"
                    variant="volt"
                    size="md"
                    className="w-full font-black shadow-lg shadow-[#10E760]/20"
                    onClick={() => {
                      onClose();
                      navigate(publishedData.exploreUrl || `/explore?plan=${publishedData.publishedPlanId}`);
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Live in Community Hub
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full text-xs font-bold"
                    onClick={() => {
                      onClose();
                      onSavePlan?.();
                    }}
                  >
                    Done & Save to My Library
                  </Button>
                </div>
              </div>
            )}

            {phase === 'results' && result && badgeConfig && !publishedData && (
              <div className="space-y-5">
                {/* Badge + Score */}
                <div
                  className={`flex flex-col items-center gap-4 rounded-2xl border p-6 ${badgeConfig.bg} ${badgeConfig.borderColor} shadow-lg ${badgeConfig.glowColor}`}
                >
                  <ScoreRing score={result.score} />
                  <div className="text-center">
                    <badgeConfig.Icon className={`mx-auto mb-2 h-6 w-6 ${badgeConfig.color}`} />
                    <p className={`text-base font-black uppercase tracking-tight ${badgeConfig.color}`}>
                      {badgeConfig.label}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      {result.certified
                        ? 'This plan meets PhysioCoach clinical safety standards and qualifies for Explore Hub publishing.'
                        : 'Review the flagged items below before activating this plan.'}
                    </p>
                  </div>
                </div>

                {/* Candidate Persona Match Section (When Certified) */}
                {result.score >= 80 && candidateEvaluation.personas.length > 0 && (
                  <div className="rounded-2xl border border-[#06B6D4]/30 bg-[#06B6D4]/10 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#06B6D4]">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Candidate Persona Matching</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-[#10E760] bg-[#10E760]/10 border border-[#10E760]/30 px-2 py-0.5 rounded-full">
                        Marketplace Eligible
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Suitable for athletes matching these movement signatures:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {candidateEvaluation.personas.map((persona) => {
                        const colors = getPersonaColorClasses(persona);
                        return (
                          <span
                            key={persona}
                            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 ${colors.badgeBg} ${colors.textColor} ${colors.borderColor}`}
                          >
                            <Users className="h-3 w-3" />
                            {persona}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Traceability IDs */}
                <div className="rounded-xl border border-zinc-800 bg-[#090D15] p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Audit Traceability
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-600">Audit Log ID</span>
                      <span className="font-mono text-[10px] text-[#06B6D4] break-all">
                        {result.auditLogId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-600">Trace ID</span>
                      <span className="font-mono text-[10px] text-[#06B6D4] break-all">
                        {result.traceId}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Check Cards */}
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Safety Checks ({result.checks.filter((c) => c.passed).length}/
                    {result.checks.length} passed)
                  </p>
                  {result.checks.map((check) => (
                    <CheckCard key={check.id} check={check} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          {phase === 'results' && result && !publishedData && (
            <div className="shrink-0 border-t border-zinc-800 px-5 py-4 space-y-2">
              {result.certified ? (
                <>
                  <Button
                    type="button"
                    variant="volt"
                    size="md"
                    loading={isPublishing}
                    className="w-full font-black shadow-lg shadow-[#10E760]/20"
                    onClick={handlePublish}
                  >
                    <Globe className="mr-2 h-4 w-4" />
                    Publish to Community Explore Hub
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full font-bold text-xs"
                    onClick={() => {
                      onClose();
                      onSavePlan?.();
                    }}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4 text-[#10E760]" />
                    Save & Activate Without Publishing
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="w-full font-bold border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10"
                  onClick={onClose}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Apply Suggested Fixes in Builder
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
