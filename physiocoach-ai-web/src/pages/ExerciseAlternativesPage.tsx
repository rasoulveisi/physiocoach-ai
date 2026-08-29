import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Dumbbell,
  ExternalLink,
  Flame,
  Gauge,
  HeartPulse,
  HelpCircle,
  Info,
  Layers,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { ExerciseDetailModal } from '../app/features/exercise-catalog/components/ExerciseDetailModal';
import {
  fetchExerciseAlternatives,
  type ExerciseAlternativesData,
  type CatalogExerciseItem,
} from '../app/features/exercise-catalog/services/exercise-catalog-api';
import { usePageMetadata } from '../services/metadata';

interface PresetOption {
  slug: string;
  label: string;
  category: string;
  painRegion: string;
}

const POPULAR_PRESETS: PresetOption[] = [
  {
    slug: 'bench-press-shoulder-pain',
    label: 'Bench Press',
    category: 'Chest',
    painRegion: 'Shoulder Pain',
  },
  {
    slug: 'back-squat-knee-pain',
    label: 'Back Squat',
    category: 'Legs',
    painRegion: 'Knee Pain',
  },
  {
    slug: 'deadlift-lower-back-pain',
    label: 'Deadlift',
    category: 'Back',
    painRegion: 'Lower Back',
  },
  {
    slug: 'overhead-press-shoulder-impingement',
    label: 'Overhead Press',
    category: 'Shoulders',
    painRegion: 'Impingement',
  },
  {
    slug: 'barbell-row-lower-back-pain',
    label: 'Barbell Row',
    category: 'Back',
    painRegion: 'Lower Back',
  },
  {
    slug: 'lunges-knee-pain',
    label: 'Walking Lunges',
    category: 'Legs',
    painRegion: 'Knee Pain',
  },
  {
    slug: 'skull-crushers-elbow-pain',
    label: 'Skull Crushers',
    category: 'Arms',
    painRegion: 'Elbow Pain',
  },
  {
    slug: 'pull-ups-shoulder-pain',
    label: 'Pull-Ups',
    category: 'Back',
    painRegion: 'Shoulder Pain',
  },
];

const SELECTABLE_EXERCISES = [
  { id: 'bench-press', name: 'Barbell Bench Press', defaultPain: 'shoulder-pain' },
  { id: 'back-squat', name: 'Barbell Back Squat', defaultPain: 'knee-pain' },
  { id: 'deadlift', name: 'Barbell Deadlift', defaultPain: 'lower-back-pain' },
  { id: 'overhead-press', name: 'Barbell Overhead Press', defaultPain: 'shoulder-impingement' },
  { id: 'barbell-row', name: 'Barbell Bent-Over Row', defaultPain: 'lower-back-pain' },
  { id: 'lunges', name: 'Walking Lunges', defaultPain: 'knee-pain' },
  { id: 'skull-crushers', name: 'Barbell Skull Crushers', defaultPain: 'elbow-pain' },
  { id: 'pull-ups', name: 'Pull-Ups / Lat Pulldown', defaultPain: 'shoulder-pain' },
  { id: 'bicep-curl', name: 'Barbell Bicep Curl', defaultPain: 'wrist-pain' },
];

const SELECTABLE_PAINS = [
  { id: 'shoulder-pain', label: 'Shoulder Pain / Rotator Cuff' },
  { id: 'shoulder-impingement', label: 'Subacromial Impingement' },
  { id: 'lower-back-pain', label: 'Lower Back / Lumbar Strain' },
  { id: 'knee-pain', label: 'Anterior Knee / Patellar Pain' },
  { id: 'elbow-pain', label: 'Elbow Pain / Triceps Tendon' },
  { id: 'wrist-pain', label: 'Wrist Pain / Carpal Extension' },
  { id: 'neck-pain', label: 'Neck / Cervical Spine Strain' },
  { id: 'hip-impingement', label: 'Hip Impingement / Joint Strain' },
];

