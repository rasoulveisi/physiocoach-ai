import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import {
  resolveExerciseVisual,
  type ExerciseImageMedia,
} from '../../services/exercise-visual-resolver';

export interface ExerciseVisualProps {
  name: string;
  masterExerciseId?: string | null;
  movementPattern?: string | null;
  muscleGroup?: string | null;
  media?: ExerciseImageMedia | null;
  compact?: boolean;
  className?: string;
  showAttribution?: boolean;
}

export function ExerciseVisual({
  name,
  masterExerciseId,
  movementPattern,
  muscleGroup,
  media,
  compact = false,
  className = '',
  showAttribution = false,
}: ExerciseVisualProps) {
  const [errorCount, setErrorCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const visual = resolveExerciseVisual({
    name,
    masterExerciseId,
    movementPattern,
    muscleGroup,
    media,
  });

  const currentSrc =
    errorCount === 0 ? visual.url : visual.fallbackUrl || '/images/exercises/fallback.webp';

  const handleError = () => {
    setErrorCount((prev) => prev + 1);
  };

  const handleLoad = () => {
    setLoaded(true);
  };

  const attributionText = visual.media?.attributionText || visual.media?.source || '';

  if (compact) {
    return (
      <div
        className={`relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 p-1 ${className}`}
      >
        <img
          src={currentSrc}
          alt={name}
          onError={handleError}
          onLoad={handleLoad}
          className={`h-full w-full object-contain transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
        />
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center">
            <Dumbbell className="h-5 w-5 text-zinc-600" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 p-3 sm:p-4 ${className}`}
    >
      <div className="relative flex aspect-video w-full max-w-lg items-center justify-center overflow-hidden rounded-lg bg-zinc-950">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-lime-400 border-r-transparent" />
          </div>
        )}
        <img
          src={currentSrc}
          alt={name}
          onError={handleError}
          onLoad={handleLoad}
          className={`max-h-full max-w-full object-contain transition-all duration-300 ${
            loaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        />
      </div>

      {showAttribution && attributionText && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
          <span>{attributionText}</span>
        </div>
      )}
    </div>
  );
}
