import { useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import type { FilterItem } from '../services/exercise-catalog-api';

export interface BodyMapSelectorProps {
  selectedMuscle?: string;
  onSelectMuscle(muscleId: string | undefined): void;
  musclesList?: FilterItem[];
  className?: string;
}

export function BodyMapSelector({
  selectedMuscle,
  onSelectMuscle,
  musclesList = [],
  className = '',
}: BodyMapSelectorProps) {
  const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);

  const getMuscleCount = (muscleKey: string): number => {
    const match = musclesList.find(
      (m) => m.id.toLowerCase() === muscleKey.toLowerCase() || m.name.toLowerCase().includes(muscleKey.toLowerCase())
    );
    return match ? match.count : 0;
  };

  const isSelected = (muscleKey: string): boolean => {
    if (!selectedMuscle) return false;
    const normSelected = selectedMuscle.toLowerCase();
    const normKey = muscleKey.toLowerCase();
    return normSelected === normKey || normSelected.includes(normKey) || normKey.includes(normSelected);
  };

  const handleMuscleClick = (muscleKey: string) => {
    if (isSelected(muscleKey)) {
      onSelectMuscle(undefined);
    } else {
      onSelectMuscle(muscleKey);
    }
  };

  const getPathClass = (muscleKey: string) => {
    const active = isSelected(muscleKey);
    const hovered = hoveredMuscle === muscleKey;

    if (active) {
      return 'fill-lime-400/30 stroke-lime-400 stroke-[2] transition-all duration-200 cursor-pointer filter drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]';
    }
    if (hovered) {
      return 'fill-cyan-400/30 stroke-cyan-400 stroke-[1.5] transition-all duration-150 cursor-pointer';
    }
    return 'fill-zinc-800/80 stroke-zinc-700/60 hover:fill-zinc-700/80 hover:stroke-zinc-500 stroke-[1] transition-all duration-150 cursor-pointer';
  };

  const currentLabel = hoveredMuscle || selectedMuscle;
  const countDisplay = currentLabel ? getMuscleCount(currentLabel) : 0;

  return (
    <div className={`flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 backdrop-blur-md ${className}`}>
      {/* Header & Segmented View Switch */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
            Anatomical Map
          </span>
          {selectedMuscle && (
            <button
              onClick={() => onSelectMuscle(undefined)}
              type="button"
              className="flex items-center gap-1 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400 hover:text-white"
              title="Reset body map selection"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset
            </button>
          )}
        </div>

        {/* View Toggle */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setView('anterior')}
            className={`rounded-md px-2.5 py-1 transition-all ${
              view === 'anterior'
                ? 'bg-lime-400 text-zinc-950 font-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setView('posterior')}
            className={`rounded-md px-2.5 py-1 transition-all ${
              view === 'posterior'
                ? 'bg-lime-400 text-zinc-950 font-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Back
          </button>
        </div>
      </div>

      {/* Anatomical SVG Graphic Canvas */}
      <div className="relative flex min-h-[260px] w-full items-center justify-center rounded-xl border border-zinc-800/50 bg-zinc-950/80 p-2">
        <svg
          viewBox="0 0 200 320"
          className="h-64 w-auto select-none overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base anatomical silhouette outline */}
          <g opacity="0.35" className="stroke-zinc-800 fill-zinc-900/40 stroke-[1]">
            <circle cx="100" cy="28" r="14" /> {/* Head */}
            <path d="M 88 42 L 112 42 L 115 52 L 85 52 Z" /> {/* Neck */}
            <path d="M 68 55 C 68 55, 100 50, 132 55 L 148 135 L 136 138 L 126 80 L 126 150 L 74 150 L 74 80 L 64 138 L 52 135 Z" /> {/* Torso & Arms */}
            <path d="M 74 150 L 126 150 L 132 295 L 116 295 L 108 200 L 100 200 L 92 200 L 84 295 L 68 295 Z" /> {/* Legs */}
          </g>

          {view === 'anterior' ? (
            /* ANTERIOR (FRONT) MUSCLE GROUPS */
            <g id="anterior-muscles">
              {/* Shoulders / Deltoids (Left & Right) */}
              <path
                d="M 64 56 C 58 64, 56 78, 60 88 C 66 84, 72 74, 74 65 Z"
                className={getPathClass('deltoids')}
                onMouseEnter={() => setHoveredMuscle('deltoids')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('deltoids')}
              >
                <title>Deltoids / Shoulders</title>
              </path>
              <path
                d="M 136 56 C 142 64, 144 78, 140 88 C 134 84, 128 74, 126 65 Z"
                className={getPathClass('deltoids')}
                onMouseEnter={() => setHoveredMuscle('deltoids')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('deltoids')}
              >
                <title>Deltoids / Shoulders</title>
              </path>

              {/* Chest / Pectorals */}
              <path
                d="M 76 65 C 88 64, 98 68, 99 78 C 98 90, 84 94, 76 88 C 72 82, 73 72, 76 65 Z"
                className={getPathClass('pectorals')}
                onMouseEnter={() => setHoveredMuscle('pectorals')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('pectorals')}
              >
                <title>Pectoralis Major (Left)</title>
              </path>
              <path
                d="M 124 65 C 112 64, 102 68, 101 78 C 102 90, 116 94, 124 88 C 128 82, 127 72, 124 65 Z"
                className={getPathClass('pectorals')}
                onMouseEnter={() => setHoveredMuscle('pectorals')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('pectorals')}
              >
                <title>Pectoralis Major (Right)</title>
              </path>

              {/* Biceps (Left & Right) */}
              <path
                d="M 58 89 C 55 98, 54 112, 59 120 C 64 116, 66 104, 63 91 Z"
                className={getPathClass('biceps')}
                onMouseEnter={() => setHoveredMuscle('biceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('biceps')}
              >
                <title>Biceps</title>
              </path>
              <path
                d="M 142 89 C 145 98, 146 112, 141 120 C 136 116, 134 104, 137 91 Z"
                className={getPathClass('biceps')}
                onMouseEnter={() => setHoveredMuscle('biceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('biceps')}
              >
                <title>Biceps</title>
              </path>

              {/* Rectus Abdominis / Core */}
              <path
                d="M 88 88 L 112 88 C 113 104, 114 126, 111 144 L 89 144 C 86 126, 87 104, 88 88 Z"
                className={getPathClass('abs')}
                onMouseEnter={() => setHoveredMuscle('abs')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('abs')}
              >
                <title>Abdominals / Core</title>
              </path>

              {/* Quadriceps (Front Thighs) */}
              <path
                d="M 76 156 C 88 155, 96 160, 96 182 C 96 206, 92 228, 86 238 C 78 236, 73 210, 72 185 C 72 170, 74 158, 76 156 Z"
                className={getPathClass('quadriceps')}
                onMouseEnter={() => setHoveredMuscle('quadriceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('quadriceps')}
              >
                <title>Quadriceps (Left)</title>
              </path>
              <path
                d="M 124 156 C 112 155, 104 160, 104 182 C 104 206, 108 228, 114 238 C 122 236, 127 210, 128 185 C 128 170, 126 158, 124 156 Z"
                className={getPathClass('quadriceps')}
                onMouseEnter={() => setHoveredMuscle('quadriceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('quadriceps')}
              >
                <title>Quadriceps (Right)</title>
              </path>

              {/* Calves / Tibialis Anterior (Lower Legs) */}
              <path
                d="M 76 248 C 82 248, 85 258, 84 278 L 76 288 L 74 254 Z"
                className={getPathClass('calves')}
                onMouseEnter={() => setHoveredMuscle('calves')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('calves')}
              >
                <title>Calves / Lower Legs</title>
              </path>
              <path
                d="M 124 248 C 118 248, 115 258, 116 278 L 124 288 L 126 254 Z"
                className={getPathClass('calves')}
                onMouseEnter={() => setHoveredMuscle('calves')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('calves')}
              >
                <title>Calves / Lower Legs</title>
              </path>
            </g>
          ) : (
            /* POSTERIOR (BACK) MUSCLE GROUPS */
            <g id="posterior-muscles">
              {/* Trapezius / Upper Back */}
              <path
                d="M 88 46 L 112 46 L 126 62 L 100 88 L 74 62 Z"
                className={getPathClass('traps')}
                onMouseEnter={() => setHoveredMuscle('traps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('traps')}
              >
                <title>Trapezius / Upper Back</title>
              </path>

              {/* Latissimus Dorsi (Lats) */}
              <path
                d="M 72 68 L 96 90 L 96 122 L 78 116 C 73 98, 70 82, 72 68 Z"
                className={getPathClass('lats')}
                onMouseEnter={() => setHoveredMuscle('lats')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('lats')}
              >
                <title>Latissimus Dorsi (Left)</title>
              </path>
              <path
                d="M 128 68 L 104 90 L 104 122 L 122 116 C 127 98, 130 82, 128 68 Z"
                className={getPathClass('lats')}
                onMouseEnter={() => setHoveredMuscle('lats')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('lats')}
              >
                <title>Latissimus Dorsi (Right)</title>
              </path>

              {/* Triceps (Rear Arms) */}
              <path
                d="M 58 78 C 55 90, 54 106, 58 116 C 62 112, 65 98, 64 82 Z"
                className={getPathClass('triceps')}
                onMouseEnter={() => setHoveredMuscle('triceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('triceps')}
              >
                <title>Triceps (Left)</title>
              </path>
              <path
                d="M 142 78 C 145 90, 146 106, 142 116 C 138 112, 135 98, 136 82 Z"
                className={getPathClass('triceps')}
                onMouseEnter={() => setHoveredMuscle('triceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('triceps')}
              >
                <title>Triceps (Right)</title>
              </path>

              {/* Lower Back / Lumbar */}
              <path
                d="M 88 124 L 112 124 L 110 146 L 90 146 Z"
                className={getPathClass('lower back')}
                onMouseEnter={() => setHoveredMuscle('lower back')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('lower back')}
              >
                <title>Lower Back (Lumbar)</title>
              </path>

              {/* Glutes (Gluteus Maximus) */}
              <path
                d="M 76 150 C 88 148, 98 152, 98 174 C 98 188, 86 196, 75 192 C 72 178, 73 162, 76 150 Z"
                className={getPathClass('glutes')}
                onMouseEnter={() => setHoveredMuscle('glutes')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('glutes')}
              >
                <title>Gluteus Maximus (Left)</title>
              </path>
              <path
                d="M 124 150 C 112 148, 102 152, 102 174 C 102 188, 114 196, 125 192 C 128 178, 127 162, 124 150 Z"
                className={getPathClass('glutes')}
                onMouseEnter={() => setHoveredMuscle('glutes')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('glutes')}
              >
                <title>Gluteus Maximus (Right)</title>
              </path>

              {/* Hamstrings (Back Thighs) */}
              <path
                d="M 75 196 C 86 198, 96 196, 96 220 C 94 236, 84 240, 76 238 C 73 226, 73 210, 75 196 Z"
                className={getPathClass('hamstrings')}
                onMouseEnter={() => setHoveredMuscle('hamstrings')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('hamstrings')}
              >
                <title>Hamstrings (Left)</title>
              </path>
              <path
                d="M 125 196 C 114 198, 104 196, 104 220 C 106 236, 116 240, 124 238 C 127 226, 127 210, 125 196 Z"
                className={getPathClass('hamstrings')}
                onMouseEnter={() => setHoveredMuscle('hamstrings')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('hamstrings')}
              >
                <title>Hamstrings (Right)</title>
              </path>

              {/* Calves (Gastrocnemius) */}
              <path
                d="M 74 248 C 84 246, 88 258, 86 280 L 76 290 L 72 256 Z"
                className={getPathClass('calves')}
                onMouseEnter={() => setHoveredMuscle('calves')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('calves')}
              >
                <title>Calves (Left)</title>
              </path>
              <path
                d="M 126 248 C 116 246, 112 258, 114 280 L 124 290 L 128 256 Z"
                className={getPathClass('calves')}
                onMouseEnter={() => setHoveredMuscle('calves')}
                onMouseLeave={() => setHoveredMuscle(null)}
                onClick={() => handleMuscleClick('calves')}
              >
                <title>Calves (Right)</title>
              </path>
            </g>
          )}
        </svg>

        {/* Hover/Selection Telemetry Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/90 px-2.5 py-1 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-zinc-200 capitalize">
            <Sparkles className="h-3 w-3 text-lime-400" />
            {currentLabel ? currentLabel.replace(/_/g, ' ') : 'Select a muscle group'}
          </span>
          {currentLabel && (
            <span className="font-mono text-[11px] font-extrabold text-lime-400">
              {countDisplay > 0 ? `${countDisplay} exercises` : 'Filtered'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
