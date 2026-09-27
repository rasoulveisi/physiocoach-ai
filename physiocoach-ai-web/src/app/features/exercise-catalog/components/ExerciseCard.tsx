import { Eye, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
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
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-[#121826] via-[#0d121e] to-[#080b13] p-3 sm:p-3.5 shadow-lg transition-all duration-300 hover:border-lime-400/50 hover:bg-[#141b2b] hover:shadow-[0_0_25px_rgba(16,231,96,0.08)] cursor-pointer"
    >
      <div>
        {/* Visual Thumbnail Area */}
        <div className="relative mb-2.5 aspect-square sm:aspect-[4/3] w-full overflow-hidden rounded-xl sm:rounded-2xl border border-zinc-800/70 bg-gradient-to-br from-[#162136] via-[#0e1422] to-[#090c14] flex items-center justify-center">
          <ExerciseVisual
            name={exercise.name}
            masterExerciseId={exercise.canonicalId || exercise.id}
            movementPattern={exercise.movementPattern}
            muscleGroup={exercise.primaryMuscle}
            compact={true}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105 pointer-events-none"
          />

          {/* Top Badges */}
          <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-none z-10">
            {/* Primary Muscle Badge */}
            <span className="rounded-full bg-zinc-950/85 border border-zinc-800/90 px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider text-lime-400 backdrop-blur-md">
              {exercise.primaryMuscle.replace(/_/g, ' ')}
            </span>

            {/* Safety Rating */}
            {isAvoid ? (
              <span className="flex items-center gap-1 rounded-full bg-rose-950/90 border border-rose-500/40 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-rose-400 backdrop-blur-md">
                <ShieldAlert className="h-3 w-3" /> Avoid
              </span>
            ) : isCaution ? (
              <span className="flex items-center gap-1 rounded-full bg-amber-950/90 border border-amber-500/40 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-amber-400 backdrop-blur-md">
                <ShieldAlert className="h-3 w-3" /> Caution
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-400 backdrop-blur-md">
                <ShieldCheck className="h-3 w-3" /> Safe
              </span>
            )}
          </div>

          {/* Bottom Highlight Tag */}
          {highlightTag && (
            <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
              <span className="flex items-center gap-1 rounded-lg border border-lime-400/30 bg-zinc-950/90 px-2 py-0.5 text-[9px] font-bold text-lime-400 backdrop-blur-md">
                <Sparkles className="h-2.5 w-2.5" /> {highlightTag}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-1 text-xs sm:text-sm font-extrabold text-white transition-colors group-hover:text-lime-400 tracking-tight">
          {exercise.name}
        </h3>

        {/* Equipment & Pattern subtitle */}
        <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-zinc-400">
          <span className="capitalize">{exercise.movementPattern.replace(/_/g, ' ')}</span>
          {exercise.equipment?.length > 0 && (
            <>
              <span className="text-zinc-600 font-sans">•</span>
              <span className="truncate">{exercise.equipment[0]}</span>
            </>
          )}
        </div>
      </div>

      {/* Footer Details Action Bar */}
      <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-zinc-800/70 pt-2 text-[11px]">
        <span className="text-zinc-500 font-mono text-[10px] capitalize">
          {exercise.recommendedLevel || 'All levels'}
        </span>

        <span className="flex items-center gap-1 font-bold text-lime-400 text-[11px] group-hover:translate-x-0.5 transition-transform">
          <Eye className="h-3 w-3" />
          <span>Details</span>
        </span>
      </div>
    </div>
  );
}
