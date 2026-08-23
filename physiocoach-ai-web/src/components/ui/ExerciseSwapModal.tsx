import { useState, useMemo } from 'react';
import { Search, ShieldCheck, Dumbbell, ArrowLeftRight, Check } from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Input';
import { ExerciseVisual } from './ExerciseVisual';

export interface SwapCandidateItem {
  id?: string;
  masterExerciseId?: string | null;
  name: string;
  movementPattern?: string;
  muscleGroups?: string[];
  equipment?: string[] | string;
  safetyLevel?: 'safe' | 'caution' | 'avoid';
}

export interface ExerciseSwapModalProps {
  open: boolean;
  onClose(): void;
  currentExerciseName: string;
  currentMovementPattern?: string;
  candidates: SwapCandidateItem[];
  onConfirmSwap(selected: SwapCandidateItem): void;
  loading?: boolean;
}

export function ExerciseSwapModal({
  open,
  onClose,
  currentExerciseName,
  currentMovementPattern,
  candidates,
  onConfirmSwap,
  loading = false,
}: ExerciseSwapModalProps) {
  const [query, setQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<SwapCandidateItem | null>(null);

  const filtered = useMemo(() => {
    return candidates.filter((item) => {
      if (item.name.toLowerCase() === currentExerciseName.toLowerCase()) return false;
      const term = query.toLowerCase().trim();
      if (!term) return true;
      const matchName = item.name.toLowerCase().includes(term);
      const matchPattern = item.movementPattern?.toLowerCase().includes(term);
      const matchMuscle = item.muscleGroups?.some((m) => m.toLowerCase().includes(term));
      return matchName || matchPattern || matchMuscle;
    });
  }, [candidates, currentExerciseName, query]);

  const handleConfirm = () => {
    if (selectedCandidate) {
      onConfirmSwap(selectedCandidate);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Swap Exercise"
      maxWidth="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="volt"
            onClick={handleConfirm}
            disabled={!selectedCandidate || loading}
            loading={loading}
          >
            <ArrowLeftRight className="h-4 w-4" /> Swap for Selected
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Current Exercise Context */}
        <div className="flex items-center justify-between rounded-xl border border-obsidian-700 bg-obsidian-950 p-3.5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Replacing</span>
            <p className="text-sm font-extrabold text-white">{currentExerciseName}</p>
          </div>
          {currentMovementPattern && <Badge variant="cyan">{currentMovementPattern}</Badge>}
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
          <Input
            className="pl-10"
            placeholder="Search safe alternative exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Candidate List */}
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const isSelected =
                selectedCandidate?.name.toLowerCase() === item.name.toLowerCase() ||
                (selectedCandidate?.masterExerciseId &&
                  selectedCandidate.masterExerciseId === item.masterExerciseId);
              const gear = Array.isArray(item.equipment) ? item.equipment.join(', ') : item.equipment;
              const safety = item.safetyLevel || 'safe';

              return (
                <div
                  key={item.masterExerciseId || item.name}
                  onClick={() => setSelectedCandidate(item)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                    isSelected
                      ? 'border-volt bg-volt/10'
                      : 'border-obsidian-700 bg-obsidian-950 hover:border-obsidian-600 hover:bg-obsidian-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ExerciseVisual
                      name={item.name}
                      masterExerciseId={item.masterExerciseId}
                      movementPattern={item.movementPattern}
                      compact={true}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-white">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.movementPattern && (
                          <span className="text-[11px] text-slate-400">{item.movementPattern}</span>
                        )}
                        {gear && (
                          <span className="flex items-center text-[11px] text-slate-500">
                            <Dumbbell className="mr-1 h-3 w-3" /> {gear}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        safety === 'avoid' ? 'danger' : safety === 'caution' ? 'amber' : 'volt'
                      }
                    >
                      <ShieldCheck className="mr-0.5 h-3 w-3" />
                      {safety}
                    </Badge>
                    {isSelected && (
                      <div className="grid size-6 place-items-center rounded-full bg-volt text-obsidian-950">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-obsidian-800 bg-obsidian-950 p-6 text-center text-xs text-slate-400">
              No matching exercise candidates found.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
