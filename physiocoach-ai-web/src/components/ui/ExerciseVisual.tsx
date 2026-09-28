import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dumbbell, Maximize2, X } from 'lucide-react';
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
  imageClassName?: string;
  fit?: 'contain' | 'cover';
  showAttribution?: boolean;
  allowFullscreen?: boolean;
}

export function ExerciseVisual({
  name,
  masterExerciseId,
  movementPattern,
  muscleGroup,
  media,
  compact = false,
  className = '',
  imageClassName = '',
  fit = 'contain',
  showAttribution = false,
  allowFullscreen = true,
}: ExerciseVisualProps) {
  const [errorCount, setErrorCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const handleOpenFullscreen = (e: React.MouseEvent) => {
    if (!allowFullscreen) return;
    e.stopPropagation();
    e.preventDefault();
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = (e: React.MouseEvent | React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFullscreen(false);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  const attributionText = visual.media?.attributionText || visual.media?.source || '';

  const fullscreenModal =
    isFullscreen &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name} full image view`}
        onClick={handleCloseFullscreen}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-black/92 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 select-none cursor-zoom-out"
      >
        {/* Top Header Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full max-w-xl flex items-center justify-between gap-3 text-white pt-2 cursor-default"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-white capitalize truncate">
              {name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {muscleGroup && (
                <span className="rounded-md bg-[#10E760]/20 border border-[#10E760]/30 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#10E760]">
                  {muscleGroup.replace(/_/g, ' ')}
                </span>
              )}
              {movementPattern && (
                <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300">
                  {movementPattern.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseFullscreen}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="size-10 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center shrink-0 shadow-lg cursor-pointer"
            title="Close (ESC)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Image Viewport (Big crisp white frame with drop shadow) */}
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="relative my-auto flex items-center justify-center overflow-hidden rounded-3xl bg-white p-4 sm:p-8 shadow-2xl border border-zinc-700/60 max-h-[70vh] sm:max-h-[75vh] w-auto max-w-[92vw] sm:max-w-lg aspect-square cursor-default"
        >
          <img
            src={currentSrc}
            alt={name}
            className="h-full w-full object-contain"
          />
        </div>

        {/* Footer Details / Close Hint */}
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full max-w-xl text-center pb-2 flex flex-col items-center gap-1 text-zinc-400 cursor-default"
        >
          {attributionText && (
            <p className="text-[11px] font-mono text-zinc-400">
              {attributionText}
            </p>
          )}
          <p className="text-[10px] font-mono text-zinc-500">
            Tap outside or press ESC to close
          </p>
        </div>
      </div>,
      document.body,
    );

  if (compact) {
    return (
      <>
        <div
          onClick={allowFullscreen ? handleOpenFullscreen : undefined}
          className={`relative flex h-full w-full items-center justify-center overflow-hidden group/visual ${
            allowFullscreen ? 'cursor-zoom-in' : ''
          } ${className}`}
          title={allowFullscreen ? `Click to enlarge ${name}` : name}
        >
          <img
            src={currentSrc}
            alt={name}
            onError={handleError}
            onLoad={handleLoad}
            className={`h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'} transition-all duration-200 ${
              loaded ? 'opacity-100 group-hover/visual:scale-105' : 'opacity-0'
            } ${imageClassName}`}
            loading="lazy"
          />
          {!loaded && (
            <div className="absolute inset-0 grid place-items-center bg-zinc-900">
              <Dumbbell className="h-5 w-5 text-zinc-600 animate-pulse" />
            </div>
          )}
          {allowFullscreen && (
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/visual:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <div className="size-6 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center justify-center shadow-md">
                <Maximize2 className="h-3 w-3 text-white" />
              </div>
            </div>
          )}
        </div>
        {fullscreenModal}
      </>
    );
  }

  return (
    <>
      <div
        className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-2 sm:p-3 ${className}`}
      >
        <div
          onClick={allowFullscreen ? handleOpenFullscreen : undefined}
          className={`relative flex aspect-square sm:aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-xl bg-zinc-950/40 group/visual ${
            allowFullscreen ? 'cursor-zoom-in' : ''
          }`}
          title={allowFullscreen ? `Click to enlarge ${name}` : name}
        >
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-lime-400 border-r-transparent" />
            </div>
          )}
          <img
            src={currentSrc}
            alt={name}
            onError={handleError}
            onLoad={handleLoad}
            className={`h-full w-full object-contain p-2 transition-all duration-300 ${
              loaded ? 'scale-100 opacity-100 group-hover/visual:scale-105' : 'scale-95 opacity-0'
            }`}
          />
          {allowFullscreen && (
            <div className="absolute bottom-2 right-2 size-7 rounded-xl bg-black/60 backdrop-blur-sm text-zinc-300 group-hover/visual:text-white transition-colors flex items-center justify-center shadow-md border border-white/10 pointer-events-none">
              <Maximize2 className="h-3.5 w-3.5" />
            </div>
          )}
        </div>

        {showAttribution && attributionText && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
            <span>{attributionText}</span>
          </div>
        )}
      </div>
      {fullscreenModal}
    </>
  );
}
