import { useEffect, useMemo, useState } from 'react';
import { X, Clock, Flame, CheckCircle2, Check, Minus, Plus, Sparkles } from 'lucide-react';
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
    const setMatch = segment.match(/Set\s*(\d+)(?:\s*\[([A-Za-z0-9_]+)\])?\s*:\s*(.*)/i);
    if (setMatch) {
      const setNum = parseInt(setMatch[1], 10);
      const setType = (setMatch[2] || 'NORMAL').toUpperCase();
      const restText = setMatch[3];

      let reps = '';
      let rir = '';
      let tempo = '';
      let rest = '';

      const repsMatch = restText.match(/(\d+(?:[–-]\d+)?\s*(?:reps?|s|sec)?)/i);
      if (repsMatch) reps = repsMatch[1].trim();

      const rirMatch = restText.match(/@?\s*RIR\s*([0-9.]+)/i);
      if (rirMatch) rir = `RIR ${rirMatch[1]}`;

      const tempoMatch = restText.match(/tempo\s*:?\s*([0-9–-]+)/i);
      if (tempoMatch) tempo = tempoMatch[1];

      const restSecMatch = restText.match(/rest\s*:?\s*([0-9]+s?)/i);
      if (restSecMatch) {
        rest = restSecMatch[1].endsWith('s') ? restSecMatch[1] : `${restSecMatch[1]}s`;
      }

      sets.push({
        setNumber: setNum,
        setType,
        reps: reps || 'Target Reps',
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

export function serializePrescriptionNotes(
  sets: ParsedPrescriptionSet[],
  generalNotes?: string
): string {
  const setSegments = sets.map((s) => {
    const typeLabel = (s.setType || 'NORMAL').toUpperCase();
    const typeTag = typeLabel !== 'NORMAL' ? ` [${typeLabel}]` : '';
    const parts = [s.reps || '10 reps'];
    if (s.rir) parts.push(`@ ${s.rir}`);
    if (s.tempo) parts.push(`tempo ${s.tempo}`);
    if (s.rest) parts.push(`rest ${s.rest}`);
    return `Set ${s.setNumber}${typeTag}: ${parts.join(', ')}`;
  });

  if (generalNotes && generalNotes.trim()) {
    setSegments.push(generalNotes.trim());
  }

  return setSegments.join(' | ');
}

export function parseRirNumber(rirStr?: string): number {
  if (!rirStr) return 2;
  const match = rirStr.match(/([0-9.]+)/);
  return match ? parseFloat(match[1]) : 2;
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
  onUpdatePrescription?: (updatedNotes: string, updatedSets: ParsedPrescriptionSet[]) => void;
}

export function PrescriptionActionSheet({
  open,
  onClose,
  exerciseName,
  notes,
  targetSets,
  targetReps,
  onUpdatePrescription,
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

  // Local editable state for sets
  const [editableSets, setEditableSets] = useState<ParsedPrescriptionSet[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (parsed.sets.length > 0) {
      setEditableSets(parsed.sets);
    } else {
      const count = Math.max(1, targetSets || 3);
      const repStr = String(targetReps || 10);
      const generated: ParsedPrescriptionSet[] = Array.from({ length: count }, (_, i) => ({
        setNumber: i + 1,
        setType: i === 0 && count >= 4 ? 'WARMUP' : 'NORMAL',
        reps: repStr.includes('rep') ? repStr : `${repStr} reps`,
        rir: 'RIR 2',
        tempo: '3-0-1-0',
        rest: '90s',
      }));
      setEditableSets(generated);
    }
    setHasChanges(false);
  }, [parsed.sets, notes, targetSets, targetReps]);

  if (!open) return null;

  const tempoString = editableSets.find((s) => s.tempo)?.tempo || parsed.sets.find((s) => s.tempo)?.tempo;

  const handleStepRir = (setNum: number, delta: number) => {
    setEditableSets((prev) =>
      prev.map((s) => {
        if (s.setNumber !== setNum) return s;
        const current = parseRirNumber(s.rir);
        const next = Math.max(0, Math.min(5, current + delta));
        return { ...s, rir: `RIR ${next}` };
      })
    );
    setHasChanges(true);
  };

  const handleCycleRir = (setNum: number) => {
    setEditableSets((prev) =>
      prev.map((s) => {
        if (s.setNumber !== setNum) return s;
        const current = Math.round(parseRirNumber(s.rir));
        // Cycle: 3 -> 2 -> 1 -> 0 -> 3
        const cycleMap: Record<number, number> = { 3: 2, 2: 1, 1: 0, 0: 3 };
        const next = cycleMap[current] !== undefined ? cycleMap[current] : 2;
        return { ...s, rir: `RIR ${next}` };
      })
    );
    setHasChanges(true);
  };

  const handleApplyAllRir = (targetRir: number) => {
    setEditableSets((prev) =>
      prev.map((s) => ({
        ...s,
        rir: `RIR ${targetRir}`,
      }))
    );
    setHasChanges(true);
  };

  const handleSaveAndApply = () => {
    const serialized = serializePrescriptionNotes(editableSets, parsed.generalNotes);
    onUpdatePrescription?.(serialized, editableSets);
    onClose();
  };

  // Check if all non-warmup sets match a specific RIR
  const allMatchRir = (val: number) => {
    if (editableSets.length === 0) return false;
    const workingSets = editableSets.filter((s) => s.setType !== 'WARMUP');
    const target = workingSets.length > 0 ? workingSets : editableSets;
    return target.every((s) => parseRirNumber(s.rir) === val);
  };

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
        className="w-full rounded-t-3xl sm:rounded-3xl border border-zinc-800 bg-[#0d121c] text-white shadow-2xl flex flex-col max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Pill */}
        <div
          className="w-10 h-1 rounded-full bg-zinc-700/80 mx-auto mt-3 mb-1 sm:hidden cursor-pointer hover:bg-zinc-600 transition-colors"
          onClick={onClose}
        />

        {/* Clean Header */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-2.5 sm:px-5 sm:pt-3.5 border-b border-zinc-800/80">
          <div className="min-w-0 flex-1 pr-3">
            <h3
              id="prescription-sheet-title"
              className="text-sm sm:text-base font-black text-white capitalize truncate leading-tight"
            >
              {exerciseName}
            </h3>
            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
              Prescription & RIR Guide
              {targetSets && targetReps ? ` • ${targetSets} sets × ${targetReps}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 grid place-items-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Glanceable Body (Fits screen without overwhelming text) */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto max-h-[75vh]">
          {/* 1. Sets Prescription Table with Interactive Steppers */}
          {editableSets.length > 0 && (
            <div className="space-y-1.5 font-mono">
              <div className="grid grid-cols-[30px_1fr_48px_96px] gap-2 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 items-center">
                <span>Set</span>
                <span>Type</span>
                <span className="text-center">Reps</span>
                <span className="text-right">Effort (RIR)</span>
              </div>

              {editableSets.map((set) => {
                const isWarmup = set.setType === 'WARMUP';
                const rirVal = parseRirNumber(set.rir);
                return (
                  <div
                    key={set.setNumber}
                    className="grid grid-cols-[30px_1fr_48px_96px] items-center gap-2 rounded-xl border border-zinc-800/90 bg-[#121722] px-2.5 py-1.5 text-xs"
                  >
                    {/* Set # */}
                    <span className="font-black text-white text-xs">#{set.setNumber}</span>

                    {/* Type badge + rest */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase border ${
                          isWarmup
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-[#10E760]/15 text-[#10E760] border-[#10E760]/30'
                        }`}
                      >
                        {isWarmup ? <Flame className="size-2.5" /> : <CheckCircle2 className="size-2.5" />}
                        {isWarmup ? 'Warm' : 'Work'}
                      </span>
                      {set.rest && (
                        <span className="text-[10px] text-zinc-400 truncate">
                          {set.rest}
                        </span>
                      )}
                    </div>

                    {/* Reps */}
                    <span className="text-center font-bold text-zinc-200 text-xs">
                      {set.reps.replace(/\s*reps?/i, '')}
                    </span>

                    {/* Effort / RIR Stepper Pill */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleStepRir(set.setNumber, -1)}
                        className="size-6 grid place-items-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white active:scale-90 transition-all font-mono font-bold text-xs select-none cursor-pointer"
                        title="Lower RIR (Harder / closer to failure)"
                        aria-label={`Decrease RIR for set ${set.setNumber}`}
                      >
                        <Minus className="size-2.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCycleRir(set.setNumber)}
                        className={`px-1.5 py-0.5 min-w-[42px] text-center rounded border font-mono text-[11px] font-black transition-colors cursor-pointer ${
                          rirVal === 0
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : rirVal === 1
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : rirVal === 2
                            ? 'bg-[#10E760]/20 text-[#10E760] border-[#10E760]/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                        title="Tap to cycle RIR (3 → 2 → 1 → 0)"
                      >
                        {set.rir || 'RIR 2'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStepRir(set.setNumber, 1)}
                        className="size-6 grid place-items-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white active:scale-90 transition-all font-mono font-bold text-xs select-none cursor-pointer"
                        title="Increase RIR (Easier / more reserve)"
                        aria-label={`Increase RIR for set ${set.setNumber}`}
                      >
                        <Plus className="size-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Tempo One-Liner */}
              {tempoString && (
                <div className="flex items-center gap-1.5 px-2 pt-1 text-[11px] text-zinc-400">
                  <Clock className="size-3 text-cyan-400 shrink-0" />
                  <span>Tempo:</span>
                  <strong className="text-cyan-300 font-bold">{tempoString}</strong>
                  <span className="text-zinc-500 text-[10px]">
                    ({tempoString.split('-')[0] || '3'}s down, {tempoString.split('-')[2] || '1'}s up)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Coaching Note (if present) */}
          {parsed.generalNotes && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-[11px] font-mono text-zinc-400 flex items-center gap-2">
              <span className="text-[#10E760]">💡</span>
              <span className="truncate">{parsed.generalNotes}</span>
            </div>
          )}

          {/* 2. Interactive RIR Quick Guide (Tap card to apply to all sets) */}
          <div className="rounded-2xl border border-zinc-800/90 bg-[#121722]/80 p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="font-bold text-white uppercase tracking-wider">
                RIR Quick Guide
              </span>
              <span className="text-zinc-400 text-[10px]">Tap card to set all</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 font-mono">
              {/* RIR 3 */}
              <button
                type="button"
                onClick={() => handleApplyAllRir(3)}
                className={`rounded-xl border p-2 text-left transition-all active:scale-95 cursor-pointer ${
                  allMatchRir(3)
                    ? 'bg-amber-500/15 border-amber-500/70 shadow-sm shadow-amber-500/10'
                    : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">RIR 3</span>
                  <span className="text-[10px] text-zinc-400 font-bold">3 left</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">Warmup & prep</p>
                <span className="text-[9px] text-amber-400/80 mt-1 block">Set all sets →</span>
              </button>

              {/* RIR 2 */}
              <button
                type="button"
                onClick={() => handleApplyAllRir(2)}
                className={`rounded-xl border p-2 text-left transition-all active:scale-95 cursor-pointer ${
                  allMatchRir(2)
                    ? 'bg-[#10E760]/20 border-[#10E760] shadow-sm shadow-[#10E760]/20'
                    : 'bg-[#10E760]/10 border-[#10E760]/30 hover:border-[#10E760]/60'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#10E760]">RIR 2</span>
                  <span className="text-[10px] text-[#10E760] font-bold">2 left 🔥</span>
                </div>
                <p className="text-[10px] text-zinc-300 mt-0.5">Growth sweet spot</p>
                <span className="text-[9px] text-[#10E760]/90 mt-1 block font-bold">Set all sets →</span>
              </button>

              {/* RIR 1 */}
              <button
                type="button"
                onClick={() => handleApplyAllRir(1)}
                className={`rounded-xl border p-2 text-left transition-all active:scale-95 cursor-pointer ${
                  allMatchRir(1)
                    ? 'bg-cyan-500/15 border-cyan-500/70 shadow-sm shadow-cyan-500/10'
                    : 'bg-zinc-900 border-zinc-800 hover:border-cyan-500/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-cyan-400">RIR 1</span>
                  <span className="text-[10px] text-zinc-400 font-bold">1 left</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">Heavy effort</p>
                <span className="text-[9px] text-cyan-400/80 mt-1 block">Set all sets →</span>
              </button>

              {/* RIR 0 */}
              <button
                type="button"
                onClick={() => handleApplyAllRir(0)}
                className={`rounded-xl border p-2 text-left transition-all active:scale-95 cursor-pointer ${
                  allMatchRir(0)
                    ? 'bg-rose-500/15 border-rose-500/70 shadow-sm shadow-rose-500/10'
                    : 'bg-zinc-900 border-zinc-800 hover:border-rose-500/40'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-400">RIR 0</span>
                  <span className="text-[10px] text-zinc-400 font-bold">0 left</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">Muscular failure</p>
                <span className="text-[9px] text-rose-400/80 mt-1 block">Set all sets →</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Button: Save & Apply or Dismiss */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/90">
          {hasChanges ? (
            <Button
              type="button"
              variant="volt"
              size="sm"
              onClick={handleSaveAndApply}
              className="w-full font-black py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-[#10E760]/20 cursor-pointer"
            >
              <Check className="size-3.5 stroke-[3]" />
              <span>Apply Changes to Workout</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="w-full font-black py-2.5 text-xs uppercase tracking-wider cursor-pointer"
            >
              Got it, Let's Lift
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
