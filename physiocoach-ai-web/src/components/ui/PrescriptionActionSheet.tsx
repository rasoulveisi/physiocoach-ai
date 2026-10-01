import { useEffect, useMemo } from 'react';
import {
  X,
  Flame,
  Clock,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Timer,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Button } from './Button';

export interface ParsedPrescriptionSet {
  setNumber: number;
  setType: 'WARMUP' | 'NORMAL' | 'DROP' | 'FAILURE' | string;
  reps: string;
  rir?: string;
  tempo?: string;
  rest?: string;
}

export function parsePrescriptionNotes(rawNotes: string | null | undefined): {
  sets: ParsedPrescriptionSet[];
  generalNotes?: string;
} {
  if (!rawNotes || !rawNotes.trim()) {
    return { sets: [] };
  }

  const clean = rawNotes.trim();
  const segments = clean.split('|').map((s) => s.trim()).filter(Boolean);
  const sets: ParsedPrescriptionSet[] = [];
  const otherNotes: string[] = [];

  for (const segment of segments) {
    // Matches: Set 1 [WARMUP]: 8–10 reps @ RIR 3, tempo 3–0–1–0, rest 90s
    // Also matches: Set 2: 10 reps @ RIR 2
    const setMatch = segment.match(/Set\s*(\d+)(?:\s*\[([A-Za-z0-9_]+)\])?\s*:\s*(.*)/i);
    if (setMatch) {
      const setNum = parseInt(setMatch[1], 10);
      const setType = (setMatch[2] || 'NORMAL').toUpperCase();
      const restText = setMatch[3];

      let reps = '';
      let rir = '';
      let tempo = '';
      let rest = '';

      // Match reps: "8–10 reps" or "8-10 reps" or "10 reps" or "30s hold"
      const repsMatch = restText.match(/(\d+(?:[–-]\d+)?\s*(?:reps?|s|sec)?)/i);
      if (repsMatch) reps = repsMatch[1].trim();

      // Match RIR: "@ RIR 3" or "RIR 3"
      const rirMatch = restText.match(/@?\s*RIR\s*([0-9.]+)/i);
      if (rirMatch) rir = `RIR ${rirMatch[1]}`;

      // Match tempo: "tempo 3–0–1–0" or "tempo: 3-0-1-0"
      const tempoMatch = restText.match(/tempo\s*:?\s*([0-9–-]+)/i);
      if (tempoMatch) tempo = tempoMatch[1];

      // Match rest: "rest 90s"
      const restSecMatch = restText.match(/rest\s*:?\s*([0-9]+s?)/i);
      if (restSecMatch) {
        rest = restSecMatch[1].endsWith('s') ? restSecMatch[1] : `${restSecMatch[1]}s`;
      }

      sets.push({
        setNumber: setNum,
        setType,
        reps: reps || 'As Prescribed',
        rir: rir || undefined,
        tempo: tempo || undefined,
        rest: rest || undefined,
      });
    } else {
      otherNotes.push(segment);
    }
  }

  return {
    sets,
    generalNotes: otherNotes.length > 0 ? otherNotes.join(' • ') : undefined,
  };
}

export interface PrescriptionActionSheetProps {
  open: boolean;
  onClose: () => void;
  exerciseName: string;
  notes?: string | null;
  targetSets?: number;
  targetReps?: number | string;
  muscleGroup?: string;
  movementPattern?: string;
}

