import { Eye, ShieldAlert } from 'lucide-react';
import { ExerciseVisual } from '../../../../components/ui/ExerciseVisual';
import type { CatalogExerciseItem } from '../services/exercise-catalog-api';

export interface ExerciseCardProps {
  exercise: CatalogExerciseItem;
  onSelect(exercise: CatalogExerciseItem): void;
}

export function ExerciseCard({ exercise, onSelect }: ExerciseCardProps) {
  const isCaution = exercise.safetySummary?.overallRating === 'caution';
  const isAvoid = exercise.safetySummary?.overallRating === 'avoid';

  const rawEquipment = exercise.equipment?.[0] || '';
  const equipmentLabel = rawEquipment.replace(/_/g, ' ');

  return (
    <div
      onClick={() => onSelect(exercise)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-[#121826] via-[#0d121e] to-[#080b13] p-3 sm:p-3.5 shadow-lg transition-all duration-300 hover:border-lime-400/50 hover:bg-[#141b2b] hover:shadow-[0_0_25px_rgba(16,231,96,0.08)] cursor-pointer"
    >
      <div>
        {/* Visual Thumbnail Area - Full White Frame with Zero Cut-Offs */}
        <div className="relative mb-2.5 aspect-square w-full overflow-hidden rounded-xl sm:rounded-2xl border border-zinc-700/60 bg-white p-2 flex items-center justify-center shadow-inner">
          <ExerciseVisual
            name={exercise.name}
            masterExerciseId={exercise.canonicalId || exercise.id}
            movementPattern={exercise.movementPattern}
            muscleGroup={exercise.primaryMuscle}
            compact={true}
            fit="contain"
            className="h-full w-full"
          />

          {/* Safety Warning (Only displayed for Caution or Avoid to eliminate visual noise on 95%+ of cards) */}
          {isAvoid ? (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-rose-600 text-white px-2 py-0.5 text-[9px] font-bold shadow-md pointer-events-none">
              <ShieldAlert className="h-2.5 w-2.5" /> Avoid
            </span>
          ) : isCaution ? (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-amber-500 text-zinc-950 px-2 py-0.5 text-[9px] font-bold shadow-md pointer-events-none">
              <ShieldAlert className="h-2.5 w-2.5" /> Caution
            </span>
          ) : null}
        </div>

        {/* Title - 2 lines max with proper title casing */}
        <h3
          className="line-clamp-2 text-xs sm:text-sm font-extrabold text-white transition-colors group-hover:text-lime-400 tracking-tight leading-snug min-h-[2rem] capitalize"
          title={exercise.name}
        >
          {exercise.name}
        </h3>

        {/* Muscle & Equipment Subtitle (e.g., Chest • Barbell) */}
        <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-zinc-400 truncate">
          <span className="text-lime-400 font-bold capitalize">
            {exercise.primaryMuscle.replace(/_/g, ' ')}
          </span>
          {equipmentLabel && (
            <>
              <span className="text-zinc-600 font-sans">•</span>
              <span className="truncate text-zinc-400 capitalize">{equipmentLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Footer Details Action Bar */}
      <div className="mt-2 sm:mt-2.5 flex items-center justify-between border-t border-zinc-800/70 pt-2 text-[11px]">
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
