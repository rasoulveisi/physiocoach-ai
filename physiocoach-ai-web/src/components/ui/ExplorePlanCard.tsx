import { useMemo } from 'react';
import {
  ArrowRight,
  Bookmark,
  Calendar,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
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

  const formattedSplit = useMemo(() => {
    if (!plan.split) return 'CUSTOM';
    return plan.split.replace(/_/g, ' ').toUpperCase();
  }, [plan.split]);

  // High-signal joint tag or safety label
  const primaryJointTag = useMemo(() => {
    return plan.jointTags?.[0] || plan.targetPersonas?.[0] || null;
  }, [plan.jointTags, plan.targetPersonas]);

  // Real saves / clone count
  const savesCount = plan.cloneCount ?? 0;

  const ratingFormatted = useMemo(() => {
    if (plan.rating && plan.rating > 0) return plan.rating.toFixed(1);
    return null;
  }, [plan.rating]);

  // Multi-day collage exercises
  const collageExercises = useMemo(() => {
    if (!plan.days || plan.days.length === 0) {
      return primaryExName
        ? [
            {
              name: primaryExName,
              masterExerciseId: primaryExId,
              movementPattern: primaryExPattern,
              muscleGroup: primaryExMuscle,
            },
          ]
        : [];
    }

    const picks: {
      name: string;
      masterExerciseId?: string;
      movementPattern?: string;
      muscleGroup?: string;
    }[] = [];

    // Strategy: pick 1 primary compound movement per day across different days
    for (const day of plan.days) {
      if (picks.length >= 3) break;
      const ex = day.exercises?.[0];
      if (ex && !picks.some((p) => p.name === ex.name)) {
        picks.push({
          name: ex.name,
          masterExerciseId: ex.masterExerciseId || ex.id,
          movementPattern: ex.movementPattern,
          muscleGroup: ex.muscleGroup,
        });
      }
    }

    // If still only 1 exercise, add more from the first day to make a collage
    if (picks.length < 2 && plan.days[0]?.exercises) {
      for (const ex of plan.days[0].exercises.slice(1)) {
        if (picks.length >= 3) break;
        if (!picks.some((p) => p.name === ex.name)) {
          picks.push({
            name: ex.name,
            masterExerciseId: ex.masterExerciseId || ex.id,
            movementPattern: ex.movementPattern,
            muscleGroup: ex.muscleGroup,
          });
        }
      }
    }

    return picks;
  }, [plan.days, primaryExName, primaryExId, primaryExPattern, primaryExMuscle]);

  const splitAbbreviation = useMemo(() => {
    if (plan.split === 'push_pull_legs') return 'PPL';
    if (plan.split === 'upper_lower') return 'U / L';
    if (plan.split === 'full_body') return 'FULL';

    // Derive concise uppercase acronym from title
    const clean = plan.title.replace(/[^\w\s]/g, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
    }
    return clean.slice(0, 4).toUpperCase();
  }, [plan.split, plan.title]);

  return (
    <div
      onClick={() => onPreview(plan)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-[#121826] via-[#0d121e] to-[#080b13] p-3 sm:p-3.5 shadow-lg transition-all duration-300 hover:border-lime-400/50 hover:bg-[#141b2b] hover:shadow-[0_0_25px_rgba(16,231,96,0.1)] cursor-pointer"
    >
      <div>
        {/* 1. Visual Showcase Header with Multi-Day Collage + Watermark */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden rounded-xl sm:rounded-2xl border border-zinc-800/70 bg-[#080b13] shadow-inner">
          {/* Subtle Ambient Radial Lighting */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-lime-400/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100 opacity-60" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl opacity-50" />

          {/* Dynamic Multi-Exercise Collage */}
          <div className="absolute inset-0">
            {collageExercises.length >= 2 ? (
              <div
                className={`grid h-full w-full ${
                  collageExercises.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                } divide-x divide-zinc-800/80 bg-white`}
              >
                {collageExercises.map((ex, idx) => (
                  <div key={idx} className="relative h-full w-full overflow-hidden bg-white">
                    <ExerciseVisual
                      name={ex.name}
                      masterExerciseId={ex.masterExerciseId}
                      movementPattern={ex.movementPattern}
                      muscleGroup={ex.muscleGroup}
                      compact={true}
                      fit="cover"
                      className="h-full w-full pointer-events-none"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white">
                <ExerciseVisual
                  name={primaryExName}
                  masterExerciseId={primaryExId}
                  movementPattern={primaryExPattern}
                  muscleGroup={primaryExMuscle}
                  compact={true}
                  fit="cover"
                  className="h-full w-full pointer-events-none"
                />
              </div>
            )}

            {/* Dark Aesthetic Scrim & Vignette so white background blends with dark UI */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080b13] via-[#080b13]/40 to-[#080b13]/60 mix-blend-multiply" />
            <div className="pointer-events-none absolute inset-0 bg-[#080b13]/25" />

            {/* Large Bold Athletic Typographic Watermark */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <span className="font-mono text-4xl sm:text-5xl font-black tracking-tighter text-white/50 drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:scale-105 select-none">
                {splitAbbreviation}
              </span>
            </div>

            {/* Vignette Gradients for Top & Bottom Telemetry */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#080b13]/90 via-[#080b13]/40 to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#080b13] via-[#080b13]/70 to-transparent z-10" />
          </div>

          {/* Top Floating Badges */}
          <div className="absolute top-2 inset-x-2 flex items-center justify-between z-20 pointer-events-none">
            {/* Split Capsule */}
            <span className="rounded-full bg-zinc-950/85 border border-zinc-800/90 px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold tracking-wider text-zinc-300 backdrop-blur-md shadow-sm">
              {formattedSplit}
            </span>

            {/* Clinical / Joint Status */}
            {plan.isVerified ? (
              <span className="flex items-center gap-1 rounded-full bg-lime-950/90 border border-lime-400/40 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-lime-400 backdrop-blur-md shadow-sm">
                <ShieldCheck className="h-3 w-3" /> Clinical Safe
              </span>
            ) : primaryJointTag ? (
              <span className="flex items-center gap-1 rounded-full bg-cyan-950/90 border border-cyan-400/40 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold text-cyan-300 backdrop-blur-md shadow-sm">
                <Sparkles className="h-3 w-3 text-cyan-400" /> {primaryJointTag}
              </span>
            ) : null}
          </div>

          {/* Bottom Floating Telemetry Strip */}
          <div className="absolute bottom-2 inset-x-2 flex items-center justify-between z-20 pointer-events-none">
            {/* Frequency & Sets HUD */}
            <div className="rounded-lg bg-zinc-950/85 border border-zinc-800/90 px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold text-zinc-200 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
              <Calendar className="h-2.5 w-2.5 text-lime-400" />
              <span>{plan.frequencyDays}D/Wk</span>
              <span className="text-zinc-600 font-sans">•</span>
              <span className="text-lime-400 font-extrabold">{plan.totalWeeklySets} Sets</span>
            </div>

            {/* Rating or New badge */}
            {ratingFormatted ? (
              <div className="rounded-lg bg-zinc-950/85 border border-zinc-800/90 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-black text-amber-300 backdrop-blur-md flex items-center gap-1 shadow-sm">
                <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                <span>{ratingFormatted}</span>
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-950/85 border border-zinc-800/90 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-mono font-bold text-zinc-400 backdrop-blur-md shadow-sm">
                New
              </div>
            )}
          </div>
        </div>

        {/* 2. Plan Title (No text bloat) */}
        <h3 className="mt-2.5 text-xs sm:text-sm font-extrabold text-white tracking-tight line-clamp-1 group-hover:text-lime-400 transition-colors">
          {plan.title}
        </h3>
      </div>

      {/* 3. Card Footer with Saves Count & Inspection Arrow */}
      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/70 pt-2 text-[11px]">
        <div className="flex items-center gap-1 font-mono text-zinc-400">
          <Bookmark className="h-3 w-3 text-zinc-500" />
          <span>{savesCount} {savesCount === 1 ? 'save' : 'saves'}</span>
        </div>

        <div className="flex items-center gap-1 font-bold text-lime-400 text-xs transition-transform duration-200 group-hover:translate-x-0.5">
          <span>Inspect</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}