export function PrescriptionActionSheet({
  open,
  onClose,
  exerciseName,
  notes,
  targetSets,
  targetReps,
  muscleGroup,
  movementPattern,
}: PrescriptionActionSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const parsed = useMemo(() => parsePrescriptionNotes(notes), [notes]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="prescription-sheet-title"
    >
      <div
        className="w-full max-h-[88vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#0d121c] text-white shadow-2xl flex flex-col animate-slide-up sm:animate-scale-in max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div
          className="w-12 h-1.5 rounded-full bg-zinc-700/80 mx-auto mt-3 mb-1 cursor-pointer sm:hidden hover:bg-zinc-600 transition-colors"
          onClick={onClose}
          title="Drag or tap to close"
        />

        {/* Action Sheet Header */}
        <div className="flex items-start justify-between border-b border-zinc-800/90 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="rounded-md bg-[#10E760]/10 border border-[#10E760]/25 px-2 py-0.5 text-[10px] font-mono font-bold text-[#10E760] uppercase">
                Prescription & RIR Guide
              </span>
              {muscleGroup && (
                <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-zinc-300">
                  {muscleGroup}
                </span>
              )}
              {movementPattern && (
                <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-zinc-400">
                  {movementPattern.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            <h2
              id="prescription-sheet-title"
              className="text-base sm:text-lg font-black text-white capitalize leading-tight truncate"
            >
              {exerciseName}
            </h2>

            {(targetSets || targetReps) && (
              <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                Session Target: {targetSets || 3} sets × {targetReps || 10} reps
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[calc(88vh-130px)]">
          {/* Prettified Set Breakdown */}
          {parsed.sets.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider px-1">
                <span>Prescribed Set Breakdown</span>
                <span>{parsed.sets.length} Sets Total</span>
              </div>

              <div className="space-y-2">
                {parsed.sets.map((set) => {
                  const isWarmup = set.setType === 'WARMUP';
                  const isFailure = set.setType === 'FAILURE';
                  const isDrop = set.setType === 'DROP';

                  const badgeCls = isWarmup
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : isFailure
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : isDrop
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                    : 'bg-[#10E760]/15 border-[#10E760]/30 text-[#10E760]';

                  const badgeLabel = isWarmup
                    ? 'Warmup'
                    : isFailure
                    ? 'Failure'
                    : isDrop
                    ? 'Drop Set'
                    : 'Working';

                  const IconComp = isWarmup ? Flame : isFailure ? AlertCircle : isDrop ? RotateCcw : CheckCircle2;

                  return (
                    <div
                      key={set.setNumber}
                      className="rounded-2xl border border-zinc-800 bg-[#121722]/90 p-3 sm:p-3.5 space-y-2.5 hover:border-zinc-700 transition-colors"
                    >
                      {/* Set header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-white">
                            Set #{set.setNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${badgeCls}`}
                          >
                            <IconComp className="h-3 w-3" />
                            {badgeLabel}
                          </span>
                        </div>

                        {set.rest && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-400 bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded-lg">
                            <Timer className="h-3 w-3 text-cyan-400" />
                            Rest {set.rest}
                          </span>
                        )}
                      </div>

                      {/* Reps, RIR, Tempo Pills */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Reps */}
                        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 text-center">
                          <span className="block text-[10px] font-mono uppercase text-zinc-500 font-bold">
                            Target Reps
                          </span>
                          <strong className="block font-mono text-xs sm:text-sm font-extrabold text-white mt-0.5 truncate">
                            {set.reps}
                          </strong>
                        </div>

                        {/* Intensity / RIR */}
                        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 text-center">
                          <span className="block text-[10px] font-mono uppercase text-zinc-500 font-bold">
                            Target Effort
                          </span>
                          <strong className="block font-mono text-xs sm:text-sm font-extrabold text-[#10E760] mt-0.5 truncate">
                            {set.rir || 'RIR 2'}
                          </strong>
                        </div>

                        {/* Tempo */}
                        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 text-center">
                          <span className="block text-[10px] font-mono uppercase text-zinc-500 font-bold">
                            Cadence / Tempo
                          </span>
                          <strong className="block font-mono text-xs sm:text-sm font-extrabold text-cyan-400 mt-0.5 truncate">
                            {set.tempo || '3-0-1-0'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Fallback if notes exist but are freeform text */
            notes && (
              <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-3.5 space-y-2">
                <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                  Prescription Directives
                </span>
                <p className="text-xs text-zinc-200 leading-relaxed font-mono">
                  {notes}
                </p>
              </div>
            )
          )}

          {/* General Notes if any remained after parsing */}
          {parsed.generalNotes && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-zinc-800 bg-[#121722]/60 p-3 text-xs text-zinc-300">
              <HelpCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-white block font-mono text-[11px]">Coaching Directives:</strong>
                <p className="text-[11px] text-zinc-300 leading-relaxed">{parsed.generalNotes}</p>
              </div>
            </div>
          )}

          {/* P.S. Detailed RIR Explanation */}
          <div className="rounded-2xl border border-[#10E760]/30 bg-gradient-to-b from-[#10E760]/10 via-[#121722] to-zinc-950 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-[#10E760]/20 border border-[#10E760]/40 grid place-items-center text-[#10E760] shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-white">
                  P.S. Understanding RIR (Reps In Reserve)
                </h4>
                <p className="text-[10px] text-zinc-400 font-mono">
                  The clinical gold standard for training intensity
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              <strong className="text-white font-semibold">RIR (Reps In Reserve)</strong> indicates how many more clean repetitions you could perform with proper form before reaching muscular failure:
            </p>

            {/* RIR Scale Breakdown */}
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-start gap-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 p-2.5">
                <span className="rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black shrink-0">
                  RIR 3
                </span>
                <div className="text-[11px] text-zinc-300 leading-snug">
                  <strong className="text-white">Warmup & Preparation:</strong> 3 reps left in the tank. Smooth speed, zero form breakdown. Primes joint mobility and nervous system.
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-[#10E760]/10 border border-[#10E760]/30 p-2.5">
                <span className="rounded bg-[#10E760]/20 text-[#10E760] border border-[#10E760]/40 px-2 py-0.5 text-[10px] font-black shrink-0">
                  RIR 2
                </span>
                <div className="text-[11px] text-zinc-300 leading-snug">
                  <strong className="text-[#10E760]">Hypertrophy Sweet Spot:</strong> 2 reps left in the tank. Heavy working effort! The bar naturally slows down, but form stays solid. Maximum muscle growth with safe joint stress.
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 p-2.5">
                <span className="rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-black shrink-0">
                  RIR 1
                </span>
                <div className="text-[11px] text-zinc-300 leading-snug">
                  <strong className="text-white">High Intensity:</strong> Only 1 rep left in reserve. High mental focus. Grinding rep while preserving strict posture.
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 p-2.5">
                <span className="rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 text-[10px] font-black shrink-0">
                  RIR 0
                </span>
                <div className="text-[11px] text-zinc-300 leading-snug">
                  <strong className="text-white">Technical Failure:</strong> 0 reps left. You could not complete another rep with safe technique. Use cautiously on final sets.
                </div>
              </div>
            </div>

            {/* Tempo Breakdown Box */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5 text-[11px] text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                <span>How Tempo Works (e.g. 3–0–1–0):</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[10px] pt-1 text-center">
                <div className="bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
                  <span className="text-[#10E760] font-bold block text-[11px]">3s Eccentric</span>
                  <span className="text-zinc-400">Lower weight smoothly</span>
                </div>
                <div className="bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
                  <span className="text-cyan-400 font-bold block text-[11px]">0s Pause</span>
                  <span className="text-zinc-400">No bottom resting</span>
                </div>
                <div className="bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
                  <span className="text-[#10E760] font-bold block text-[11px]">1s Concentric</span>
                  <span className="text-zinc-400">Explosive lift</span>
                </div>
                <div className="bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
                  <span className="text-cyan-400 font-bold block text-[11px]">0s Top</span>
                  <span className="text-zinc-400">Breathe & next rep</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Sheet Footer */}
        <div className="border-t border-zinc-800/90 p-3 sm:p-4 bg-zinc-950/90">
          <Button
            type="button"
            variant="volt"
            size="md"
            onClick={onClose}
            className="w-full font-black text-sm"
          >
            Got it, Let's Lift
          </Button>
        </div>
      </div>
    </div>
  );
}
