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
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="text-zinc-400 hover:text-white">
            Cancel
          </Button>
          <Button
            variant="volt"
            onClick={handleConfirm}
            disabled={!selectedCandidate || loading}
            loading={loading}
            className="font-bold whitespace-nowrap"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1.5" /> Swap Exercise
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Current Exercise Context */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Replacing</span>
            <p className="truncate text-sm font-extrabold text-white capitalize">{currentExerciseName}</p>
          </div>
          {currentMovementPattern && (
            <Badge variant="lime" className="text-[10px] uppercase shrink-0">
              {currentMovementPattern}
            </Badge>
          )}
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
          <Input
            className="pl-10 border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-500 focus:border-lime-400"
            placeholder="Search alternative exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Candidate List */}
        <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
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
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3 transition-all ${
                    isSelected
                      ? 'border-lime-400 bg-lime-400/10 shadow-sm'
                      : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700 hover:bg-zinc-950'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                      <ExerciseVisual
                        name={item.name}
                        masterExerciseId={item.masterExerciseId}
                        movementPattern={item.movementPattern}
                        compact={true}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white capitalize">{item.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.movementPattern && (
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">{item.movementPattern}</span>
                        )}
                        {gear && (
                          <span className="flex items-center text-[10px] text-zinc-500 truncate">
                            <Dumbbell className="mr-1 h-3 w-3 shrink-0" /> {gear}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        safety === 'avoid' ? 'danger' : safety === 'caution' ? 'amber' : 'lime'
                      }
                      className="text-[10px]"
                    >
                      <ShieldCheck className="mr-0.5 h-3 w-3" />
                      {safety.toUpperCase()}
                    </Badge>
                    {isSelected && (
                      <div className="grid size-6 place-items-center rounded-full bg-lime-400 text-zinc-950">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center text-xs text-zinc-400">
              No matching exercise candidates found.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
