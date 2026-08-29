import { Dumbbell, Eye, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { ExerciseVisual } from '../../../../components/ui/ExerciseVisual';
import type { CatalogExerciseItem } from '../services/exercise-catalog-api';

export interface ExerciseCardProps {
  exercise: CatalogExerciseItem;
  onSelect(exercise: CatalogExerciseItem): void;
}

export function ExerciseCard({ exercise, onSelect }: ExerciseCardProps) {
  const isCaution = exercise.safetySummary?.overallRating === 'caution';
  const isAvoid = exercise.safetySummary?.overallRating === 'avoid';
  const highlightTag = exercise.safetySummary?.highlightTags?.[0];

  return (
    <div
      onClick={() => onSelect(exercise)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 transition-all duration-200 hover:-translate-y-1 hover:border-lime-400/40 hover:bg-zinc-900/95 hover:shadow-lg hover:shadow-lime-400/5 cursor-pointer backdrop-blur-sm"
    >
      <div>
        {/* Visual Thumbnail Area */}
        <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950">
          <ExerciseVisual
            name={exercise.name}
            masterExerciseId={exercise.canonicalId || exercise.id}
            movementPattern={exercise.movementPattern}
            muscleGroup={exercise.primaryMuscle}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Level Badge Overlay */}
          <div className="absolute top-2 right-2">
            <span className="rounded-md border border-zinc-700/60 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 backdrop-blur-sm">
              {exercise.recommendedLevel || 'All Levels'}
            </span>
          </div>

          {/* Safety Tag Chip Overlay */}
          {highlightTag && (
            <div className="absolute bottom-2 left-2">
              <span className="flex items-center gap-1 rounded-md border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-400 backdrop-blur-sm">
                <ShieldCheck className="h-3 w-3" />
                {highlightTag}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-1 text-sm font-extrabold text-white transition-colors group-hover:text-lime-400">
          {exercise.name}
        </h3>

        {/* Badges Bar */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="cyan" className="text-[10px] py-0.5 px-2 capitalize">
            {exercise.movementPattern.replace(/_/g, ' ')}
          </Badge>
          <Badge variant="neutral" className="text-[10px] py-0.5 px-2 capitalize">
            {exercise.primaryMuscle.replace(/_/g, ' ')}
          </Badge>
          {exercise.equipment?.length > 0 && (
            <span className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              <Dumbbell className="h-2.5 w-2.5" />
              {exercise.equipment[0]}
            </span>
          )}
        </div>
      </div>

      {/* Footer Details Action Bar */}
      <div className="mt-3.5 flex items-center justify-between border-t border-zinc-800/60 pt-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
          {isAvoid ? (
            <span className="flex items-center gap-1 font-bold text-rose-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              Avoid
            </span>
          ) : isCaution ? (
            <span className="flex items-center gap-1 font-bold text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              Caution
            </span>
          ) : (
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Joint Safe
            </span>
          )}
        </div>

        <span className="flex items-center gap-1 font-mono text-[11px] font-bold text-lime-400 group-hover:underline">
          <Eye className="h-3 w-3" />
          Preview
        </span>
      </div>
    </div>
  );
}
