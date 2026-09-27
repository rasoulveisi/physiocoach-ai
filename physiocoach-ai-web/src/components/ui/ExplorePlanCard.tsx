import React, { useMemo } from 'react';
import {
  BookmarkPlus,
  Check,
  Dumbbell,
  Eye,
  GitFork,
  Globe,
  Share2,
  ShieldCheck,
  Star,
  Zap,
} from 'lucide-react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';
import { ExerciseVisual } from './ExerciseVisual';
import { getPersonaColorClasses } from '../../services/persona-matcher';
import type { ExplorePlanDto } from '../../pages/ExplorePlansPage';

export interface ExplorePlanCardProps {
  plan: ExplorePlanDto;
  isCloning?: boolean;
  isSaving?: boolean;
  isCopied?: boolean;
  onClone: (plan: ExplorePlanDto) => void;
  onSave: (plan: ExplorePlanDto, e: React.MouseEvent) => void;
  onPreview: (plan: ExplorePlanDto) => void;
  onShare: (plan: ExplorePlanDto, e: React.MouseEvent) => void;
  onSelectFilterTag?: (tag: string) => void;
}

/**
 * Deduplicate and prioritize high-signal tags to prevent badge explosion.
 * Suppresses substrings (e.g. "Knee-Friendly" when "Knee-Friendly Hypertrophy" exists).
 */
function getCuratedTags(personas: string[] = [], jointTags: string[] = []): {
  visibleTags: string[];
  remainingCount: number;
  allRemaining: string[];
} {
  const combined = Array.from(new Set([...personas, ...jointTags])).filter(Boolean);

  // Filter out redundant sub-strings
  const uniqueTags = combined.filter((tag, idx) => {
    const lower = tag.toLowerCase().trim();
    return !combined.some(
      (other, oIdx) =>
        idx !== oIdx &&
        other.toLowerCase().trim() !== lower &&
        other.toLowerCase().includes(lower),
    );
  });

  const visibleTags = uniqueTags.slice(0, 2);
  const allRemaining = uniqueTags.slice(2);

  return {
    visibleTags,
    remainingCount: allRemaining.length,
    allRemaining,
  };
}

