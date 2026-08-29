import { useState, useEffect, useTransition, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Dumbbell,
  Filter,
  Layers,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { ExerciseCard } from '../app/features/exercise-catalog/components/ExerciseCard';
import { ExerciseFilterDrawer } from '../app/features/exercise-catalog/components/ExerciseFilterDrawer';
import { ExerciseDetailModal } from '../app/features/exercise-catalog/components/ExerciseDetailModal';
import {
  fetchCatalogFilters,
  fetchCatalogExercises,
  type CatalogExerciseItem,
  type CatalogFilters,
  type CatalogQueryParams,
} from '../app/features/exercise-catalog/services/exercise-catalog-api';

export function ExercisesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Filters catalog metadata
  const [filters, setFilters] = useState<CatalogFilters | null>(null);

  // Exercises list state
  const [exercises, setExercises] = useState<CatalogExerciseItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Mobile Filter Drawer Toggle
  const [mobileFilterOpen, setMobileFilterOpen] = useState<boolean>(false);

  // Selected Exercise Modal
  const [selectedExercise, setSelectedExercise] = useState<CatalogExerciseItem | null>(null);

  // Current query params derived from URL
  const queryParams: CatalogQueryParams = {
    q: searchParams.get('q') || undefined,
    bodyPart: searchParams.get('bodyPart') || undefined,
    primaryMuscle: searchParams.get('primaryMuscle') || undefined,
    movementPattern: searchParams.get('movementPattern') || undefined,
    equipment: searchParams.get('equipment') || undefined,
    safetyTags: searchParams.get('safetyTags') || undefined,
    level: searchParams.get('level') || undefined,
    limit: 24,
    offset: Number(searchParams.get('offset')) || 0,
  };

  const [searchInput, setSearchInput] = useState<string>(queryParams.q || '');

  // Load available filters on mount
  useEffect(() => {
    fetchCatalogFilters()
      .then((data) => setFilters(data))
      .catch((err) => console.error('Failed to load catalog filters:', err));
  }, []);

  // Update URL Search Params helper
  const updateParams = useCallback(
    (updates: Partial<CatalogQueryParams>) => {
      startTransition(() => {
        const next = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, val]) => {
          if (val === undefined || val === null || val === '' || val === 'all') {
            next.delete(key);
          } else {
            next.set(key, String(val));
          }
        });

        if (updates.offset === undefined && !('offset' in updates)) {
          next.delete('offset');
        }

        setSearchParams(next, { replace: true });
      });
    },
    [searchParams, setSearchParams]
  );

  const resetAllParams = () => {
    startTransition(() => {
      setSearchInput('');
      setSearchParams(new URLSearchParams(), { replace: true });
    });
  };

  // Debounce search input sync
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (queryParams.q || '')) {
        updateParams({ q: searchInput || undefined, offset: 0 });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, queryParams.q, updateParams]);

  // Fetch exercises whenever URL params change
  useEffect(() => {
    let active = true;
    const offset = queryParams.offset || 0;

    if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    fetchCatalogExercises(queryParams)
      .then((res) => {
        if (!active) return;
        if (offset === 0) {
          setExercises(res.data || []);
        } else {
          setExercises((prev) => [...prev, ...(res.data || [])]);
        }
        setTotalCount(res.pagination?.total || 0);
        setHasMore(res.pagination?.hasMore || false);
      })
      .catch((err) => {
        console.error('Failed to fetch catalog exercises:', err);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLoadingMore(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    searchParams.get('q'),
    searchParams.get('bodyPart'),
    searchParams.get('primaryMuscle'),
    searchParams.get('movementPattern'),
    searchParams.get('equipment'),
    searchParams.get('safetyTags'),
    searchParams.get('level'),
    searchParams.get('offset'),
  ]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextOffset = (queryParams.offset || 0) + (queryParams.limit || 24);
    updateParams({ offset: nextOffset });
  };

  // Active filter chip items
  const activeChips: Array<{ label: string; key: keyof CatalogQueryParams; value?: string }> = [];
  if (queryParams.q) activeChips.push({ label: `"${queryParams.q}"`, key: 'q' });
  if (queryParams.primaryMuscle) {
    activeChips.push({
      label: `Muscle: ${queryParams.primaryMuscle.replace(/_/g, ' ')}`,
      key: 'primaryMuscle',
    });
  }
  if (queryParams.movementPattern) {
    activeChips.push({
      label: `Pattern: ${queryParams.movementPattern.replace(/_/g, ' ')}`,
      key: 'movementPattern',
    });
  }
  if (queryParams.safetyTags) {
    queryParams.safetyTags.split(',').forEach((tag) => {
      activeChips.push({
        label: `Safe: ${tag.replace(/_/g, ' ')}`,
        key: 'safetyTags',
        value: tag,
      });
    });
  }
  if (queryParams.equipment) {
    queryParams.equipment.split(',').forEach((eq) => {
      activeChips.push({
        label: `Gear: ${eq.replace(/_/g, ' ')}`,
        key: 'equipment',
        value: eq,
      });
    });
  }
  if (queryParams.level) {
    activeChips.push({
      label: `Level: ${queryParams.level}`,
      key: 'level',
    });
  }

  const removeChip = (chip: (typeof activeChips)[0]) => {
    if (chip.key === 'equipment' && chip.value) {
      const remaining = (queryParams.equipment || '')
        .split(',')
        .filter((e) => e !== chip.value);
      updateParams({ equipment: remaining.length > 0 ? remaining.join(',') : undefined, offset: 0 });
    } else if (chip.key === 'safetyTags' && chip.value) {
      const remaining = (queryParams.safetyTags || '')
        .split(',')
        .filter((t) => t !== chip.value);
      updateParams({ safetyTags: remaining.length > 0 ? remaining.join(',') : undefined, offset: 0 });
    } else {
      updateParams({ [chip.key]: undefined, offset: 0 });
      if (chip.key === 'q') setSearchInput('');
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* 1. DESKTOP STICKY FILTER SIDEBAR */}
      <aside className="hidden lg:flex w-80 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/70 p-5 overflow-y-auto">
        <ExerciseFilterDrawer
          filters={filters}
          queryParams={queryParams}
          onUpdateParams={updateParams}
          onResetParams={resetAllParams}
        />
      </aside>

      {/* 2. MAIN CATALOG CONTENT AREA */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header & Search Bar Bar */}
        <div className="flex flex-col gap-3 border-b border-zinc-800/80 bg-zinc-950/80 p-4 sm:px-6 backdrop-blur-md shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-lime-400 text-zinc-950 font-black">
                  <Dumbbell className="h-4 w-4 stroke-[2.5]" />
                </span>
                <h1 className="text-lg font-black tracking-tight text-white uppercase">
                  Explore All Exercises
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                Explore 7,000+ biomechanically indexed movements with safety safeguards.
              </p>
            </div>

            {/* Quick Metrics Badge */}
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1 font-mono text-xs font-bold text-zinc-300">
                {loading ? 'Searching…' : `${totalCount.toLocaleString()} movements`}
              </span>

              {/* Mobile Filter Trigger Button */}
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="flex lg:hidden items-center gap-1.5 rounded-xl border border-lime-400/40 bg-lime-400/10 px-3 py-1 text-xs font-extrabold text-lime-400"
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by exercise name, target muscle, or equipment (e.g. Squat, Bulgarian, Quads)..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2.5 pl-10 pr-10 text-xs font-semibold text-white placeholder-zinc-500 outline-none transition-colors focus:border-lime-400 focus:bg-zinc-900"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateParams({ q: undefined, offset: 0 });
                }}
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
              {activeChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/90 px-2 py-0.5 text-xs font-bold text-zinc-200"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => removeChip(chip)}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={resetAllParams}
                className="text-[11px] font-bold text-lime-400 hover:underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Exercise Grid Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading && exercises.length === 0 ? (
            /* Shimmer Loading Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="aspect-video w-full rounded-xl bg-zinc-800" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-zinc-800" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-zinc-800/60" />
                </div>
              ))}
            </div>
          ) : exercises.length === 0 ? (
            /* Zero-Results State */
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-8 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-zinc-800/80 text-zinc-400">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-extrabold text-white uppercase tracking-wider">
                No movements matched your filters
              </h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-400">
                Try widening your search terms, changing muscle targets, or clearing joint restrictions.
              </p>
              <button
                type="button"
                onClick={resetAllParams}
                className="mt-4 flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-black text-zinc-950 shadow-sm transition-transform hover:scale-105"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset All Filters
              </button>
            </div>
          ) : (
            /* Exercise Cards Grid */
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {exercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    onSelect={(ex) => setSelectedExercise(ex)}
                  />
                ))}
              </div>

              {/* Infinite / Load More Action */}
              {hasMore && (
                <div className="flex justify-center pb-8 pt-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-6 py-3 text-xs font-extrabold text-white transition-all hover:border-lime-400/50 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <span className="animate-pulse font-mono">Loading more movements…</span>
                    ) : (
                      <>
                        <Layers className="h-4 w-4 text-lime-400" />
                        <span>
                          Load More Movements (Showing {exercises.length} of {totalCount})
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. MOBILE FILTER BOTTOM SHEET / MODAL */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm lg:hidden">
          <div className="flex max-h-[85vh] flex-col rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-black uppercase tracking-wider text-white">
                Filters & Anatomical Map
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
              <ExerciseFilterDrawer
                filters={filters}
                queryParams={queryParams}
                onUpdateParams={updateParams}
                onResetParams={resetAllParams}
              />
            </div>

            <div className="border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="w-full rounded-xl bg-lime-400 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 shadow-md"
              >
                View {totalCount} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXERCISE DETAIL PREVIEW MODAL */}
      <ExerciseDetailModal
        open={Boolean(selectedExercise)}
        exercise={selectedExercise}
        onClose={() => setSelectedExercise(null)}
        onSelectAlternative={(altId, altName) => {
          console.log('Selected alternative:', altId, altName);
          // Load alternative exercise detail
          fetchCatalogExercises({ q: altName, limit: 1 })
            .then((res) => {
              if (res.data && res.data.length > 0) {
                setSelectedExercise(res.data[0]);
              }
            })
            .catch((err) => console.error('Failed to switch alternative:', err));
        }}
      />
    </div>
  );
}
