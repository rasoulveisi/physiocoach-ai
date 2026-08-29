import { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Dumbbell,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ExerciseVisual } from '../../../../components/ui/ExerciseVisual';
import {
  fetchExerciseDetail,
  type CatalogExerciseItem,
  type ExerciseDetailItem,
} from '../services/exercise-catalog-api';

export interface ExerciseDetailModalProps {
  open: boolean;
  exercise: CatalogExerciseItem | null;
  onClose(): void;
  onSelectAlternative?(exerciseId: string, exerciseName: string): void;
}

export function ExerciseDetailModal({
  open,
  exercise,
  onClose,
  onSelectAlternative,
}: ExerciseDetailModalProps) {
  const [detail, setDetail] = useState<ExerciseDetailItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open || !exercise) {
      setDetail(null);
      return;
    }

    let active = true;
    setLoading(true);

    fetchExerciseDetail(exercise.id)
      .then((data) => {
        if (active) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch detailed exercise cues:', err);
        if (active) {
          // Fallback to basic exercise info
          setDetail({
            ...exercise,
            instructions: [
              'Assume a balanced athletic stance with neutral spine posture.',
              'Initiate movement through the primary target muscles under control.',
              'Complete the full range of motion while maintaining joint alignment.',
            ],
            safetyConsiderations: [],
            saferAlternatives: [],
          });
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, exercise]);

  if (!open || !exercise) return null;

  const currentData = detail || exercise;
  const isAvoid = exercise.safetySummary?.overallRating === 'avoid';
  const isCaution = exercise.safetySummary?.overallRating === 'caution';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise.name}
      maxWidth="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="font-mono text-xs text-zinc-500">
            ID: {exercise.canonicalId || exercise.id}
          </span>
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Close Preview
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* High-res Animated Exercise Visual Display */}
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <ExerciseVisual
            name={exercise.name}
            masterExerciseId={exercise.canonicalId || exercise.id}
            movementPattern={exercise.movementPattern}
            muscleGroup={exercise.primaryMuscle}
            showAttribution={true}
          />
        </div>

        {/* Telemetry Chips Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="cyan" className="font-bold uppercase tracking-wider text-xs">
            <Activity className="mr-1 h-3.5 w-3.5" />
            {exercise.movementPattern.replace(/_/g, ' ')}
          </Badge>

          <Badge variant="neutral" className="font-bold capitalize text-xs">
            <Dumbbell className="mr-1 h-3.5 w-3.5" />
            {exercise.primaryMuscle.replace(/_/g, ' ')}
          </Badge>

          <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-xs font-bold text-zinc-300">
            {exercise.recommendedLevel || 'All Levels'}
          </span>

          <Badge
            variant={isAvoid ? 'danger' : isCaution ? 'amber' : 'volt'}
            className="text-xs font-bold"
          >
            {isAvoid ? (
              <ShieldAlert className="mr-1 h-3.5 w-3.5" />
            ) : isCaution ? (
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            ) : (
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            )}
            {isAvoid ? 'CONTRAINDICATED' : isCaution ? 'CAUTION' : 'JOINT SAFE'}
          </Badge>
        </div>

        {/* Secondary Muscles & Equipment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Equipment Required
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {exercise.equipment?.map((eqItem) => (
                <span
                  key={eqItem}
                  className="rounded-md border border-zinc-700/60 bg-zinc-800/80 px-2 py-0.5 text-xs font-bold text-zinc-200 capitalize"
                >
                  {eqItem.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Secondary Muscle Synergists
            </span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {exercise.secondaryMuscles?.length > 0 ? (
                exercise.secondaryMuscles.map((muscle) => (
                  <span
                    key={muscle}
                    className="rounded-md border border-zinc-700/60 bg-zinc-800/80 px-2 py-0.5 text-xs font-bold text-zinc-200 capitalize"
                  >
                    {muscle.replace(/_/g, ' ')}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-500">None specified</span>
              )}
            </div>
          </div>
        </div>

        {/* Step-by-Step Physio Execution Cues */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
          <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-lime-400">
            <Sparkles className="h-4 w-4" />
            Physio Execution & Form Cues
          </h4>

          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
            </div>
          ) : (
            <ol className="mt-3 space-y-2.5 text-xs text-zinc-300">
              {detail?.instructions && detail.instructions.length > 0 ? (
                detail.instructions.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400/20 font-mono text-[11px] font-black text-lime-400">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))
              ) : (
                <li className="text-zinc-500">Execute with strict form and full range of motion.</li>
              )}
            </ol>
          )}
        </div>

        {/* Biomechanical Safety Considerations */}
        {detail?.safetyConsiderations && detail.safetyConsiderations.length > 0 && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
            <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400">
              <ShieldAlert className="h-4 w-4" />
              Joint-Specific Considerations
            </h4>

            <div className="mt-3 space-y-2">
              {detail.safetyConsiderations.map((sc, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-200">{sc.displayName}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-mono uppercase text-amber-400 bg-amber-400/10 border border-amber-400/30 font-bold">
                      {sc.rating || sc.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-400">{sc.reason}</p>
                  {sc.requiredModification && (
                    <p className="mt-1 font-mono text-[11px] text-lime-400">
                      Tip: {sc.requiredModification}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 1-Click Safer Alternatives */}
        {detail?.saferAlternatives && detail.saferAlternatives.length > 0 && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4">
            <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-zinc-300">
              <ArrowRightLeft className="h-4 w-4 text-cyan-400" />
              Safer Movement Alternatives
            </h4>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {detail.saferAlternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 transition-all hover:border-cyan-400/50"
                >
                  <div>
                    <h5 className="font-bold text-white text-xs">{alt.name}</h5>
                    <p className="text-[11px] text-zinc-400">{alt.reason}</p>
                  </div>

                  {onSelectAlternative && (
                    <button
                      onClick={() => onSelectAlternative(alt.id, alt.name)}
                      type="button"
                      className="ml-2 shrink-0 rounded-lg bg-cyan-400/10 border border-cyan-400/30 px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-400 hover:text-zinc-950 transition-colors"
                    >
                      Swap
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
