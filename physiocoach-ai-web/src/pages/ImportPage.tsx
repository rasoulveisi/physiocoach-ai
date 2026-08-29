import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Dumbbell,
  Sparkles,
  RefreshCw,
  FolderDown,
  Layers,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  parseWorkoutFile,
  fuzzyMatchExercise,
  type ParsedImportWorkout,
  type CatalogExerciseItem,
  type ParseResult,
} from '../services/workoutImporter';
import { apiClient } from '../services/api-client';

export function ImportPage() {
  const [catalog, setCatalog] = useState<CatalogExerciseItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappings, setMappings] = useState<Record<string, string | null>>({});
  const [saveTemplates, setSaveTemplates] = useState(true);
  const [importHistory, setImportHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successCount, setSuccessCount] = useState<{ workouts: number; sets: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiClient
      .get<{ data: CatalogExerciseItem[] }>('exercise-catalog/exercises?limit=500')
      .then((res) => {
        setCatalog(res.data ?? []);
      })
      .catch(() => {
        // Continue even if catalog load fails (will fallback to custom exercises)
      })
      .finally(() => setLoadingCatalog(false));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseWorkoutFile(text, file.name);

        if (result.workouts.length === 0) {
          throw new Error('No workout sessions found in file.');
        }

        setParseResult(result);

        // Run simple fuzzy matching
        const initialMap: Record<string, string | null> = {};
        for (const name of result.uniqueExercises) {
          const matched = fuzzyMatchExercise(name, catalog);
          initialMap[name] = matched.id;
        }
        setMappings(initialMap);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to parse workout file.');
      }
    };

    reader.onerror = () => {
      setErrorMessage('Could not read the uploaded file.');
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.workouts.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        mappings,
        workouts: parseResult.workouts,
        saveTemplatesAsPlans: saveTemplates,
        importHistoricalLogs: importHistory,
      };

      const res = await apiClient.post<{
        data: { importedWorkoutsCount: number; importedSetsCount: number };
      }>('import/confirm-mapping', payload);

      const totalSets = parseResult.workouts.reduce(
        (sum, w) => sum + w.exercises.reduce((sSum, ex) => sSum + ex.sets.length, 0),
        0,
      );

      setSuccessCount({
        workouts: res.data?.importedWorkoutsCount ?? parseResult.workouts.length,
        sets: res.data?.importedSetsCount ?? totalSets,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to import workouts. Please check your data and retry.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSetsCount =
    parseResult?.workouts.reduce(
      (sum, w) => sum + w.exercises.reduce((sSum, ex) => sSum + ex.sets.length, 0),
      0,
    ) ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-400">
            <Sparkles className="size-4" />
            <span>Migration Assistant</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            1-Click Workout Importer
          </h1>
          <p className="text-sm text-zinc-400">
            Seamlessly import routines and training history from Hevy, Strong, Lyfta, or CSV files.
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-200">
            <AlertCircle className="size-5 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* State 1: Success Banner */}
        {successCount ? (
          <div className="rounded-3xl border border-lime-400/30 bg-zinc-900 p-8 text-center shadow-xl space-y-6 animate-in fade-in">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-lime-400/10 text-lime-400">
              <CheckCircle2 className="size-9 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Workouts Successfully Imported!</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Your history and routine templates are now saved to your library.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto font-mono text-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-2xl font-black text-lime-400">{successCount.workouts}</div>
                <div className="text-[11px] text-zinc-500 uppercase">Workouts</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="text-2xl font-black text-cyan-400">{successCount.sets}</div>
                <div className="text-[11px] text-zinc-500 uppercase">Sets Logged</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to="/plan"
                className="w-full sm:w-auto rounded-xl bg-lime-400 px-6 py-2.5 text-xs font-black text-zinc-950 hover:bg-lime-300 transition-colors"
              >
                View Workout Plans
              </Link>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-2.5 text-xs font-bold text-zinc-300 hover:text-white transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : !parseResult ? (
          /* State 2: Upload Dropzone */
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center space-y-6 shadow-xl">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-zinc-800 hover:border-lime-400/50 bg-zinc-950/60 p-10 transition-all flex flex-col items-center justify-center space-y-4"
            >
              <div className="grid size-14 place-items-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-lime-400 group-hover:scale-105 transition-all">
                <UploadCloud className="size-7" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Click or drag & drop workout file here</p>
                <p className="text-xs text-zinc-400 mt-1">Supports Hevy CSV, Strong CSV, Lyfta JSON, or standard CSV files</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <FolderDown className="size-4 text-cyan-400" />
                  <span>Hevy / Strong</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Export CSV from settings in your app and upload here.</p>
              </div>
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <FileText className="size-4 text-lime-400" />
                  <span>Lyfta Export</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Directly accepts Lyfta JSON workout backups.</p>
              </div>
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Layers className="size-4 text-amber-400" />
                  <span>Set Types</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Preserves Normal, Warmup, Drop, and Failure tags.</p>
              </div>
            </div>
          </div>
        ) : (
          /* State 3: Review & Exercise Mapping Table */
          <div className="space-y-6">
            {/* File Summary Card */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 flex flex-wrap items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="grid size-11 place-items-center rounded-2xl bg-lime-400/10 text-lime-400">
                  <Dumbbell className="size-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-lime-400">
                    Source: {parseResult.sourceType.toUpperCase()}
                  </div>
                  <div className="text-sm font-extrabold text-white">
                    {parseResult.workouts.length} Workouts • {parseResult.uniqueExercises.length} Unique Exercises ({totalSetsCount} sets)
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setParseResult(null)}
                className="text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Choose different file
              </button>
            </div>

            {/* Options */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={saveTemplates}
                  onChange={(e) => setSaveTemplates(e.target.checked)}
                  className="rounded accent-lime-400 size-4"
                />
                <span className="font-bold">Save routines as Workout Plan templates</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={importHistory}
                  onChange={(e) => setImportHistory(e.target.checked)}
                  className="rounded accent-lime-400 size-4"
                />
                <span className="font-bold">Import historical completed sessions</span>
              </label>
            </div>

            {/* Review Mapping Table */}
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl">
              <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Exercise Mapping Review
                </h3>
                <span className="text-[11px] font-mono text-zinc-500">
                  {Object.values(mappings).filter(Boolean).length} / {parseResult.uniqueExercises.length} Mapped to Catalog
                </span>
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800/60">
                {parseResult.uniqueExercises.map((rawName) => {
                  const currentMasterId = mappings[rawName];

                  return (
                    <div
                      key={rawName}
                      className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-white truncate">{rawName}</div>
                        <div className="text-[11px] text-zinc-500">Imported name</div>
                      </div>

                      <div className="sm:w-72">
                        <select
                          value={currentMasterId || ''}
                          onChange={(e) =>
                            setMappings({
                              ...mappings,
                              [rawName]: e.target.value || null,
                            })
                          }
                          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 focus:border-lime-400 focus:outline-none"
                        >
                          <option value="">(Import as Custom Exercise)</option>
                          {catalog.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setParseResult(null)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-2.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-6 py-2.5 text-xs font-black text-zinc-950 shadow-md hover:bg-lime-300 disabled:opacity-50 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>Importing Workouts...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Import ({parseResult.workouts.length} Workouts)</span>
                    <ArrowRight className="size-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
