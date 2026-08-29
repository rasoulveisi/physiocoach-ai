import { useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Filter,
  RotateCcw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { BodyMapSelector } from './BodyMapSelector';
import type { CatalogFilters, CatalogQueryParams } from '../services/exercise-catalog-api';

export interface ExerciseFilterDrawerProps {
  filters: CatalogFilters | null;
  queryParams: CatalogQueryParams;
  onUpdateParams(newParams: Partial<CatalogQueryParams>): void;
  onResetParams(): void;
  className?: string;
}

export function ExerciseFilterDrawer({
  filters,
  queryParams,
  onUpdateParams,
  onResetParams,
  className = '',
}: ExerciseFilterDrawerProps) {
  const [openSection, setOpenSection] = useState<{
    bodyMap: boolean;
    patterns: boolean;
    equipment: boolean;
    safety: boolean;
    level: boolean;
  }>({
    bodyMap: true,
    patterns: true,
    equipment: true,
    safety: true,
    level: false,
  });

  const toggleSection = (key: keyof typeof openSection) => {
    setOpenSection((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedEquipmentList = queryParams.equipment
    ? queryParams.equipment.split(',').map((e) => e.trim().toLowerCase())
    : [];

  const selectedSafetyTagsList = queryParams.safetyTags
    ? queryParams.safetyTags.split(',').map((t) => t.trim().toLowerCase())
    : [];

  const toggleEquipment = (eqId: string) => {
    const norm = eqId.toLowerCase();
    let updated: string[];
    if (selectedEquipmentList.includes(norm)) {
      updated = selectedEquipmentList.filter((e) => e !== norm);
    } else {
      updated = [...selectedEquipmentList, norm];
    }
    onUpdateParams({ equipment: updated.length > 0 ? updated.join(',') : undefined, offset: 0 });
  };

  const toggleSafetyTag = (tagId: string) => {
    const norm = tagId.toLowerCase();
    let updated: string[];
    if (selectedSafetyTagsList.includes(norm)) {
      updated = selectedSafetyTagsList.filter((t) => t !== norm);
    } else {
      updated = [...selectedSafetyTagsList, norm];
    }
    onUpdateParams({ safetyTags: updated.length > 0 ? updated.join(',') : undefined, offset: 0 });
  };

  const hasActiveFilters =
    Boolean(queryParams.q) ||
    Boolean(queryParams.bodyPart) ||
    Boolean(queryParams.primaryMuscle) ||
    Boolean(queryParams.movementPattern) ||
    Boolean(queryParams.equipment) ||
    Boolean(queryParams.safetyTags) ||
    Boolean(queryParams.level);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header & Reset Action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-lime-400" />
          <span className="text-sm font-extrabold tracking-tight text-white uppercase">
            Filter Catalog
          </span>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetParams}
            className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-lime-400 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </button>
        )}
      </div>

      {/* 1. Anatomical SVG Body Map Section */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-1">
        <button
          type="button"
          onClick={() => toggleSection('bodyMap')}
          className="flex w-full items-center justify-between p-2.5 text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-lime-400" />
            Interactive Body Map
          </span>
          {openSection.bodyMap ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSection.bodyMap && (
          <div className="px-2 pb-2">
            <BodyMapSelector
              selectedMuscle={queryParams.primaryMuscle}
              onSelectMuscle={(muscle) =>
                onUpdateParams({ primaryMuscle: muscle, offset: 0 })
              }
              musclesList={filters?.muscles || []}
            />
          </div>
        )}
      </div>

      {/* 2. Movement Patterns */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <button
          type="button"
          onClick={() => toggleSection('patterns')}
          className="flex w-full items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            Movement Pattern
          </span>
          {openSection.patterns ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSection.patterns && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateParams({ movementPattern: undefined, offset: 0 })}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                !queryParams.movementPattern
                  ? 'bg-cyan-400 text-zinc-950 font-black'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              All Patterns
            </button>
            {(filters?.movementPatterns || [
              { id: 'squat', name: 'Squat', count: 0 },
              { id: 'hinge', name: 'Hinge', count: 0 },
              { id: 'horizontal_push', name: 'Horizontal Push', count: 0 },
              { id: 'horizontal_pull', name: 'Horizontal Pull', count: 0 },
              { id: 'vertical_push', name: 'Vertical Push', count: 0 },
              { id: 'vertical_pull', name: 'Vertical Pull', count: 0 },
              { id: 'lunge', name: 'Lunge', count: 0 },
              { id: 'carry', name: 'Carry', count: 0 },
              { id: 'isolation', name: 'Isolation', count: 0 },
            ]).map((pattern) => {
              const active = queryParams.movementPattern?.toLowerCase() === pattern.id.toLowerCase();
              return (
                <button
                  key={pattern.id}
                  type="button"
                  onClick={() =>
                    onUpdateParams({
                      movementPattern: active ? undefined : pattern.id,
                      offset: 0,
                    })
                  }
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    active
                      ? 'bg-cyan-400 text-zinc-950 font-black shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {pattern.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Joint-Friendly Safety Tags */}
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
          {openSection.safety ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSection.safety && (
          <div className="mt-3 space-y-1.5">
            {[
              { id: 'low_spine_load', name: 'Low Spine Load (Lumbar Safe)' },
              { id: 'knee_friendly', name: 'Knee-Friendly (Patellofemoral Safe)' },
              { id: 'shoulder_friendly', name: 'Shoulder-Friendly (Rotator Cuff)' },
              { id: 'neck_safe', name: 'Neck & Cervical Safe' },
              { id: 'wrist_neutral', name: 'Wrist-Neutral' },
            ].map((tag) => {
              const active = selectedSafetyTagsList.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleSafetyTag(tag.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'border border-lime-400/40 bg-lime-400/10 text-lime-400'
                      : 'border border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{tag.name}</span>
                  {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Equipment Required */}
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
          {openSection.equipment ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSection.equipment && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {[
              { id: 'barbell', name: 'Barbell' },
              { id: 'dumbbell', name: 'Dumbbell' },
              { id: 'cable', name: 'Cable' },
              { id: 'machine', name: 'Machine' },
              { id: 'bodyweight', name: 'Bodyweight' },
              { id: 'band', name: 'Band' },
              { id: 'kettlebell', name: 'Kettlebell' },
            ].map((eq) => {
              const active = selectedEquipmentList.includes(eq.id);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleEquipment(eq.id)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'border border-zinc-700 bg-zinc-800 text-white'
                      : 'border border-zinc-800/60 bg-zinc-950/40 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{eq.name}</span>
                  {active && <Check className="h-3 w-3 text-lime-400" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Experience Level */}
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-3">
        <button
          type="button"
          onClick={() => toggleSection('level')}
          className="flex w-full items-center justify-between text-left text-xs font-extrabold uppercase tracking-wider text-zinc-300 hover:text-white"
        >
          <span>Difficulty Level</span>
          {openSection.level ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </button>

        {openSection.level && (
          <div className="mt-3 flex gap-1.5">
            {['all', 'beginner', 'intermediate', 'advanced'].map((lvl) => {
              const active = (queryParams.level || 'all').toLowerCase() === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    onUpdateParams({
                      level: lvl === 'all' ? undefined : lvl,
                      offset: 0,
                    })
                  }
                  className={`flex-1 rounded-lg py-1 text-center text-xs font-bold capitalize transition-all ${
                    active
                      ? 'bg-zinc-200 text-zinc-950 font-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
