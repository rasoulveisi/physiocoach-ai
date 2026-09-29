import { useState, useEffect } from 'react';
import { ShieldCheck, Dumbbell, Timer, Flame, ArrowLeftRight, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import { Button } from './Button';
import { ExerciseVisual } from './ExerciseVisual';
import { resolveExerciseSafetyNotes } from '../../services/exercise-safety-notes';
import {
  fetchDirectExerciseAlternatives,
  type DirectAlternativeItem,
} from '../../app/features/exercise-catalog/services/exercise-catalog-api';

export interface ExercisePreviewItem {
  id?: string;
  masterExerciseId?: string | null;
  name: string;
  sets?: number;
  reps?: number | string;
  rpe?: number;
  restSeconds?: number;
  movementPattern?: string;
  muscleGroup?: string;
  targetMuscles?: string[];
  equipment?: string[] | string;
  safetyLevel?: 'safe' | 'caution' | 'avoid' | string;
  safetyNotes?: string;
}

export interface ExercisePreviewModalProps {
  open: boolean;
  exercise: ExercisePreviewItem | null;
  onClose(): void;
  onSwapExercise?(alternative: DirectAlternativeItem): void;
  isSwapping?: boolean;
  userLimitations?: string[];
}

export function ExercisePreviewModal({
  open,
  exercise,
  onClose,
  onSwapExercise,
  isSwapping,
  userLimitations,
}: ExercisePreviewModalProps) {
  const [alternatives, setAlternatives] = useState<DirectAlternativeItem[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);

  const limitationsKey = userLimitations ? userLimitations.join(',') : '';

  useEffect(() => {
    if (!open || !exercise) {
      setAlternatives([]);
      setLoadingAlternatives(false);
      return;
    }

    const exerciseIdentifier = exercise.masterExerciseId || exercise.id || exercise.name;
    if (!exerciseIdentifier) {
      setAlternatives([]);
      setLoadingAlternatives(false);
      return;
    }

    let isMounted = true;
    setLoadingAlternatives(true);

    fetchDirectExerciseAlternatives(
      exerciseIdentifier,
      userLimitations,
      exercise.movementPattern,
      exercise.muscleGroup || exercise.targetMuscles?.[0],
    )
      .then((data) => {
        if (isMounted) {
          setAlternatives(data);
        }
      })
      .catch((error) => {
        console.warn('Failed to fetch direct exercise alternatives:', error);
        if (isMounted) {
          setAlternatives([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoadingAlternatives(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, exercise?.masterExerciseId, exercise?.id, exercise?.name, limitationsKey]);

  if (!exercise) return null;

  const safetyNotes = resolveExerciseSafetyNotes(exercise.name);
  const gear = Array.isArray(exercise.equipment) ? exercise.equipment.join(', ') : exercise.equipment;
  const safety = exercise.safetyLevel || 'safe';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise.name}
      maxWidth="lg"
      footer={
        <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
          Close Preview
        </Button>
      }
    >
      <div className="space-y-4">
        {/* High-res Exercise Visual Display */}
        <div className="overflow-hidden rounded-xl border border-obsidian-700 bg-obsidian-950">
          <ExerciseVisual
            name={exercise.name}
            masterExerciseId={exercise.masterExerciseId || exercise.id}
            movementPattern={exercise.movementPattern}
            muscleGroup={exercise.muscleGroup || exercise.targetMuscles?.[0]}
            showAttribution={true}
          />
        </div>

        {/* Target Metrics Telemetry Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-obsidian-700 bg-obsidian-950 px-3 py-1.5 font-mono text-sm font-extrabold text-white">
            {exercise.sets || 3} × {exercise.reps || 10}
          </span>

          {exercise.rpe && (
            <span className="flex items-center gap-1 rounded-lg border border-volt/30 bg-volt/10 px-3 py-1.5 font-mono text-xs font-bold text-volt">
              <Flame className="h-3.5 w-3.5" />
              Effort: {exercise.rpe}/10
            </span>
          )}

          {exercise.restSeconds !== undefined && (
            <span className="flex items-center gap-1 rounded-lg border border-obsidian-700 bg-obsidian-950 px-3 py-1.5 font-mono text-xs font-semibold text-slate-300">
              <Timer className="h-3.5 w-3.5 text-cyan-400" />
              {exercise.restSeconds}s rest
            </span>
          )}

          <Badge variant={safety === 'avoid' ? 'danger' : safety === 'caution' ? 'amber' : 'volt'}>
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            {safety.toUpperCase()}
          </Badge>
        </div>

        {/* Muscle & Equipment Tags */}
        <div className="flex flex-wrap gap-1.5">
          {exercise.movementPattern && (
            <Badge variant="cyan">{exercise.movementPattern}</Badge>
          )}
          {exercise.muscleGroup && (
            <Badge variant="neutral">{exercise.muscleGroup}</Badge>
          )}
          {exercise.targetMuscles?.map((muscle) => (
            <Badge key={muscle} variant="neutral">
              {muscle}
            </Badge>
          ))}
          {gear && (
            <Badge variant="info">
              <Dumbbell className="mr-1 h-3 w-3" />
              {gear}
            </Badge>
          )}
        </div>

        {/* Clinical Safety & Biomechanical Cues */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-400">
            <ShieldCheck className="h-4 w-4" /> Clinical Biomechanical Form Cues
          </p>
          <ul className="mt-2 space-y-1.5">
            {safetyNotes.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-amber-200">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Direct Biomechanical Substitutions */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zinc-200">
              <ArrowLeftRight className="h-4 w-4 text-lime-400" />
              Direct Biomechanical Substitutions
            </h4>
            {!loadingAlternatives && alternatives.length > 0 && (
              <span className="text-[11px] font-mono text-zinc-400">
                {alternatives.length} {alternatives.length === 1 ? 'option' : 'options'} available
              </span>
            )}
          </div>

          {loadingAlternatives ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 rounded-xl border border-zinc-800/80 bg-[#121722] p-3 animate-pulse"
                >
                  <div className="size-16 shrink-0 rounded-lg bg-zinc-800/80" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 w-1/3 rounded bg-zinc-800/80" />
                    <div className="flex gap-2">
                      <div className="h-4 w-16 rounded bg-zinc-800/60" />
                      <div className="h-4 w-20 rounded bg-zinc-800/60" />
                    </div>
                    <div className="h-3 w-3/4 rounded bg-zinc-800/50" />
                  </div>
                  {onSwapExercise && (
                    <div className="h-9 w-28 shrink-0 rounded-lg bg-zinc-800/80" />
                  )}
                </div>
              ))}
            </div>
          ) : alternatives.length > 0 ? (
            <div className="space-y-2.5">
              {alternatives.map((alt) => (
                <div
                  key={alt.id}
                  data-testid="alternative-card"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-zinc-800/80 bg-[#121722] p-3 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Left thumbnail */}
                    <div className="size-16 shrink-0 overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950 p-1">
                      <ExerciseVisual
                        name={alt.name}
                        masterExerciseId={alt.canonicalId || alt.id}
                        movementPattern={alt.movementPattern}
                        compact={true}
                      />
                    </div>

                    {/* Middle info */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white capitalize truncate">
                          {alt.name}
                        </span>
                        {alt.primaryMuscle && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-lime-400 bg-lime-400/10 border border-lime-400/20 px-1.5 py-0.5 rounded">
                            {alt.primaryMuscle.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {alt.movementPattern && (
                          <Badge variant="cyan" className="text-[10px] px-1.5 py-0.5">
                            {alt.movementPattern.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {alt.equipment && alt.equipment.length > 0 && (
                          <Badge variant="neutral" className="text-[10px] px-1.5 py-0.5">
                            <Dumbbell className="mr-1 h-2.5 w-2.5" />
                            {alt.equipment.join(', ')}
                          </Badge>
                        )}
                      </div>

                      {alt.reason && (
                        <p className="flex items-start gap-1.5 text-xs text-zinc-300 leading-snug">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-lime-400 mt-0.5" />
                          <span>{alt.reason}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right swap button */}
                  {onSwapExercise && (
                    <div className="shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="volt"
                        onClick={() => onSwapExercise(alt)}
                        disabled={isSwapping}
                        data-testid="swap-action-btn"
                        className="font-bold text-xs"
                      >
                        <ArrowLeftRight className="mr-1 h-3.5 w-3.5" /> Swap into Plan
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-4 text-center">
              <p className="text-xs text-zinc-400">
                No direct alternative exercises found for this movement pattern.
              </p>
            </div>
          )}
        </div>

        {/* Specific Plan Notes if any */}
        {exercise.safetyNotes && (
          <div className="rounded-xl border border-obsidian-700 bg-obsidian-950 p-3.5">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Special Guidance</span>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{exercise.safetyNotes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
