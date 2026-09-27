import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookmarkPlus,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Dumbbell,
  Eye,
  Filter,
  Globe,
  GitFork,
  HeartPulse,
  Layers,
  RotateCcw,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { ExerciseVisual } from '../components/ui/ExerciseVisual';
import { apiClient } from '../services/api-client';
import { resolveExerciseSafetyNotes } from '../services/exercise-safety-notes';
import { getPersonaColorClasses } from '../services/persona-matcher';
import { usePageMetadata } from '../services/metadata';
import { ExplorePlanCard } from '../components/ui/ExplorePlanCard';

export interface ExploreExerciseItem {
  id: string;
  name: string;
  movementPattern: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds: number;
  rpe?: number;
  notes?: string;
  masterExerciseId?: string;
}

export interface ExploreDayItem {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: ExploreExerciseItem[];
}

export interface ExplorePlanAuthor {
  name: string;
  role: string;
  avatar?: string;
  verified: boolean;
}

export interface ExploreProgression {
  baselineIntensity: string;
  progressionRule: string;
  increasePercent: number;
  conditions: string[];
}

export interface ExplorePrimaryExercise {
  name: string;
  masterExerciseId?: string;
  movementPattern?: string;
  muscleGroup?: string;
  mediaUrl?: string;
}

export interface ExplorePlanDto {
  id: string;
  title: string;
  description: string;
  split: 'push_pull_legs' | 'upper_lower' | 'full_body' | 'custom';
  frequencyDays: number;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  jointTags: string[];
  targetPersonas: string[];
  totalWeeklySets: number;
  author: ExplorePlanAuthor;
  cloneCount: number;
  days: ExploreDayItem[];
  summary?: string;
  safetyNotes?: string[];
  progression?: ExploreProgression;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  createdAt: string;
  primaryExercise?: ExplorePrimaryExercise;
  forkedFrom?: {
    planId: string;
    authorName: string;
    planTitle?: string;
  };
}

const SPLIT_OPTIONS = [
  { id: 'all', label: 'All Splits' },
  { id: 'push_pull_legs', label: 'Push Pull Legs' },
  { id: 'upper_lower', label: 'Upper / Lower' },
  { id: 'full_body', label: 'Full Body' },
];