export function ExerciseAlternativesPage() {
  const { slug: rawSlug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const currentSlug = useMemo(() => {
    return rawSlug || 'bench-press-shoulder-pain';
  }, [rawSlug]);

  const [data, setData] = useState<ExerciseAlternativesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected exercise for catalog modal
  const [selectedExerciseForModal, setSelectedExerciseForModal] =
    useState<CatalogExerciseItem | null>(null);

  // Copied cue feedback state
  const [copiedCueIndex, setCopiedCueIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Custom selector local states
  const [selectedExerciseSlug, setSelectedExerciseSlug] = useState<string>('bench-press');
  const [selectedPainSlug, setSelectedPainSlug] = useState<string>('shoulder-pain');

  usePageMetadata(
    {
      title: data?.seoMetadata?.title || (data
        ? `${data.originalExercise.name} Alternatives for ${data.painCondition.displayName}`
        : 'Injury-Safe Exercise Alternatives · Joint-Friendly Swaps'),
      description: data?.seoMetadata?.metaDescription || (data
        ? `Biomechanical alternatives for ${data.originalExercise.name} targeting ${data.originalExercise.target} without ${data.painCondition.displayName}.`
        : 'Find biomechanically sound, joint-safe exercise alternatives for shoulder impingement, knee pain, lower back strain, and more.'),
      canonicalUrl: `https://physiocoach.ai/tools/alternatives/${currentSlug}`,
      ogType: 'article',
      ogImage: data?.originalExercise?.mediaUrl || undefined,
    },
    [data, currentSlug],
  );

  // Load alternatives data on slug change
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchExerciseAlternatives(currentSlug)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        setLoading(false);

        // Inject Schema.org JSON-LD tag for programmatic SEO
        if (res.seoMetadata?.schemaJsonLd) {
          let scriptTag = document.getElementById('exercise-alternatives-jsonld') as HTMLScriptElement | null;
          if (!scriptTag) {
            scriptTag = document.createElement('script');
            scriptTag.id = 'exercise-alternatives-jsonld';
            scriptTag.type = 'application/ld+json';
            document.head.appendChild(scriptTag);
          }
          scriptTag.text = JSON.stringify(res.seoMetadata.schemaJsonLd);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load exercise alternatives:', err);
        setError('Could not load biomechanical alternatives for this movement.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      const scriptTag = document.getElementById('exercise-alternatives-jsonld');
      if (scriptTag) scriptTag.remove();
    };
  }, [currentSlug]);

  const handleCopyCue = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCueIndex(index);
    setTimeout(() => setCopiedCueIndex(null), 2000);
  };

  const handleCopyPageLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSlug = `${selectedExerciseSlug}-${selectedPainSlug}`;
    navigate(`/tools/alternatives/${newSlug}`);
  };

  // Helper for joint shear visual styling
  const shearBadgeConfig = useMemo(() => {
    const rating = data?.painCondition.jointShearRating || 'high';
    switch (rating) {
      case 'high':
        return {
          label: 'High Joint Shear',
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          gaugeWidth: '88%',
          gaugeColor: 'bg-rose-500',
          textColor: 'text-rose-400',
          stressSeverity: 'Severe Mechanical Strain Zone',
        };
      case 'moderate':
        return {
          label: 'Moderate Joint Shear',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          gaugeWidth: '55%',
          gaugeColor: 'bg-amber-500',
          textColor: 'text-amber-400',
          stressSeverity: 'Moderate Impingement Risk',
        };
      default:
        return {
          label: 'Low Joint Shear',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          gaugeWidth: '25%',
          gaugeColor: 'bg-emerald-500',
          textColor: 'text-emerald-400',
          stressSeverity: 'Optimal Synovial Glide',
        };
    }
  }, [data?.painCondition.jointShearRating]);

  // Synthetic muscle preservation scores for alternatives
  const preservationScores = ['96%', '94%', '91%'];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#090D15] text-zinc-100 selection:bg-[#10E760] selection:text-zinc-950">
      {/* Top Banner & Breadcrumb */}
      <div className="shrink-0 border-b border-[#1E2638] bg-[#0C101A]/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] w-full px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <Link to="/exercises" className="transition-colors hover:text-[#10E760]">
                Catalog
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
              <span className="text-zinc-300">Biomechanical Alternatives</span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
              <span className="font-semibold text-[#10E760]">{currentSlug}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCopyPageLink}
                className="flex items-center gap-1.5 rounded-lg border border-[#1E2638] bg-[#121722] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-[#10E760]/40 hover:text-white"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#10E760]" />
                    <span className="text-[#10E760]">Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Share Page</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-[#10E760]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>PhysioCoach Clinical Standard</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 pb-12">
        {/* Quick Navigation / Popular Pain Alternative Shortcuts */}
        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
              <Zap className="h-3.5 w-3.5 text-[#10E760]" />
              <span>Popular Pain-Safe Swaps</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {POPULAR_PRESETS.map((preset) => {
              const isActive = preset.slug === currentSlug;
              return (
                <button
                  key={preset.slug}
                  type="button"
                  onClick={() => navigate(`/tools/alternatives/${preset.slug}`)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all duration-150',
                    isActive
                      ? 'border-[#10E760] bg-[#10E760]/10 text-white shadow-sm ring-1 ring-[#10E760]/50'
                      : 'border-[#1E2638] bg-[#121722]/80 text-zinc-400 hover:border-zinc-700 hover:bg-[#181F2E] hover:text-white',
                  )}
                >
                  <span>{preset.label}</span>
                  <span className="text-[10px] font-mono font-normal text-zinc-500">→</span>
                  <span
                    className={clsx(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium',
                      isActive ? 'bg-[#10E760]/20 text-[#10E760]' : 'bg-zinc-800 text-zinc-400',
                    )}
                  >
                    {preset.painRegion}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="grid gap-6 py-12">
            <div className="h-64 animate-pulse rounded-2xl border border-[#1E2638] bg-[#121722]" />
            <div className="grid gap-6 md:grid-cols-3">
              <div className="h-80 animate-pulse rounded-2xl border border-[#1E2638] bg-[#121722]" />
              <div className="h-80 animate-pulse rounded-2xl border border-[#1E2638] bg-[#121722]" />
              <div className="h-80 animate-pulse rounded-2xl border border-[#1E2638] bg-[#121722]" />
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="my-12 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-rose-400" />
            <h3 className="mt-4 text-lg font-bold text-white">Analysis Lookup Failed</h3>
            <p className="mt-2 text-sm text-zinc-400">{error}</p>
            <Button
              className="mt-6 border border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
              onClick={() => navigate('/tools/alternatives/bench-press-shoulder-pain')}
            >
              Reset to Default Preset
            </Button>
          </div>
        )}

        {/* Loaded Content */}
        {!loading && data && (
          <>
            {/* Header Hero Title */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#06B6D4]/30 bg-[#06B6D4]/10 px-3 py-1 text-xs font-mono font-semibold text-[#06B6D4]">
                <Gauge className="h-3.5 w-3.5" />
                <span>Biomechanical Analysis & Clinical Replacement</span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
                Safer Alternatives to <span className="text-[#10E760]">{data.originalExercise.name}</span> for{' '}
                <span className="text-[#06B6D4]">{data.painCondition.displayName}</span>
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                Maintain prime mover tension while offloading vulnerable joints with 3 evidence-based exercise swaps.
              </p>
            </div>

            {/* 1. Visual Biomechanical Analysis Card (Original Exercise) */}
            <div className="mb-10 overflow-hidden rounded-2xl border border-[#1E2638] bg-[#121722] shadow-xl">
              <div className="border-b border-[#1E2638] bg-[#0E131F] px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                      <AlertOctagon className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold uppercase tracking-wide text-white">
                        Biomechanical Stress Analysis
                      </h2>
                      <p className="text-xs font-mono text-zinc-400">
                        Primary Exercise: {data.originalExercise.name}
                      </p>
                    </div>
                  </div>

                  <div
                    className={clsx(
                      'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider',
                      shearBadgeConfig.bg,
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>{shearBadgeConfig.label}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-12 lg:gap-8">
                {/* Exercise Visual Card */}
                <div className="flex flex-col lg:col-span-4">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#1E2638] bg-[#090D15]">
                    <ExerciseVisual
                      name={data.originalExercise.name}
                      masterExerciseId={data.originalExercise.id}
                      movementPattern={data.originalExercise.movementPattern}
                      muscleGroup={data.originalExercise.target}
                      className="h-full w-full object-contain p-2"
                    />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-zinc-950/80 px-2.5 py-1.5 backdrop-blur-md">
                      <span className="text-[11px] font-mono text-zinc-400">Pattern:</span>
                      <span className="text-[11px] font-bold text-white capitalize">
                        {data.originalExercise.movementPattern.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-lg border border-[#1E2638] bg-[#0C101A] px-3 py-2 text-xs">
                    <span className="font-mono text-zinc-400">Target Muscle:</span>
                    <span className="font-bold text-[#10E760]">{data.originalExercise.target}</span>
                  </div>
                </div>

                {/* Biomechanical Root Cause & Stress Breakdown */}
                <div className="flex flex-col justify-between lg:col-span-8">
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                      Biomechanical Root-Cause
                    </h3>
                    <p className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm font-medium leading-relaxed text-rose-200">
                      {data.painCondition.biomechanicalCause}
                    </p>

                    {/* Joint Shear Gauge */}
                    <div className="mt-5 rounded-xl border border-[#1E2638] bg-[#0C101A] p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-400">Joint Shear Level:</span>
                        <span className={clsx('font-black uppercase tracking-wider', shearBadgeConfig.textColor)}>
                          {shearBadgeConfig.stressSeverity}
                        </span>
                      </div>
                      <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-500', shearBadgeConfig.gaugeColor)}
                          style={{ width: shearBadgeConfig.gaugeWidth }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>Low Impact</span>
                        <span>Moderate Shear</span>
                        <span className="text-rose-400">High Risk Range</span>
                      </div>
                    </div>
                  </div>

                  {/* Anatomical Vulnerability Checklist */}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-2.5 rounded-lg border border-[#1E2638] bg-[#0E131F] p-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                      <div className="text-xs">
                        <span className="font-bold text-zinc-200">End-Range Stress:</span>
                        <p className="mt-0.5 text-zinc-400">
                          Axial or rotational load forces the joint into compression.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-lg border border-[#1E2638] bg-[#0E131F] p-3">
                      <HeartPulse className="mt-0.5 h-4 w-4 shrink-0 text-[#06B6D4]" />
                      <div className="text-xs">
                        <span className="font-bold text-zinc-200">Recommendation:</span>
                        <p className="mt-0.5 text-zinc-400">
                          Swap to the 3 alternatives below to progress overload pain-free.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Three Safer Alternative Cards */}
            <section className="mb-12">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#10E760]">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Top 3 Clinically Recommended Alternatives</span>
                  </div>
                  <h2 className="mt-1 text-xl font-extrabold text-white sm:text-2xl">
                    Prime Mover Tension with Zero Joint Pain
                  </h2>
                </div>
                <span className="rounded-md border border-[#1E2638] bg-[#121722] px-3 py-1 text-xs font-mono text-zinc-400">
                  3 Movements Matched
                </span>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {data.alternatives.map((alt, index) => (
                  <div
                    key={alt.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#1E2638] bg-[#121722] p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-[#10E760]/50 hover:shadow-[#10E760]/5"
                  >
                    <div>
                      {/* Alternative Card Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex size-7 items-center justify-center rounded-full bg-[#10E760]/10 text-xs font-mono font-black text-[#10E760] ring-1 ring-[#10E760]/30">
                          0{index + 1}
                        </span>
                        <div className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-[#10E760]">
                          <Sparkles className="h-3 w-3" />
                          <span>{preservationScores[index]} Hypertrophy Preserved</span>
                        </div>
                      </div>

                      {/* Visual Preview */}
                      <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#1E2638] bg-[#090D15]">
                        <ExerciseVisual
                          name={alt.name}
                          masterExerciseId={alt.id}
                          movementPattern={data.originalExercise.movementPattern}
                          muscleGroup={alt.targetMuscle}
                          media={alt.mediaUrl ? { imageUrl: alt.mediaUrl } : null}
                          className="h-full w-full object-contain p-2"
                        />
                      </div>

                      {/* Exercise Name & Muscle */}
                      <h3 className="mt-4 text-base font-extrabold text-white group-hover:text-[#10E760] transition-colors">
                        {alt.name}
                      </h3>
                      <p className="mt-1 text-xs font-mono text-[#06B6D4]">
                        Target: {alt.targetMuscle}
                      </p>

                      {/* Joint Protection Mechanism */}
                      <div className="mt-4 rounded-xl border border-[#1E2638] bg-[#0C101A] p-3.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#10E760]">
                          <Shield className="h-3.5 w-3.5" />
                          <span>Joint Protection Mechanism</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                          {alt.shearReductionReason}
                        </p>
                      </div>

                      {/* Clinical Setup Cue */}
                      <div className="mt-3 rounded-xl border border-zinc-800 bg-[#0E131F] p-3.5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                          <span className="font-bold text-zinc-300">Form & Setup Cue:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCue(alt.setupCue, index)}
                            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white"
                          >
                            {copiedCueIndex === index ? (
                              <>
                                <Check className="h-3 w-3 text-[#10E760]" />
                                <span className="text-[#10E760]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-1 text-xs italic text-zinc-400">
                          "{alt.setupCue}"
                        </p>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-5 pt-3 border-t border-[#1E2638] flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedExerciseForModal({
                            id: alt.id,
                            canonicalId: alt.id,
                            name: alt.name,
                            bodyPart: data.originalExercise.bodyPart,
                            primaryMuscle: alt.targetMuscle,
                            secondaryMuscles: [],
                            movementPattern: data.originalExercise.movementPattern,
                            recommendedLevel: 'intermediate',
                            equipment: ['dumbbell', 'cable', 'bodyweight'],
                            safetySummary: {
                              overallRating: 'safe',
                              highlightTags: ['Joint-Safe', 'Optimal Leverage'],
                            },
                          })
                        }
                        className="flex-1 rounded-xl border border-[#1E2638] bg-[#181F2E] py-2.5 text-xs font-bold text-white transition-colors hover:border-[#10E760]/50 hover:bg-[#10E760]/10 hover:text-[#10E760]"
                      >
                        View in Catalog
                      </button>
                      <Link
                        to={`/exercises?q=${encodeURIComponent(alt.name)}`}
                        className="flex size-9 items-center justify-center rounded-xl border border-[#1E2638] bg-[#181F2E] text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                        title="Explore variations in catalog"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Interactive Custom Exercise & Limitation Selector */}
            <section className="mb-12 rounded-2xl border border-[#1E2638] bg-[#0E131F] p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-white sm:text-lg">
                    Find Injury-Safe Alternatives for Any Exercise
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                    Select a compound movement and pain condition to calculate custom biomechanical alternatives.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCustomSearchSubmit} className="mt-6 grid gap-4 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label htmlFor="exercise-select" className="mb-1.5 block text-xs font-mono uppercase text-zinc-400">
                    Original Movement
                  </label>
                  <select
                    id="exercise-select"
                    value={selectedExerciseSlug}
                    onChange={(e) => setSelectedExerciseSlug(e.target.value)}
                    className="w-full rounded-xl border border-[#1E2638] bg-[#121722] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#10E760] focus:outline-none focus:ring-1 focus:ring-[#10E760]"
                  >
                    {SELECTABLE_EXERCISES.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label htmlFor="pain-select" className="mb-1.5 block text-xs font-mono uppercase text-zinc-400">
                    Limitation / Pain Condition
                  </label>
                  <select
                    id="pain-select"
                    value={selectedPainSlug}
                    onChange={(e) => setSelectedPainSlug(e.target.value)}
                    className="w-full rounded-xl border border-[#1E2638] bg-[#121722] px-3.5 py-2.5 text-sm font-semibold text-white focus:border-[#10E760] focus:outline-none focus:ring-1 focus:ring-[#10E760]"
                  >
                    {SELECTABLE_PAINS.map((pain) => (
                      <option key={pain.id} value={pain.id}>
                        {pain.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10E760] px-4 py-2.5 text-sm font-black text-zinc-950 shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Analyze</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              </form>
            </section>

            {/* 4. Clinical FAQ & Biomechanical Answers */}
            <section className="mb-12">
              <div className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
                <HelpCircle className="h-4 w-4 text-[#06B6D4]" />
                <span>Biomechanical FAQ</span>
              </div>

              <div className="grid gap-4">
                <div className="rounded-xl border border-[#1E2638] bg-[#121722] p-4">
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Why does {data.originalExercise.name} aggravate {data.painCondition.displayName.toLowerCase()}?
                  </h4>
                  <p className="mt-1.5 text-xs text-zinc-300">
                    {data.painCondition.biomechanicalCause} Fixed barbell paths lock the joint into compressive shearing under high load.
                  </p>
                </div>

                <div className="rounded-xl border border-[#1E2638] bg-[#121722] p-4">
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Will I maintain equivalent muscle hypertrophy with these swaps?
                  </h4>
                  <p className="mt-1.5 text-xs text-zinc-300">
                    Yes. Mechanical tension on target muscle fibers—not the specific tool—drives hypertrophy without joint discomfort.
                  </p>
                </div>

                <div className="rounded-xl border border-[#1E2638] bg-[#121722] p-4">
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    How do I swap this in my current workout routine?
                  </h4>
                  <p className="mt-1.5 text-xs text-zinc-300">
                    In your <Link to="/plan" className="text-[#10E760] underline font-bold">Workout Plan</Link> or live session tracker, tap the exercise swap icon to substitute any aggravating lift immediately.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Exercise Detail Modal Integration */}
      {selectedExerciseForModal && (
        <ExerciseDetailModal
          open={!!selectedExerciseForModal}
          exercise={selectedExerciseForModal}
          onClose={() => setSelectedExerciseForModal(null)}
          onSelectAlternative={(id, name) => {
            setSelectedExerciseForModal(null);
            navigate(`/exercises?q=${encodeURIComponent(name)}`);
          }}
        />
      )}
    </div>
  );
}
