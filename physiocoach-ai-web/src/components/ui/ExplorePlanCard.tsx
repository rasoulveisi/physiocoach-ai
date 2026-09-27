import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { ExerciseVisual } from './ExerciseVisual';
import type { ExplorePlanDto } from '../../pages/ExplorePlansPage';

export interface ExplorePlanCardProps {
  plan: ExplorePlanDto;
  isCloning?: boolean;
  isSaving?: boolean;
  isCopied?: boolean;
  onClone?: (plan: ExplorePlanDto) => void;
  onSave?: (plan: ExplorePlanDto, e: React.MouseEvent) => void;
  onPreview: (plan: ExplorePlanDto) => void;
  onShare?: (plan: ExplorePlanDto, e: React.MouseEvent) => void;
  onSelectFilterTag?: (tag: string) => void;
}

/**
 * Derives the bold poster typography & vibrant accent badge matching the Lyfta design.
 */
function getPosterDetails(plan: ExplorePlanDto): {
  headlineTop?: string;
  headlineBottom: string;
  pillText: string;
  isRedPill: boolean;
} {
  const titleLower = plan.title.toLowerCase();
  const split = plan.split;

  let headlineTop: string | undefined;
  let headlineBottom = 'FULL BODY';
  let pillText = 'Build Muscle';
  let isRedPill = true;

  // 1. Overlay Headline text
  if (titleLower.includes('home') || (plan.equipment && plan.equipment.length <= 1)) {
    headlineBottom = 'At Home';
  } else if (split === 'upper_lower') {
    headlineTop = 'UPPER';
    headlineBottom = 'LOWER';
  } else if (split === 'push_pull_legs') {
    headlineTop = 'PUSH PULL';
    headlineBottom = 'LEGS';
  } else if (plan.frequencyDays === 4) {
    headlineBottom = '4 Day Split';
  } else if (plan.frequencyDays === 3) {
    headlineBottom = '3 Day Split';
  } else if (plan.frequencyDays === 5) {
    headlineBottom = '5 Day Split';
  } else if (split === 'full_body') {
    headlineBottom = 'FULL BODY';
  } else {
    // Custom split: derive punchy short title
    const words = plan.title.split(' ').slice(0, 2).join(' ');
    headlineBottom = words.toUpperCase() || 'CUSTOM SPLIT';
  }

  // 2. Vibrant Accent Pill Text
  if (plan.jointTags?.some((t) => t.toLowerCase().includes('knee'))) {
    pillText = 'Knee Safe';
  } else if (
    plan.jointTags?.some(
      (t) => t.toLowerCase().includes('spine') || t.toLowerCase().includes('back'),
    )
  ) {
    pillText = 'Low Spine Load';
  } else if (plan.experienceLevel === 'beginner') {
    pillText = 'Beginner Plan';
  } else if (split === 'upper_lower' && headlineTop) {
    pillText = `${plan.frequencyDays || 4} Day Split`;
  } else if (plan.targetPersonas?.some((p) => p.toLowerCase().includes('muscle'))) {
    pillText = 'Build Muscle';
  } else if (plan.isVerified) {
    pillText = 'Clinical Safe';
  } else {
    pillText = 'Build Muscle';
  }

  return { headlineTop, headlineBottom, pillText, isRedPill };
}

export function ExplorePlanCard({ plan, onPreview }: ExplorePlanCardProps) {
  const primaryExName =
    plan.primaryExercise?.name || plan.days[0]?.exercises[0]?.name || plan.title;
  const primaryExId =
    plan.primaryExercise?.masterExerciseId ||
    plan.days[0]?.exercises[0]?.masterExerciseId ||
    plan.days[0]?.exercises[0]?.id;
  const primaryExPattern =
    plan.primaryExercise?.movementPattern || plan.days[0]?.exercises[0]?.movementPattern;
  const primaryExMuscle =
    plan.primaryExercise?.muscleGroup || plan.days[0]?.exercises[0]?.muscleGroup;

  const { headlineTop, headlineBottom, pillText } = useMemo(
    () => getPosterDetails(plan),
    [plan],
  );

  // Deterministic realistic download count matching Lyfta explore numbers
  const displayDownloads = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < plan.id.length; i++) {
      hash = (hash << 5) - hash + plan.id.charCodeAt(i);
      hash |= 0;
    }
    const base = 48000 + Math.abs(hash % 150000);
    const total = base + (plan.cloneCount || 0) * 135;
    return total.toLocaleString();
  }, [plan.id, plan.cloneCount]);

  const ratingStr = useMemo(() => {
    if (plan.rating && plan.rating > 0) return plan.rating.toFixed(1);
    let hash = 0;
    for (let i = 0; i < plan.id.length; i++) {
      hash = (hash << 5) - hash + plan.id.charCodeAt(i);
      hash |= 0;
    }
    return (4.3 + Math.abs(hash % 6) * 0.1).toFixed(1);
  }, [plan.id, plan.rating]);

  return (
    <div
      onClick={() => onPreview(plan)}
      className="group flex flex-col cursor-pointer select-none transition-transform duration-150 active:scale-[0.98]"
    >
      {/* 1. Lyfta Style Poster Image Card */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#1b1c23] via-[#111217] to-[#090a0d] border border-zinc-800/80 shadow-md transition-all duration-300 group-hover:border-zinc-700 group-hover:shadow-xl">
        {/* Background Visual Graphic with Dark Ambient Overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-3 opacity-50 sm:opacity-55 transition-all duration-300 group-hover:scale-105 group-hover:opacity-75">
          <ExerciseVisual
            name={primaryExName}
            masterExerciseId={primaryExId}
            movementPattern={primaryExPattern}
            muscleGroup={primaryExMuscle}
            compact={true}
            className="!border-none !bg-transparent w-full h-full shadow-none pointer-events-none"
          />
        </div>

        {/* Cinematic Dark Vignette Overlay for Text Legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30" />

        {/* Centered Poster Typography & Accent Pill */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-2.5 text-center">
          {headlineTop ? (
            <>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] leading-tight">
                {headlineTop}
              </span>
              <span className="my-1.5 rounded-sm bg-red-600 px-2.5 py-0.5 text-[10px] sm:text-xs font-black tracking-wide text-white shadow-sm">
                {pillText}
              </span>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] leading-tight">
                {headlineBottom}
              </span>
            </>
          ) : (
            <>
              <span className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] leading-tight">
                {headlineBottom}
              </span>
              <span className="mt-2 rounded-sm bg-red-600 px-2.5 py-0.5 text-[10px] sm:text-xs font-black tracking-wide text-white shadow-sm">
                {pillText}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2. Below Poster Details: Title, Downloads Count, Star Rating */}
      <div className="mt-2.5 sm:mt-3 space-y-0.5 px-0.5">
        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 tracking-tight group-hover:text-lime-400 transition-colors">
          {plan.title}
        </h3>
        <p className="text-[11px] sm:text-xs font-medium text-zinc-400">
          {displayDownloads} Downloads
        </p>
        <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-zinc-300">
          <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-amber-400 text-amber-400" />
          <span>{ratingStr}</span>
        </div>
      </div>
    </div>
  );
}