export function ExplorePlanCard({
  plan,
  isCloning = false,
  isSaving = false,
  isCopied = false,
  onClone,
  onSave,
  onPreview,
  onShare,
  onSelectFilterTag,
}: ExplorePlanCardProps) {
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

  const { visibleTags, remainingCount, allRemaining } = useMemo(
    () => getCuratedTags(plan.targetPersonas, plan.jointTags),
    [plan.targetPersonas, plan.jointTags],
  );

  const formattedSplit = plan.split ? plan.split.replace(/_/g, ' ') : 'Custom';
  const ratingFormatted = plan.rating ? plan.rating.toFixed(1) : '5.0';

  return (
    <div
      onClick={() => onPreview(plan)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-zinc-800/90 bg-[#121722] p-4 sm:p-5 shadow-xl transition-all duration-200 hover:border-lime-400/40 hover:bg-[#141b27] cursor-pointer"
    >
      <div className="space-y-3">
        {/* 1. Clean Hero Visual Banner (Uncluttered) */}
        <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-[#0a0f18] via-[#101622] to-[#121722] shadow-inner">
          {/* Subtle Ambient Glow */}
          <div className="pointer-events-none absolute -top-8 -right-8 h-28 w-28 rounded-full bg-lime-500/5 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-cyan-500/5 blur-2xl" />

          {/* Exercise Visual Illustration */}
          <div className="absolute inset-0 flex items-center justify-center p-3 opacity-95 transition-transform duration-300 group-hover:scale-105">
            <ExerciseVisual
              name={primaryExName}
              masterExerciseId={primaryExId}
              movementPattern={primaryExPattern}
              muscleGroup={primaryExMuscle}
              compact={false}
              className="!border-none !bg-transparent w-full h-full shadow-none"
            />
          </div>

          {/* Bottom gradient fade for text contrast */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#121722] to-transparent" />

          {/* Top-Right: Single High-Signal Status Chip */}
          <div className="absolute top-3 right-3 z-10">
            {plan.isVerified ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-lime-400 bg-zinc-950/85 border border-lime-400/30 px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5" /> Clinical Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-zinc-950/85 border border-cyan-400/30 px-2.5 py-1 rounded-full backdrop-blur-md shadow-sm">
                <Globe className="h-3.5 w-3.5" /> Community
              </span>
            )}
          </div>

          {/* Bottom-Left: Consolidated Rating & Social Proof Chip */}
          <div className="absolute bottom-2.5 left-3 z-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-black text-amber-300 bg-zinc-950/85 px-2.5 py-1 rounded-full border border-zinc-800/90 backdrop-blur-md shadow-sm">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{ratingFormatted}</span>
              {plan.reviewsCount === 0 && (
                <span className="text-[10px] font-normal text-zinc-400">(New)</span>
              )}
              <span className="text-zinc-600 font-sans">•</span>
              <span className="text-[11px] font-sans font-medium text-zinc-300">
                {plan.cloneCount} {plan.cloneCount === 1 ? 'save' : 'saves'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Instant Specs Strip (Scannable in < 200ms) */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-zinc-400">
          <span className="text-white font-extrabold">{plan.frequencyDays} Days/Wk</span>
          <span className="text-zinc-700 font-sans">•</span>
          <span className="text-lime-400 font-extrabold">{plan.totalWeeklySets} Sets</span>
          <span className="text-zinc-700 font-sans">•</span>
          <span className="text-zinc-300 uppercase">{formattedSplit}</span>
          <span className="text-zinc-700 font-sans">•</span>
          <span className="text-zinc-400 capitalize">{plan.experienceLevel}</span>
        </div>

        {/* 3. Title & Description */}
        <div className="space-y-1">
          <h3 className="text-base sm:text-lg font-black text-white tracking-tight group-hover:text-lime-400 transition-colors line-clamp-1">
            {plan.title}
          </h3>

          {plan.forkedFrom && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 truncate">
              <GitFork className="h-3 w-3 shrink-0 text-cyan-400" />
              <span className="truncate">
                Forked from {plan.forkedFrom.planTitle || 'Community'} by{' '}
                {plan.forkedFrom.authorName}
              </span>
            </div>
          )}

          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
            {plan.description}
          </p>
        </div>

        {/* 4. Curated Tags Row (Max 2 de-duplicated badges + subtle overflow) */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {visibleTags.map((tag, tIdx) => {
              const colors = getPersonaColorClasses(tag);
              return (
                <button
                  key={tIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFilterTag?.(tag);
                  }}
                  title={`Filter by: ${tag}`}
                  className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ${colors.badgeBg} ${colors.textColor} ${colors.borderColor}`}
                >
                  {tag}
                </button>
              );
            })}

            {remainingCount > 0 && (
              <Tooltip
                content={
                  <div className="space-y-1 py-0.5 text-left">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                      Additional Safeguards:
                    </span>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {allRemaining.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-200"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                }
              >
                <span className="rounded-lg border border-zinc-800 bg-zinc-900/90 px-2 py-0.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-700">
                  +{remainingCount} more
                </span>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* 5. Streamlined Action Row */}
      <div
        className="mt-4 flex items-center gap-2 border-t border-zinc-800/80 pt-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Primary CTA: 1-Click Set Active */}
        <Button
          type="button"
          variant="volt"
          size="sm"
          loading={isCloning}
          onClick={() => onClone(plan)}
          className="flex-1 text-xs font-black shadow-md shadow-lime-400/10 h-9"
          title="Set as your primary active routine"
        >
          <Zap className="h-3.5 w-3.5 mr-1.5 fill-current" /> Set Active
        </Button>

        {/* 1-Click Save / Bookmark */}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={isSaving}
          onClick={(e) => onSave(plan, e)}
          title="Save to your library"
          className="h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200 hover:border-cyan-400 hover:text-cyan-400 shrink-0"
        >
          <BookmarkPlus className="h-3.5 w-3.5 mr-1" /> Save
        </Button>

        {/* Preview Routine Full Details */}
        <Tooltip content="Inspect exercises & split" position="top">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onPreview(plan)}
            className="size-9 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white shrink-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </Tooltip>

        {/* Social Share Link */}
        <Tooltip content={isCopied ? 'Link copied!' : 'Share plan link'} position="top">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => onShare(plan, e)}
            className="size-9 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white shrink-0"
          >
            {isCopied ? (
              <Check className="h-4 w-4 text-lime-400" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