const INJURY_TAGS = [
  { id: 'knee_friendly', label: 'Knee-Friendly', icon: HeartPulse, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { id: 'low_spine_load', label: 'Low Spine Load', icon: Shield, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
  { id: 'shoulder_safe', label: 'Shoulder-Safe', icon: ShieldCheck, color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  { id: 'thoracic_mobility', label: 'Thoracic Mobility', icon: Sparkles, color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
];

const EQUIPMENT_OPTIONS = [
  { id: 'all', label: 'All Equipment' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'cable_machine', label: 'Cables / Machine' },
  { id: 'bench', label: 'Bench' },
  { id: 'resistance_bands', label: 'Resistance Bands' },
];

const EXPERIENCE_OPTIONS = [
  { id: 'all', label: 'All Levels' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
];

export function ExplorePlansPage() {
  const [plans, setPlans] = useState<ExplorePlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSplit, setSelectedSplit] = useState('all');
  const [selectedEquipment, setSelectedEquipment] = useState('all');
  const [selectedInjuryFilter, setSelectedInjuryFilter] = useState('all');
  const [selectedExperience, setSelectedExperience] = useState('all');
  const [cloningPlanId, setCloningPlanId] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [previewPlan, setPreviewPlan] = useState<ExplorePlanDto | null>(null);
  const [previewActiveDay, setPreviewActiveDay] = useState(0);
  const [expandedCues, setExpandedCues] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Mobile Filter Bottom Sheet Toggle
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageMetadata(
    {
      title: previewPlan
        ? `${previewPlan.title} · Verified Workout Routine`
        : 'Explore Workout Plans · Verified Injury-Safe Routines',
      description: previewPlan
        ? `${previewPlan.description} Tailored for ${previewPlan.targetPersonas.join(', ')}.`
        : 'Browse clinical-grade workout routines filterable by split, available equipment, and joint-safety tags (Knee-Friendly, Low Spine Load, Shoulder-Safe).',
      canonicalUrl: previewPlan
        ? `https://physiocoach.ai/explore?plan=${previewPlan.id}`
        : 'https://physiocoach.ai/explore',
      ogType: 'website',
    },
    [previewPlan],
  );

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSplit !== 'all') params.set('split', selectedSplit);
      if (selectedEquipment !== 'all') params.set('equipment', selectedEquipment);
      if (selectedInjuryFilter !== 'all') params.set('injuryFilter', selectedInjuryFilter);
      if (selectedExperience !== 'all') params.set('experienceLevel', selectedExperience);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await apiClient.get<{ data: ExplorePlanDto[]; total: number }>(`explore/plans${queryStr}`);
      const payload = res?.data || (Array.isArray(res) ? res : []);
      setPlans(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.warn('Could not fetch explore plans:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSplit, selectedEquipment, selectedInjuryFilter, selectedExperience, searchQuery]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Handle URL plan param for direct preview
  useEffect(() => {
    const planParam = searchParams.get('plan');
    if (planParam && plans.length > 0) {
      const match = plans.find((p) => p.id === planParam);
      if (match) {
        setPreviewPlan(match);
        setPreviewActiveDay(0);
      }
    }
  }, [searchParams, plans]);

  const handleClonePlan = async (plan: ExplorePlanDto) => {
    setCloningPlanId(plan.id);
    try {
      await apiClient.post(`workout-plans/${plan.id}/clone`);
      setToast({
        message: `Plan "${plan.title}" saved as your active workout routine!`,
        type: 'success',
      });
      if (previewPlan) setPreviewPlan(null);
      setTimeout(() => {
        navigate('/plan');
      }, 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not clone plan.';
      setToast({
        message: msg.includes('401') || msg.includes('auth')
          ? 'Please log in to save and track workout plans.'
          : msg,
        type: 'error',
      });
      if (msg.includes('401') || msg.includes('auth')) {
        setTimeout(() => navigate('/auth'), 1200);
      }
    } finally {
      setCloningPlanId(null);
    }
  };

  const handleSaveToMyPlans = async (plan: ExplorePlanDto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSavingPlanId(plan.id);
    try {
      await apiClient.post(`workout-plans/${plan.id}/clone`);
      setToast({
        message: `Plan "${plan.title}" saved to your plans library!`,
        type: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save plan.';
      setToast({
        message: msg.includes('401') || msg.includes('auth')
          ? 'Please log in to save and track workout plans.'
          : msg,
        type: 'error',
      });
      if (msg.includes('401') || msg.includes('auth')) {
        setTimeout(() => navigate('/auth'), 1200);
      }
    } finally {
      setSavingPlanId(null);
    }
  };

  const [drawerRatingVal, setDrawerRatingVal] = useState<number>(5);
  const [drawerHoverRating, setDrawerHoverRating] = useState<number | null>(null);
  const [drawerReviewNote, setDrawerReviewNote] = useState('');
  const [isSubmittingDrawerRating, setIsSubmittingDrawerRating] = useState(false);

  const handleRateExplorePlan = async (planId: string) => {
    setIsSubmittingDrawerRating(true);
    try {
      const res = await apiClient.post<any>(`workout-plans/${planId}/rate`, {
        rating: drawerRatingVal,
        review: drawerReviewNote.trim() || undefined,
      });
      const data = res?.data || res;
      const newRating = data?.rating ?? drawerRatingVal;
      const newReviewsCount =
        data?.reviewsCount ??
        (previewPlan?.reviewsCount ? previewPlan.reviewsCount + 1 : 1);

      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? { ...p, rating: newRating, reviewsCount: newReviewsCount }
            : p,
        ),
      );
      if (previewPlan && previewPlan.id === planId) {
        setPreviewPlan({
          ...previewPlan,
          rating: newRating,
          reviewsCount: newReviewsCount,
        });
      }
      setToast({
        message: `Thanks! Your ${drawerRatingVal} ⭐ review was submitted.`,
        type: 'success',
      });
      setDrawerReviewNote('');
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Could not submit rating.',
        type: 'error',
      });
    } finally {
      setIsSubmittingDrawerRating(false);
    }
  };

  const handleSharePlan = async (plan: ExplorePlanDto, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/explore?plan=${encodeURIComponent(plan.id)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `PhysioCoach AI: ${plan.title}`,
          text: plan.description,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard if share cancelled
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(plan.id);
      setToast({ message: 'Plan link copied to clipboard!', type: 'success' });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setToast({ message: 'Could not copy link to clipboard.', type: 'error' });
    }
  };

  const resetAllFilters = () => {
    setSelectedSplit('all');
    setSelectedEquipment('all');
    setSelectedInjuryFilter('all');
    setSelectedExperience('all');
    setSearchQuery('');
  };

  const isFiltered = useMemo(() => {
    return (
      selectedSplit !== 'all' ||
      selectedEquipment !== 'all' ||
      selectedInjuryFilter !== 'all' ||
      selectedExperience !== 'all' ||
      Boolean(searchQuery.trim())
    );
  }, [selectedSplit, selectedEquipment, selectedInjuryFilter, selectedExperience, searchQuery]);

  // Active filter chip items
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (searchQuery.trim()) {
      chips.push({ key: 'search', label: `"${searchQuery.trim()}"`, clear: () => setSearchQuery('') });
    }
    if (selectedSplit !== 'all') {
      chips.push({
        key: 'split',
        label: `Split: ${SPLIT_OPTIONS.find((s) => s.id === selectedSplit)?.label ?? selectedSplit}`,
        clear: () => setSelectedSplit('all'),
      });
    }
    if (selectedInjuryFilter !== 'all') {
      chips.push({
        key: 'injury',
        label: `Safe: ${INJURY_TAGS.find((t) => t.id === selectedInjuryFilter)?.label ?? selectedInjuryFilter}`,
        clear: () => setSelectedInjuryFilter('all'),
      });
    }
    if (selectedEquipment !== 'all') {
      chips.push({
        key: 'equipment',
        label: `Gear: ${EQUIPMENT_OPTIONS.find((e) => e.id === selectedEquipment)?.label ?? selectedEquipment}`,
        clear: () => setSelectedEquipment('all'),
      });
    }
    if (selectedExperience !== 'all') {
      chips.push({
        key: 'level',
        label: `Level: ${selectedExperience}`,
        clear: () => setSelectedExperience('all'),
      });
    }
    return chips;
  }, [searchQuery, selectedSplit, selectedInjuryFilter, selectedEquipment, selectedExperience]);

  const toggleCue = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCues((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#090D15] text-zinc-100 selection:bg-lime-400 selection:text-zinc-950">
      {/* 1. DESKTOP STICKY FILTER SIDEBAR */}
      <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-r border-zinc-800/80 bg-zinc-950/40 p-5 lg:flex">
        <ExploreFilterPanel
          selectedSplit={selectedSplit}
          onSelectSplit={setSelectedSplit}
          selectedInjuryFilter={selectedInjuryFilter}
          onSelectInjuryFilter={setSelectedInjuryFilter}
          selectedEquipment={selectedEquipment}
          onSelectEquipment={setSelectedEquipment}
          selectedExperience={selectedExperience}
          onSelectExperience={setSelectedExperience}
          isFiltered={isFiltered}
          onReset={resetAllFilters}
        />
      </aside>

      {/* 2. MAIN PLANS FEED CONTENT AREA */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header, Search & Active Chips */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-zinc-800/80 bg-[#090D15] p-4 sm:px-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg border border-[#10E760]/30 bg-[#10E760]/15 text-[#10E760]">
                  <Compass className="h-4 w-4 stroke-[2.5]" />
                </span>
                <h1 className="text-lg font-black uppercase tracking-tight text-white">
                  Explore Workout Plans
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Verified training splits designed for joint health and progressive overload.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Metrics Badge */}
              <span className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 font-mono text-xs font-bold text-zinc-300">
                {loading ? 'Searching…' : `${plans.length} Verified Plans`}
              </span>

              {/* Mobile Filter Trigger Button */}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-xs font-extrabold text-lime-400 lg:hidden"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeChips.length > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-lime-400 text-[10px] font-black text-zinc-950">
                    {activeChips.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by muscle, goal, or condition (e.g. Desk Worker, Knee-Safe, PPL)..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2.5 pl-10 pr-10 text-xs font-semibold text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-lime-400 focus:bg-zinc-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Active Filter Chips Pill Bar */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-zinc-400">Active:</span>
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/90 px-2 py-0.5 text-xs font-bold text-zinc-200"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.clear}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={resetAllFilters}
                className="ml-1 text-[11px] font-bold text-lime-400 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Plans Grid Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-6 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-28 rounded-full bg-zinc-800" />
                    <div className="h-6 w-20 rounded-md bg-zinc-800" />
                  </div>
                  <div className="h-8 w-3/4 rounded-lg bg-zinc-800" />
                  <div className="h-16 w-full rounded-lg bg-zinc-800" />
                  <div className="h-10 w-full rounded-xl bg-zinc-800 mt-6" />
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <Card className="border-zinc-800 bg-zinc-900/70">
              <CardContent className="py-20 text-center space-y-4">
                <ShieldAlert className="mx-auto h-12 w-12 text-zinc-600 animate-pulse" />
                <h2 className="text-xl font-black text-white">No Matching Plans Found</h2>
                <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                  No workout routine matches your current filter combination. Try clearing filters or searching for different terms.
                </p>
                <Button onClick={resetAllFilters} variant="volt" size="sm">
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Clear All Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <ExplorePlanCard
                  key={plan.id}
                  plan={plan}
                  isCloning={cloningPlanId === plan.id}
                  isSaving={savingPlanId === plan.id}
                  isCopied={copiedId === plan.id}
                  onClone={handleClonePlan}
                  onSave={handleSaveToMyPlans}
                  onPreview={(p) => {
                    setPreviewPlan(p);
                    setPreviewActiveDay(0);
                    setSearchParams({ plan: p.id });
                  }}
                  onShare={handleSharePlan}
                  onSelectFilterTag={(tag) => setSearchQuery(tag)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. MOBILE FILTER BOTTOM SHEET */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm lg:hidden">
          <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-black uppercase tracking-wider text-white">
                Filters & Joint Safety
              </span>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="grid size-8 place-items-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <ExploreFilterPanel
                selectedSplit={selectedSplit}
                onSelectSplit={setSelectedSplit}
                selectedInjuryFilter={selectedInjuryFilter}
                onSelectInjuryFilter={setSelectedInjuryFilter}
                selectedEquipment={selectedEquipment}
                onSelectEquipment={setSelectedEquipment}
                selectedExperience={selectedExperience}
                onSelectExperience={setSelectedExperience}
                isFiltered={isFiltered}
                onReset={resetAllFilters}
              />
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="w-full rounded-xl bg-lime-400 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-md"
              >
                View {plans.length} Plans
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Full Routine Preview Modal / Drawer */}
      {previewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/90 p-4 sm:p-5 bg-zinc-950/60">
              <div className="space-y-1 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {previewPlan.split.replace(/_/g, ' ')}
                  </span>
                  {previewPlan.isVerified && (
                    <span className="flex items-center gap-1 text-[10px] font-black text-lime-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Clinical Verified
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white truncate">
                  {previewPlan.title}
                </h2>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => handleSharePlan(previewPlan, e)}
                  title="Share Routine Link"
                  className="size-9 rounded-xl text-zinc-400 hover:text-white"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setPreviewPlan(null);
                    setSearchParams({});
                  }}
                  className="size-9 rounded-xl text-zinc-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
              {/* Routine Description & Notes */}
              <div className="space-y-3 rounded-2xl bg-[#121722] p-4 border border-zinc-800">
                <p className="text-xs text-zinc-300 leading-relaxed">{previewPlan.description}</p>

                {/* Personas in Modal */}
                {previewPlan.targetPersonas?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                      Matched Personas:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {previewPlan.targetPersonas.map((persona, pIdx) => {
                        const colors = getPersonaColorClasses(persona);
                        return (
                          <span
                            key={pIdx}
                            className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-bold ${colors.badgeBg} ${colors.textColor} ${colors.borderColor}`}
                          >
                            {persona}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-zinc-400 border-t border-zinc-800/80">
                  <span className="font-bold text-[#10E760]">Author:</span> {previewPlan.author.name} ({previewPlan.author.role})
                </div>
              </div>

              {/* Day Selector Strip */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-400">
                    Multi-Day Routine Schedule
                  </h3>
                  <span className="font-mono text-xs text-zinc-500">
                    Day {previewActiveDay + 1} of {previewPlan.days.length}
                  </span>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {previewPlan.days.map((day, dIdx) => {
                    const isActive = dIdx === previewActiveDay;
                    return (
                      <button
                        key={day.dayNumber}
                        type="button"
                        onClick={() => setPreviewActiveDay(dIdx)}
                        className={`flex min-w-[80px] flex-1 flex-col items-center justify-center rounded-2xl p-2.5 text-center transition-all ${
                          isActive
                            ? 'bg-lime-400 text-zinc-950 font-black shadow-lg shadow-lime-400/20 scale-[1.02]'
                            : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-zinc-950/80' : 'text-zinc-500'}`}>
                          Day {day.dayNumber}
                        </span>
                        <span className="mt-0.5 text-xs font-black truncate max-w-[90px]">
                          {day.name.split(':')[1]?.trim() || day.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Day Focus Banner */}
              {previewPlan.days[previewActiveDay] && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
                        {previewPlan.days[previewActiveDay].name}
                      </p>
                      <h4 className="text-sm font-bold text-white">
                        Focus: {previewPlan.days[previewActiveDay].focus}
                      </h4>
                    </div>
                    <span className="rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs font-mono font-bold text-zinc-300">
                      {previewPlan.days[previewActiveDay].exercises.length} Exercises
                    </span>
                  </div>

                  {/* Exercises List */}
                  <div className="space-y-3">
                    {previewPlan.days[previewActiveDay].exercises.map((exercise, exIdx) => {
                      const safetyNotes = resolveExerciseSafetyNotes(exercise.name).tips || [];
                      const cueKey = `preview-${previewActiveDay}-${exIdx}`;
                      const isExpanded = !!expandedCues[cueKey];

                      return (
                        <div
                          key={exercise.id || exIdx}
                          className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-3.5 sm:p-4 space-y-2.5"
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Exercise Visual */}
                            <div className="size-14 sm:size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center p-1">
                              <ExerciseVisual
                                name={exercise.name}
                                masterExerciseId={exercise.masterExerciseId || exercise.id}
                                movementPattern={exercise.movementPattern}
                                muscleGroup={exercise.muscleGroup}
                                compact={true}
                              />
                            </div>

                            {/* Exercise Details */}
                            <div className="flex-1 min-w-0 space-y-1">
                              <h5 className="truncate text-sm font-bold text-white capitalize">
                                {exercise.name}
                              </h5>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono font-black text-lime-400">
                                  {exercise.sets} Sets × {exercise.reps} Reps
                                </span>
                                {exercise.rpe && (
                                  <span className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                                    Effort: {exercise.rpe}/10
                                  </span>
                                )}
                                <span className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                  {exercise.restSeconds}s Rest
                                </span>
                              </div>
                              {exercise.notes && (
                                <p className="text-[11px] text-zinc-400 italic line-clamp-2">
                                  {exercise.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Expandable Safety Notes */}
                          {safetyNotes.length > 0 && (
                            <div className="border-t border-zinc-800/80 pt-2">
                              <button
                                type="button"
                                onClick={(e) => toggleCue(cueKey, e)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-lime-400 hover:text-lime-300"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Biomechanical Safeguards</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>

                              {isExpanded && (
                                <ul className="mt-2 space-y-1 rounded-xl bg-zinc-900 p-2.5 text-[11px] text-zinc-300">
                                  {safetyNotes.map((note, nIdx) => (
                                    <li key={nIdx} className="flex items-start gap-1.5">
                                      <span className="text-lime-400 font-bold">•</span>
                                      <span>{note}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Progression Note */}
              {previewPlan.progression && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-1.5 text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5 font-bold text-white">
                    <BrainCircuit className="h-4 w-4 text-lime-400" /> Overload Model
                  </span>
                  <p className="text-zinc-400">{previewPlan.progression.progressionRule}</p>
                </div>
              )}

              {/* Interactive Community Rating & Review Widget */}
              <div className="rounded-2xl border border-zinc-800 bg-[#121722] p-4 sm:p-5 space-y-3.5 shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      Rate & Review Routine
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      How effective was this workout routine for your goals?
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-base font-black text-amber-300">
                      {previewPlan.reviewsCount === 0
                        ? '5.0'
                        : (previewPlan.rating ? previewPlan.rating.toFixed(1) : '5.0')}
                    </span>
                    <span className="text-[10px] text-zinc-500 block">
                      {previewPlan.reviewsCount === 0
                        ? '(New)'
                        : `(${previewPlan.reviewsCount} ${previewPlan.reviewsCount === 1 ? 'review' : 'reviews'})`}
                    </span>
                  </div>
                </div>

                {/* 5-Star Rating Buttons */}
                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (drawerHoverRating ?? drawerRatingVal) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setDrawerHoverRating(star)}
                        onMouseLeave={() => setDrawerHoverRating(null)}
                        onClick={() => setDrawerRatingVal(star)}
                        className="p-1 transition-transform hover:scale-125 focus:outline-none"
                        title={`Rate ${star} star${star === 1 ? '' : 's'}`}
                      >
                        <Star
                          className={`size-6 transition-colors ${
                            active
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                              : 'text-zinc-700 hover:text-zinc-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Review Input */}
                <div className="space-y-2">
                  <textarea
                    value={drawerReviewNote}
                    onChange={(e) => setDrawerReviewNote(e.target.value)}
                    placeholder="Optional feedback: joint feel, recovery, results..."
                    rows={2}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-amber-400 transition-colors"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={isSubmittingDrawerRating}
                    onClick={() => handleRateExplorePlan(previewPlan.id)}
                    className="w-full text-xs font-bold border-zinc-700 hover:border-amber-400 hover:text-amber-400"
                  >
                    Submit Review ({drawerRatingVal} ⭐)
                  </Button>
                </div>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-zinc-800/90 p-4 sm:p-5 bg-zinc-950/80">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setPreviewPlan(null);
                  setSearchParams({});
                }}
                className="text-xs font-bold"
              >
                Close Preview
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  loading={savingPlanId === previewPlan.id}
                  onClick={() => handleSaveToMyPlans(previewPlan)}
                  className="text-xs font-bold border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                >
                  <BookmarkPlus className="h-4 w-4 mr-1 text-cyan-400" /> Save to My Plans
                </Button>

                <Button
                  variant="volt"
                  size="md"
                  loading={cloningPlanId === previewPlan.id}
                  onClick={() => handleClonePlan(previewPlan)}
                  className="text-xs font-black shadow-lg shadow-lime-400/20"
                >
                  <Zap className="h-4 w-4 mr-1.5" /> Set as Active Plan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
}

interface ExploreFilterPanelProps {
  selectedSplit: string;
  onSelectSplit: (id: string) => void;
  selectedInjuryFilter: string;
  onSelectInjuryFilter: (id: string) => void;
  selectedEquipment: string;
  onSelectEquipment: (id: string) => void;
  selectedExperience: string;
  onSelectExperience: (id: string) => void;
  isFiltered: boolean;
  onReset: () => void;
}

function ExploreFilterPanel({
  selectedSplit,
  onSelectSplit,
  selectedInjuryFilter,
  onSelectInjuryFilter,
  selectedEquipment,
  onSelectEquipment,
  selectedExperience,
  onSelectExperience,
  isFiltered,
  onReset,
}: ExploreFilterPanelProps) {
  const [openSections, setOpenSections] = useState<{
    split: boolean;
    safety: boolean;
    equipment: boolean;
    level: boolean;
  }>({
    split: true,
    safety: true,
    equipment: true,
    level: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Reset Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-lime-400" />
          <span className="text-sm font-extrabold uppercase tracking-tight text-white">
            Filter Plans
          </span>
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs font-bold text-zinc-400 transition-colors hover:text-lime-400"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </button>
        )}
      </div>

      {/* 1. Training Split */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <button
          type="button"
          onClick={() => toggleSection('split')}
          className="flex w-full items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-lime-400" />
            Training Split
          </span>
          {openSections.split ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSections.split && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SPLIT_OPTIONS.map((split) => {
              const active = selectedSplit === split.id;
              return (
                <button
                  key={split.id}
                  type="button"
                  onClick={() => onSelectSplit(split.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    active
                      ? 'bg-lime-400 font-black text-zinc-950 shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {split.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Joint-Friendly Safety Tags */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <button
          type="button"
          onClick={() => toggleSection('safety')}
          className="flex w-full items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
            Joint Safeguards
          </span>
          {openSections.safety ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSections.safety && (
          <div className="mt-3 space-y-1.5">
            {INJURY_TAGS.map((tag) => {
              const Icon = tag.icon;
              const active = selectedInjuryFilter === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onSelectInjuryFilter(active ? 'all' : tag.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    active
                      ? `border ${tag.color} ring-1 ring-current`
                      : 'border border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {tag.label}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Equipment Required */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <button
          type="button"
          onClick={() => toggleSection('equipment')}
          className="flex w-full items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Dumbbell className="h-3.5 w-3.5 text-zinc-400" />
            Equipment
          </span>
          {openSections.equipment ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSections.equipment && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {EQUIPMENT_OPTIONS.map((eq) => {
              const active = selectedEquipment === eq.id;
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => onSelectEquipment(eq.id)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'border border-zinc-700 bg-zinc-800 text-white'
                      : 'border border-zinc-800/60 bg-zinc-950/40 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{eq.label}</span>
                  {active && <Check className="h-3 w-3 text-lime-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Experience Level */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <button
          type="button"
          onClick={() => toggleSection('level')}
          className="flex w-full items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            Difficulty Level
          </span>
          {openSections.level ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSections.level && (
          <div className="mt-3 flex gap-1.5">
            {EXPERIENCE_OPTIONS.map((opt) => {
              const active = selectedExperience === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectExperience(opt.id)}
                  className={`flex-1 rounded-lg py-1 text-center text-xs font-bold capitalize transition-all ${
                    active
                      ? 'bg-zinc-200 font-black text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.id === 'all' ? 'All' : opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
