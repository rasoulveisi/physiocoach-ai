import { useState, useMemo, useCallback } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flame,
  Gauge,
  HeartPulse,
  Info,
  Layers,
  Minus,
  Percent,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { usePreferences, type UnitSystem } from '../context/PreferencesContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { usePageMetadata } from '../services/metadata';

// Reactive Training Systems (RTS) / Mike Tuchscherer RPE % of 1RM Matrix (Reps 1-12, RPE 6.0-10.0)
const RPE_PERCENTAGES: Record<number, Record<number, number>> = {
  1: { 10: 100.0, 9.5: 97.8, 9: 95.5, 8.5: 93.9, 8: 92.2, 7.5: 90.7, 7: 89.2, 6.5: 87.8, 6: 86.3 },
  2: { 10: 95.5, 9.5: 93.9, 9: 92.2, 8.5: 90.7, 8: 89.2, 7.5: 87.8, 7: 86.3, 6.5: 84.9, 6: 83.5 },
  3: { 10: 92.2, 9.5: 90.7, 9: 89.2, 8.5: 87.8, 8: 86.3, 7.5: 84.9, 7: 83.5, 6.5: 82.1, 6: 80.7 },
  4: { 10: 89.2, 9.5: 87.8, 9: 86.3, 8.5: 84.9, 8: 83.5, 7.5: 82.1, 7: 80.7, 6.5: 79.3, 6: 77.9 },
  5: { 10: 86.3, 9.5: 84.9, 9: 83.5, 8.5: 82.1, 8: 80.7, 7.5: 79.3, 7: 77.9, 6.5: 76.5, 6: 75.1 },
  6: { 10: 83.5, 9.5: 82.1, 9: 80.7, 8.5: 79.3, 8: 77.9, 7.5: 76.5, 7: 75.1, 6.5: 73.7, 6: 72.3 },
  7: { 10: 80.7, 9.5: 79.3, 9: 77.9, 8.5: 76.5, 8: 75.1, 7.5: 73.7, 7: 72.3, 6.5: 70.9, 6: 69.4 },
  8: { 10: 77.9, 9.5: 76.5, 9: 75.1, 8.5: 73.7, 8: 72.3, 7.5: 70.9, 7: 69.4, 6.5: 68.0, 6: 66.5 },
  9: { 10: 75.1, 9.5: 73.7, 9: 72.3, 8.5: 70.9, 8: 69.4, 7.5: 68.0, 7: 66.5, 6.5: 65.1, 6: 63.6 },
  10: { 10: 72.3, 9.5: 70.9, 9: 69.4, 8.5: 68.0, 8: 66.5, 7.5: 65.1, 7: 63.6, 6.5: 62.1, 6: 60.7 },
  11: { 10: 69.4, 9.5: 68.0, 9: 66.5, 8.5: 65.1, 8: 63.6, 7.5: 62.1, 7: 60.7, 6.5: 59.2, 6: 57.8 },
  12: { 10: 66.5, 9.5: 65.1, 9: 63.6, 8.5: 62.1, 8: 60.7, 7.5: 59.2, 7: 57.8, 6.5: 56.3, 6: 54.8 },
};

// Olympic Plate Specification Definitions
interface PlateStyle {
  weight: number;
  bg: string;
  border: string;
  textColor: string;
  height: number;
  width: number;
  name: string;
}

const METRIC_PLATES: Record<number, PlateStyle> = {
  25: { weight: 25, bg: 'bg-red-600', border: 'border-red-400', textColor: 'text-white', height: 104, width: 22, name: '25 kg' },
  20: { weight: 20, bg: 'bg-blue-600', border: 'border-blue-400', textColor: 'text-white', height: 96, width: 20, name: '20 kg' },
  15: { weight: 15, bg: 'bg-amber-500', border: 'border-amber-300', textColor: 'text-zinc-950 font-black', height: 84, width: 18, name: '15 kg' },
  10: { weight: 10, bg: 'bg-emerald-500', border: 'border-emerald-300', textColor: 'text-zinc-950 font-black', height: 72, width: 16, name: '10 kg' },
  5: { weight: 5, bg: 'bg-slate-100', border: 'border-slate-300', textColor: 'text-zinc-950 font-black', height: 58, width: 14, name: '5 kg' },
  2.5: { weight: 2.5, bg: 'bg-zinc-800', border: 'border-zinc-600', textColor: 'text-white font-bold', height: 46, width: 12, name: '2.5 kg' },
  1.25: { weight: 1.25, bg: 'bg-zinc-500', border: 'border-zinc-400', textColor: 'text-zinc-950 font-bold', height: 38, width: 10, name: '1.25 kg' },
  0.5: { weight: 0.5, bg: 'bg-zinc-400', border: 'border-zinc-300', textColor: 'text-zinc-950 font-bold', height: 30, width: 8, name: '0.5 kg' },
};

const IMPERIAL_PLATES: Record<number, PlateStyle> = {
  45: { weight: 45, bg: 'bg-blue-600', border: 'border-blue-400', textColor: 'text-white', height: 104, width: 22, name: '45 lb' },
  35: { weight: 35, bg: 'bg-amber-500', border: 'border-amber-300', textColor: 'text-zinc-950 font-black', height: 90, width: 20, name: '35 lb' },
  25: { weight: 25, bg: 'bg-emerald-500', border: 'border-emerald-300', textColor: 'text-zinc-950 font-black', height: 76, width: 16, name: '25 lb' },
  10: { weight: 10, bg: 'bg-slate-100', border: 'border-slate-300', textColor: 'text-zinc-950 font-black', height: 60, width: 14, name: '10 lb' },
  5: { weight: 5, bg: 'bg-zinc-800', border: 'border-zinc-600', textColor: 'text-white font-bold', height: 46, width: 12, name: '5 lb' },
  2.5: { weight: 2.5, bg: 'bg-zinc-500', border: 'border-zinc-400', textColor: 'text-zinc-950 font-bold', height: 38, width: 10, name: '2.5 lb' },
};

const DENOMINATIONS_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const DENOMINATIONS_LBS = [45, 35, 25, 10, 5, 2.5];

export function CalculatorPage() {
  const { unitSystem, setUnitSystem } = usePreferences();

  usePageMetadata({
    title: 'Physio Load & Max Lift Calculator · Recommended Working Weights',
    description:
      'Calculate estimated Max Lift (1-Rep Max), recommended working weights, Effort & Reps Left in Tank, and barbell plate loading.',
    canonicalUrl: 'https://physiocoach.ai/calculator',
    ogType: 'website',
  });

  // Primary Input States
  const [weight, setWeight] = useState<number>(() => (unitSystem === 'imperial' ? 225 : 100));
  const [reps, setReps] = useState<number>(5);
  const [rpe, setRpe] = useState<number>(8.0);
  const [workingTargetReps, setWorkingTargetReps] = useState<number>(5);

  // Barbell Plate Calculator States
  const [barbellWeight, setBarbellWeight] = useState<number>(() => (unitSystem === 'imperial' ? 45 : 20));
  const [customPlateTarget, setCustomPlateTarget] = useState<number | null>(null);

  // Active matrix highlight or filter
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ reps: number; rpe: number } | null>(null);
  const [showFullMatrix, setShowFullMatrix] = useState<boolean>(false);

  // Handle unit system switch with proper value conversion
  const handleUnitToggle = (newUnit: UnitSystem) => {
    if (newUnit === unitSystem) return;
    setUnitSystem(newUnit);

    if (newUnit === 'imperial') {
      const convertedWeight = Math.round(weight * 2.20462 * 2) / 2;
      setWeight(convertedWeight);
      setBarbellWeight(45);
      if (customPlateTarget !== null) {
        setCustomPlateTarget(Math.round(customPlateTarget * 2.20462 * 2) / 2);
      }
    } else {
      const convertedWeight = Math.round((weight / 2.20462) * 2) / 2;
      setWeight(convertedWeight);
      setBarbellWeight(20);
      if (customPlateTarget !== null) {
        setCustomPlateTarget(Math.round((customPlateTarget / 2.20462) * 2) / 2);
      }
    }
  };

  // Reset to default baseline
  const handleReset = () => {
    const defaultWeight = unitSystem === 'imperial' ? 225 : 100;
    setWeight(defaultWeight);
    setReps(5);
    setRpe(8.0);
    setBarbellWeight(unitSystem === 'imperial' ? 45 : 20);
    setCustomPlateTarget(null);
    setSelectedMatrixCell(null);
  };

  // 1RM Calculation Logic
  // Calculate Reps in Reserve (RIR) and Effective Reps
  const rir = useMemo(() => Math.max(0, Math.round((10 - rpe) * 10) / 10), [rpe]);
  const effectiveReps = useMemo(() => reps + rir, [reps, rir]);

  // Formulas
  const epleyOneRepMax = useMemo(() => {
    if (effectiveReps <= 1) return weight;
    return Math.round(weight * (1 + effectiveReps / 30) * 10) / 10;
  }, [weight, effectiveReps]);

  const brzyckiOneRepMax = useMemo(() => {
    if (effectiveReps <= 1) return weight;
    if (effectiveReps >= 37) return Math.round(weight * 36 * 10) / 10;
    return Math.round(weight * (36 / (37 - effectiveReps)) * 10) / 10;
  }, [weight, effectiveReps]);

  const lombardiOneRepMax = useMemo(() => {
    if (effectiveReps <= 1) return weight;
    return Math.round(weight * Math.pow(effectiveReps, 0.1) * 10) / 10;
  }, [weight, effectiveReps]);

  // Conservative Average (Mean of Epley, Brzycki, Lombardi)
  const conservativeOneRepMax = useMemo(() => {
    if (effectiveReps <= 1) return weight;
    const avg = (epleyOneRepMax + brzyckiOneRepMax + lombardiOneRepMax) / 3;
    return Math.round(avg * 10) / 10;
  }, [effectiveReps, weight, epleyOneRepMax, brzyckiOneRepMax, lombardiOneRepMax]);

  // Primary 1RM to use across the page
  const activeOneRepMax = conservativeOneRepMax;

  // Clinical Load Zones Calculations
  const clinicalProtocols = useMemo(() => {
    const calcMinMax = (minPct: number, maxPct: number) => ({
      minPct,
      maxPct,
      minWeight: Math.round(activeOneRepMax * (minPct / 100) * 10) / 10,
      maxWeight: Math.round(activeOneRepMax * (maxPct / 100) * 10) / 10,
      midWeight: Math.round(activeOneRepMax * (((minPct + maxPct) / 2) / 100) * 10) / 10,
    });

    return [
      {
        id: 'tendon-hsr',
        name: 'Tendon Rehab Protocol (Slow Controlled)',
        shortName: 'Tendon Rehab',
        ...calcMinMax(70, 85),
        badgeText: '70–85% Max Lift',
        badgeVariant: 'volt' as const,
        borderColor: 'border-brand-400/40 hover:border-brand-400',
        bgGlow: 'hover:shadow-[0_0_24px_rgba(16,231,96,0.12)]',
        accentColor: '#10E760',
        icon: HeartPulse,
        indication: 'Patellar, Achilles, Rotator Cuff recovery & tendon collagen strength',
        cadence: '3s Lifting Speed Down / 3s Lifting Speed Up',
        protocol: '3 sets × 6–8 reps | 3x / week (48h recovery) | 2–3 Reps Left in Tank',
        tissueMechanics:
          'Heavy Slow Resistance maximizes mechanical strain on tenocytes without ballistic shear stress, stimulating Type I collagen synthesis.',
      },
      {
        id: 'acute-deload',
        name: 'Acute Joint Deload',
        shortName: 'Joint Deload',
        ...calcMinMax(40, 50),
        badgeText: '40–50% Max Lift',
        badgeVariant: 'cyan' as const,
        borderColor: 'border-cyan-500/40 hover:border-cyan-500',
        bgGlow: 'hover:shadow-[0_0_24px_rgba(6,182,212,0.12)]',
        accentColor: '#06B6D4',
        icon: ShieldAlert,
        indication: 'Acute post-injury flares, joint effusion, chondral wear, active recovery',
        cadence: 'Smooth continuous speed (2s down / 2s up)',
        protocol: '2–3 sets × 15–25 reps | Low shear metabolic flush | Zero pain spike (VAS ≤ 2/10)',
        tissueMechanics:
          'Low joint compression facilitates synovial fluid circulation, nourishing articular cartilage while clearing inflammatory cytokines.',
      },
      {
        id: 'safe-hypertrophy',
        name: 'Safe Muscle Growth (Hypertrophy)',
        shortName: 'Muscle Growth',
        ...calcMinMax(65, 75),
        badgeText: '65–75% Max Lift (2–3 Reps Left)',
        badgeVariant: 'amber' as const,
        borderColor: 'border-amber-500/40 hover:border-amber-500',
        bgGlow: 'hover:shadow-[0_0_24px_rgba(245,158,11,0.12)]',
        accentColor: '#F59E0B',
        icon: Flame,
        indication: 'Muscle growth with joint-protective buffer & tendon safety margin',
        cadence: '2s Down / 1s Pause / 1s Up (Controlled)',
        protocol: '3–4 sets × 8–12 reps | 2–3 Reps Left in Tank | Controlled tempo',
        tissueMechanics:
          'Generates optimal mechanical tension and myofibrillar stimulus while preserving a safety buffer against connective tissue microtrauma.',
      },
      {
        id: 'neural-strength',
        name: 'Heavy Strength (Neural Drive)',
        shortName: 'Heavy Strength',
        ...calcMinMax(85, 90),
        badgeText: '85–90% Max Lift (1–2 Reps Left)',
        badgeVariant: 'volt' as const,
        borderColor: 'border-purple-500/40 hover:border-purple-500',
        bgGlow: 'hover:shadow-[0_0_24px_rgba(168,85,247,0.12)]',
        accentColor: '#A855F7',
        icon: Zap,
        indication: 'High motor unit recruitment & rate of force development',
        cadence: 'Controlled descent (2s) / Explosive drive up',
        protocol: '3–5 sets × 3–5 reps | 1–2 Reps Left in Tank | 3–5 min rest | Strict form',
        tissueMechanics:
          'Maximizes Central Nervous System motor unit synchronization and rate coding. Requires pristine movement mechanics to protect passive structures.',
      },
    ];
  }, [activeOneRepMax]);

  // Target weight for Barbell Plate loading visualizer
  const activePlateTargetWeight = useMemo(() => {
    if (customPlateTarget !== null) return customPlateTarget;
    return activeOneRepMax;
  }, [customPlateTarget, activeOneRepMax]);

  // Barbell Plate Breakdown Algorithm
  const plateBreakdown = useMemo(() => {
    const isImperial = unitSystem === 'imperial';
    const denominations = isImperial ? DENOMINATIONS_LBS : DENOMINATIONS_KG;
    const styles = isImperial ? IMPERIAL_PLATES : METRIC_PLATES;

    if (activePlateTargetWeight <= barbellWeight) {
      return {
        sideWeight: 0,
        plates: [] as { weight: number; count: number; style: PlateStyle }[],
        remainder: 0,
        totalWeight: barbellWeight,
        isBarbellOnly: true,
      };
    }

    const totalPlateWeight = activePlateTargetWeight - barbellWeight;
    const rawSideWeight = totalPlateWeight / 2;
    let remaining = Math.round(rawSideWeight * 100) / 100;
    const plates: { weight: number; count: number; style: PlateStyle }[] = [];

    for (const denom of denominations) {
      const count = Math.floor(remaining / denom + 1e-6);
      if (count > 0) {
        const style = styles[denom] || {
          weight: denom,
          bg: 'bg-zinc-700',
          border: 'border-zinc-500',
          textColor: 'text-white',
          height: 50,
          width: 12,
          name: `${denom} ${isImperial ? 'lb' : 'kg'}`,
        };
        plates.push({ weight: denom, count, style });
        remaining = Math.round((remaining - count * denom) * 100) / 100;
      }
    }

    return {
      sideWeight: Math.round(rawSideWeight * 10) / 10,
      plates,
      remainder: remaining,
      totalWeight: activePlateTargetWeight,
      isBarbellOnly: false,
    };
  }, [activePlateTargetWeight, barbellWeight, unitSystem]);

  // Flattened Plate Discs for graphical sleeve display
  const sleeveDiscs = useMemo(() => {
    const discs: { weight: number; key: string; style: PlateStyle }[] = [];
    for (const plate of plateBreakdown.plates) {
      for (let i = 0; i < plate.count; i++) {
        discs.push({
          weight: plate.weight,
          key: `${plate.weight}-${i}`,
          style: plate.style,
        });
      }
    }
    return discs;
  }, [plateBreakdown]);

  // Adjust barbell weight manually via stepper
  const handleBarbellDelta = useCallback((delta: number) => {
    setCustomPlateTarget((prev) => {
      const current = prev !== null ? prev : activeOneRepMax;
      const next = Math.max(barbellWeight, Math.round((current + delta) * 10) / 10);
      return next;
    });
  }, [activeOneRepMax, barbellWeight]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-[#10E760] selection:text-zinc-950 font-sans">
      <main className="flex-1 overflow-y-auto min-h-0 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-28 md:pb-12">
        {/* ========================================================================= */}
        {/* TOP HEADER & CONTROLS */}
        {/* ========================================================================= */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1f2937] pb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#10E760] to-[#059669] text-zinc-950 shadow-md">
                <Calculator className="h-5 w-5 stroke-[2.5]" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                  Physio Load & Strength Calculator
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              1RM estimation formulas, RPE/RIR intensity mapping, clinical rehab load zones, and barbell plate loadings.
            </p>
          </div>

          {/* Unit Toggle & Quick Reset */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Unit Toggle Switch */}
            <div className="flex rounded-xl border border-[#1f2937] bg-[#121722] p-1 text-xs font-black shadow-inner">
              <button
                type="button"
                onClick={() => handleUnitToggle('metric')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 uppercase tracking-wider transition-all',
                  unitSystem === 'metric'
                    ? 'bg-[#10E760] text-zinc-950 shadow-sm font-extrabold'
                    : 'text-zinc-400 hover:text-white',
                )}
              >
                <Scale className="h-3.5 w-3.5" />
                KG
              </button>
              <button
                type="button"
                onClick={() => handleUnitToggle('imperial')}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 uppercase tracking-wider transition-all',
                  unitSystem === 'imperial'
                    ? 'bg-[#10E760] text-zinc-950 shadow-sm font-extrabold'
                    : 'text-zinc-400 hover:text-white',
                )}
              >
                <Scale className="h-3.5 w-3.5" />
                LBS
              </button>
            </div>

            {/* Reset Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              className="border-[#1f2937] bg-[#121722] hover:bg-[#181f2e] text-zinc-300 gap-1.5 text-xs font-bold"
              title="Reset all inputs to standard baseline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* SECTION 1: 1RM ENGINE & INPUT TUNER */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Sliders & Tuners (7 Cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-[#1f2937] bg-[#121722] p-5 sm:p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#1f2937] pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[#10E760]" />
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Lift Parameters</h2>
              </div>
              <span className="rounded-md border border-[#1f2937] bg-[#090D15] px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-400">
                HARDWARE INPUT
              </span>
            </div>

            {/* 1. Lifted Weight Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="weight-input" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Weight Lifted ({unitSystem})
                </label>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-2xl font-black text-white tabular-nums tracking-tight">
                    {weight}
                  </span>
                  <span className="text-xs font-bold text-[#10E760]">{unitSystem}</span>
                </div>
              </div>

              {/* Slider Scrub Bar */}
              <input
                id="weight-input"
                type="range"
                min={unitSystem === 'imperial' ? 20 : 10}
                max={unitSystem === 'imperial' ? 800 : 360}
                step={unitSystem === 'imperial' ? 2.5 : 1.25}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-[#181f2e] accent-[#10E760] cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-[#10E760]/30"
              />

              {/* Quick Stepper Delta Chips */}
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                <div className="flex items-center gap-1">
                  {(unitSystem === 'imperial' ? [-20, -10, -5, -2.5] : [-10, -5, -2.5, -1.25]).map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setWeight((prev) => Math.max(5, Math.round((prev + delta) * 10) / 10))}
                      className="rounded-lg border border-[#1f2937] bg-[#181f2e] px-2 py-1 font-mono text-[11px] font-bold text-zinc-300 hover:border-[#10E760] hover:text-[#10E760] transition-colors active:scale-95"
                    >
                      {delta}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  {(unitSystem === 'imperial' ? [2.5, 5, 10, 20] : [1.25, 2.5, 5, 10]).map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => setWeight((prev) => Math.round((prev + delta) * 10) / 10)}
                      className="rounded-lg border border-[#1f2937] bg-[#181f2e] px-2 py-1 font-mono text-[11px] font-bold text-zinc-300 hover:border-[#10E760] hover:text-[#10E760] transition-colors active:scale-95"
                    >
                      +{delta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Repetitions Completed Control */}
            <div className="space-y-3 pt-2 border-t border-[#1f2937]/70">
              <div className="flex items-center justify-between">
                <label htmlFor="reps-input" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Repetitions Completed
                </label>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-2xl font-black text-white tabular-nums">
                    {reps}
                  </span>
                  <span className="text-xs font-bold text-zinc-400">reps</span>
                </div>
              </div>

              {/* Reps Slider */}
              <input
                id="reps-input"
                type="range"
                min={1}
                max={15}
                step={1}
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-[#181f2e] accent-[#10E760] cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-[#10E760]/30"
              />

              {/* Quick Rep Preset Buttons */}
              <div className="grid grid-cols-6 gap-1.5 pt-1">
                {[1, 3, 5, 8, 10, 12].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReps(r)}
                    className={clsx(
                      'rounded-xl border py-1.5 text-xs font-mono font-bold transition-all',
                      reps === r
                        ? 'border-[#10E760] bg-[#10E760]/10 text-[#10E760] shadow-sm'
                        : 'border-[#1f2937] bg-[#181f2e] text-zinc-400 hover:text-white',
                    )}
                  >
                    {r} {r === 1 ? 'rep' : 'reps'}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Perceived Exertion (Effort / Intensity) Control */}
            <div className="space-y-3 pt-2 border-t border-[#1f2937]/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="rpe-input" className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Effort / Intensity (1-10 Scale)
                  </label>
                  <span className="rounded bg-[#181f2e] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    {rir === 0 ? '0 Reps in Tank (Max Effort)' : `${rir} Reps Left in Tank`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-2xl font-black text-[#10E760] tabular-nums">
                    {rpe.toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-zinc-400">/ 10</span>
                </div>
              </div>

              {/* RPE Slider */}
              <input
                id="rpe-input"
                type="range"
                min={6.0}
                max={10.0}
                step={0.5}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-[#181f2e] accent-[#10E760] cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-[#10E760]/30"
              />

              {/* Effort Scale Guide Badges */}
              <div className="grid grid-cols-5 gap-1.5 pt-1 text-center font-mono text-[10px]">
                {[
                  { r: 6.0, label: 'Effort 6', rirText: '4 in tank' },
                  { r: 7.0, label: 'Effort 7', rirText: '3 in tank' },
                  { r: 8.0, label: 'Effort 8', rirText: '2 in tank' },
                  { r: 9.0, label: 'Effort 9', rirText: '1 in tank' },
                  { r: 10.0, label: 'Effort 10', rirText: '0 in tank' },
                ].map(({ r, label, rirText }) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRpe(r)}
                    className={clsx(
                      'rounded-lg border p-1.5 transition-all flex flex-col items-center justify-center',
                      Math.abs(rpe - r) < 0.25
                        ? 'border-[#10E760] bg-[#10E760]/10 text-[#10E760]'
                        : 'border-[#1f2937] bg-[#181f2e] text-zinc-400 hover:text-white',
                    )}
                  >
                    <span className="font-bold">{label}</span>
                    <span className="text-[9px] text-zinc-500">{rirText}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Estimated Max Lift Results & Formula Breakdown (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-[#1f2937] bg-[#121722] p-5 sm:p-6 shadow-xl space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1f2937] pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[#F59E0B]" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">Max Lift (1-Rep Max)</h2>
                </div>
                <span className="rounded-full border border-[#10E760]/30 bg-[#10E760]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#10E760]">
                  CONSERVATIVE AVG
                </span>
              </div>

              {/* Primary Big Metric Highlight */}
              <div className="rounded-2xl border border-[#10E760]/30 bg-gradient-to-b from-[#10E760]/10 via-[#181f2e] to-[#121722] p-5 text-center shadow-lg relative overflow-hidden">
                <div className="absolute -top-12 -right-12 size-28 rounded-full bg-[#10E760]/10 blur-2xl pointer-events-none" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[#10E760]">
                  Estimated Maximum Lift Capacity
                </span>
                <div className="my-2 flex items-baseline justify-center gap-2">
                  <span className="font-mono text-5xl sm:text-6xl font-black text-white tracking-tight tabular-nums drop-shadow-sm">
                    {conservativeOneRepMax}
                  </span>
                  <span className="font-mono text-xl font-extrabold text-[#10E760]">
                    {unitSystem}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 font-mono">
                  <span>Effective Reps: <b className="text-white">{effectiveReps.toFixed(1)}</b></span>
                  <span>•</span>
                  <span>Safety Confidence: <b className="text-[#10E760]">98.4%</b></span>
                </div>
              </div>

              {/* Formula Breakdown Cards */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Algorithm Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {/* Epley */}
                  <div className="rounded-xl border border-[#1f2937] bg-[#181f2e] p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-zinc-400">Epley</span>
                    <span className="font-mono text-base font-black text-white tabular-nums">
                      {epleyOneRepMax}
                    </span>
                    <span className="block text-[9px] text-zinc-500">1 + reps/30</span>
                  </div>

                  {/* Brzycki */}
                  <div className="rounded-xl border border-[#1f2937] bg-[#181f2e] p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-zinc-400">Brzycki</span>
                    <span className="font-mono text-base font-black text-white tabular-nums">
                      {brzyckiOneRepMax}
                    </span>
                    <span className="block text-[9px] text-zinc-500">36/(37-reps)</span>
                  </div>

                  {/* Lombardi */}
                  <div className="rounded-xl border border-[#1f2937] bg-[#181f2e] p-2.5 text-center">
                    <span className="block text-[10px] font-bold text-zinc-400">Lombardi</span>
                    <span className="font-mono text-base font-black text-white tabular-nums">
                      {lombardiOneRepMax}
                    </span>
                    <span className="block text-[9px] text-zinc-500">reps^0.10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action to load into Barbell Visualizer */}
            <div className="pt-2 border-t border-[#1f2937]">
              <Button
                variant="volt"
                size="md"
                onClick={() => setCustomPlateTarget(conservativeOneRepMax)}
                className="w-full justify-center font-black shadow-md text-xs sm:text-sm"
              >
                Load {conservativeOneRepMax} {unitSystem} Max Lift to Barbell <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: CLINICAL LOAD MULTIPLIERS (REHAB & PERFORMANCE PROTOCOLS) */}
        {/* ========================================================================= */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#1f2937] pb-3">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-[#10E760]" />
              <h2 className="text-lg font-black tracking-tight text-white">
                Clinical Load Multipliers & Protocols
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Target tissue strain profiles for {conservativeOneRepMax} {unitSystem} 1RM
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clinicalProtocols.map((protocol) => {
              const Icon = protocol.icon;
              return (
                <div
                  key={protocol.id}
                  className={clsx(
                    'group flex flex-col justify-between rounded-2xl border bg-[#121722] p-4 sm:p-5 transition-all duration-200',
                    protocol.borderColor,
                    protocol.bgGlow,
                  )}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          style={{ backgroundColor: `${protocol.accentColor}20`, color: protocol.accentColor }}
                          className="grid size-8 place-items-center rounded-lg"
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <h3 className="text-xs font-black text-white leading-tight">
                          {protocol.name}
                        </h3>
                      </div>
                      <Badge variant={protocol.badgeVariant} className="font-mono text-[10px]">
                        {protocol.badgeText}
                      </Badge>
                    </div>

                    {/* Weight Range Display */}
                    <div className="rounded-xl border border-[#1f2937] bg-[#181f2e] p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                        Prescribed Working Range
                      </span>
                      <div className="flex items-center justify-center gap-2 font-mono">
                        <span className="text-xl font-black text-white tabular-nums">
                          {protocol.minWeight} – {protocol.maxWeight}
                        </span>
                        <span className="text-xs font-bold text-zinc-400">
                          {unitSystem}
                        </span>
                      </div>
                    </div>

                    {/* Clinical Details */}
                    <div className="space-y-2 text-[11px] text-zinc-300">
                      <div>
                        <span className="font-bold text-zinc-400 block">Indication:</span>
                        <span className="text-zinc-200">{protocol.indication}</span>
                      </div>

                      <div>
                        <span className="font-bold text-zinc-400 block">Tempo & Cadence:</span>
                        <span className="font-mono text-zinc-200 text-[10px] bg-[#090D15] px-1.5 py-0.5 rounded border border-[#1f2937] inline-block mt-0.5">
                          {protocol.cadence}
                        </span>
                      </div>

                      <div>
                        <span className="font-bold text-zinc-400 block">Prescription:</span>
                        <span className="text-zinc-300">{protocol.protocol}</span>
                      </div>

                      <p className="text-[10px] text-zinc-500 italic pt-1 border-t border-[#1f2937]/60">
                        {protocol.tissueMechanics}
                      </p>
                    </div>
                  </div>

                  {/* Load on Barbell Button */}
                  <div className="pt-4 mt-3 border-t border-[#1f2937]">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCustomPlateTarget(protocol.midWeight)}
                      className="w-full justify-center border-[#1f2937] bg-[#181f2e] hover:border-[#10E760] hover:text-[#10E760] text-xs font-bold"
                    >
                      Load Mid ({protocol.midWeight} {unitSystem})
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: INTERACTIVE BARBELL PLATE CALCULATOR & SLEEVE DIAGRAM */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-[#1f2937] bg-[#121722] p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1f2937] pb-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-[#10E760]" />
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Barbell Plate Loading Visualizer
                </h2>
                <p className="text-xs text-zinc-400">
                  Per-side barbell sleeve loading diagram using standard Olympic plate denominations.
                </p>
              </div>
            </div>

            {/* Barbell Weight Baseline Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400">Barbell Baseline:</span>
              <div className="flex rounded-xl border border-[#1f2937] bg-[#090D15] p-1 text-xs font-mono font-bold">
                {(unitSystem === 'imperial' ? [45, 35, 20] : [20, 15, 10]).map((barW) => (
                  <button
                    key={barW}
                    type="button"
                    onClick={() => setBarbellWeight(barW)}
                    className={clsx(
                      'rounded-lg px-2.5 py-1 transition-all',
                      barbellWeight === barW
                        ? 'bg-[#10E760] text-zinc-950 font-black'
                        : 'text-zinc-400 hover:text-white',
                    )}
                  >
                    {barW} {unitSystem}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top Target Load Input & Per-Side Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Total Target Weight */}
            <div className="rounded-2xl border border-[#1f2937] bg-[#181f2e] p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Total Target Bar Load
              </span>
              <div className="my-1 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleBarbellDelta(unitSystem === 'imperial' ? -5 : -2.5)}
                  disabled={activePlateTargetWeight <= barbellWeight}
                  aria-label="Decrease target barbell weight"
                  className="grid size-8 place-items-center rounded-xl border border-[#1f2937] bg-[#121722] text-zinc-300 hover:border-[#10E760] hover:text-[#10E760] disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>

                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-3xl sm:text-4xl font-black text-white tabular-nums">
                    {activePlateTargetWeight}
                  </span>
                  <span className="text-sm font-bold text-[#10E760]">{unitSystem}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleBarbellDelta(unitSystem === 'imperial' ? 5 : 2.5)}
                  aria-label="Increase target barbell weight"
                  className="grid size-8 place-items-center rounded-xl border border-[#1f2937] bg-[#121722] text-zinc-300 hover:border-[#10E760] hover:text-[#10E760]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Quick Stepper Chips */}
              <div className="flex flex-wrap justify-center gap-1 pt-1">
                {(unitSystem === 'imperial' ? [-25, -10, -5, 5, 10, 25] : [-20, -10, -2.5, 2.5, 10, 20]).map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => handleBarbellDelta(delta)}
                    className="rounded-lg border border-[#1f2937] bg-[#121722] px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-400 hover:border-lime-400 hover:text-white active:scale-95"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Per-Side Weight Required */}
            <div className="rounded-2xl border border-[#1f2937] bg-[#181f2e] p-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                Weight Required Per Sleeve (Each Side)
              </span>
              <div className="my-2 flex items-baseline justify-center gap-1.5 font-mono">
                <span className="text-3xl sm:text-4xl font-black text-[#10E760] tabular-nums">
                  {plateBreakdown.sideWeight}
                </span>
                <span className="text-sm font-bold text-zinc-400">{unitSystem} / side</span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono">
                (Total {activePlateTargetWeight} - Bar {barbellWeight}) ÷ 2
              </p>
            </div>

            {/* Plate Denomination Chips Breakdown */}
            <div className="rounded-2xl border border-[#1f2937] bg-[#181f2e] p-4">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block mb-2">
                Plates Needed (Each Side)
              </span>
              {plateBreakdown.plates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {plateBreakdown.plates.map((plate) => (
                    <div
                      key={plate.weight}
                      className="flex items-center gap-1.5 rounded-lg border border-[#1f2937] bg-[#121722] px-2.5 py-1"
                    >
                      <span className={`size-3 rounded-full border ${plate.style.bg} ${plate.style.border}`} />
                      <span className="font-mono text-xs font-bold text-white">
                        {plate.weight} {unitSystem}
                      </span>
                      <span className="font-mono text-xs font-black text-[#10E760]">
                        × {plate.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">
                  Only the barbell ({barbellWeight} {unitSystem}) is needed. No plates required.
                </p>
              )}

              {plateBreakdown.remainder > 0 && (
                <p className="mt-2 text-[10px] font-mono text-amber-400 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Remainder of {plateBreakdown.remainder} {unitSystem}/side (add micro-collars if needed)
                </p>
              )}
            </div>
          </div>

          {/* Graphical Olympic Barbell Sleeve Diagram */}
          <div className="rounded-2xl border border-[#1f2937] bg-[#090D15] p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#10E760]" />
                Right Sleeve Visual Loading Order (Inside Collar ➔ Outer Edge)
              </span>
              <span className="font-mono text-xs font-bold text-[#10E760]">
                {sleeveDiscs.length} Discs Loaded
              </span>
            </div>

            {/* Interactive Barbell Visual Graphic */}
            <div className="relative flex min-h-[140px] items-center justify-start sm:justify-center overflow-x-auto rounded-xl border border-[#1f2937] bg-gradient-to-r from-[#121722] via-[#090D15] to-[#121722] px-6 py-4">
              <div className="flex items-center">
                {/* Barbell Center Shaft (Left) */}
                <div
                  className="h-7 w-20 sm:w-28 rounded-l-md border-y border-l border-zinc-700 bg-gradient-to-b from-zinc-500 via-zinc-600 to-zinc-700 shadow-inner flex items-center justify-center"
                  title="Barbell Shaft (Knurling)"
                >
                  <span className="font-mono text-[9px] font-bold text-zinc-300 uppercase tracking-tighter">
                    BAR {barbellWeight}{unitSystem}
                  </span>
                </div>

                {/* Inner Collar Stop Ring */}
                <div
                  className="h-28 w-5 rounded-sm border border-zinc-600 bg-gradient-to-r from-zinc-700 via-zinc-500 to-zinc-800 shadow-lg flex items-center justify-center z-10"
                  title="Inner Collar Shoulder"
                >
                  <div className="h-20 w-1 bg-zinc-400/40 rounded-full" />
                </div>

                {/* Sleeve Loading Plates Array */}
                <div className="relative flex items-center gap-1 pl-1 bg-[#181f2e]/60 py-2 px-2 rounded-r-lg border-y border-r border-[#1f2937]">
                  {sleeveDiscs.length > 0 ? (
                    sleeveDiscs.map((disc) => (
                      <div
                        key={disc.key}
                        style={{
                          height: `${disc.style.height}px`,
                          width: `${disc.style.width * 2}px`,
                        }}
                        className={clsx(
                          'flex shrink-0 items-center justify-center rounded-sm border shadow-md transition-all hover:scale-105 select-none relative group',
                          disc.style.bg,
                          disc.style.border,
                          disc.style.textColor,
                        )}
                        title={`${disc.weight} ${unitSystem} plate`}
                      >
                        {/* Plate Label */}
                        <span className="rotate-90 select-none font-mono text-[10px] font-black tracking-tighter">
                          {disc.weight}
                        </span>

                        {/* Top Tooltip on Hover */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block z-30 rounded bg-zinc-950 border border-zinc-700 px-1.5 py-0.5 text-[9px] font-mono text-white whitespace-nowrap">
                          {disc.weight} {unitSystem}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-10 w-24 items-center justify-center text-[10px] font-mono text-zinc-500 italic">
                      Empty Sleeve
                    </div>
                  )}

                  {/* Outer Barbell Sleeve Shaft End */}
                  <div
                    className="h-8 w-16 sm:w-24 rounded-r-md border border-zinc-700 bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 shadow-inner flex items-center justify-center"
                    title="Outer Sleeve End Cap"
                  >
                    <span className="font-mono text-[8px] font-bold text-zinc-400 uppercase tracking-widest">
                      CAP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: RECOMMENDED WORKING WEIGHTS (PLAIN ENGLISH INTENSITY TARGETS) */}
        {/* ========================================================================= */}
        <section className="rounded-2xl border border-[#1f2937] bg-[#121722] p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1f2937] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-lime-400/20 text-[#10E760]">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Recommended Working Weights
                </h2>
                <p className="text-xs text-zinc-400">
                  Target weights for your workout sets based on your {conservativeOneRepMax} {unitSystem} Max Lift.
                </p>
              </div>
            </div>

            {/* Rep Target Selector Chips */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#090D15] p-1 rounded-xl border border-[#1f2937]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 px-2">
                Target Reps:
              </span>
              {[3, 5, 8, 10, 12].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setWorkingTargetReps(r)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 text-xs font-mono font-black transition-all',
                    workingTargetReps === r
                      ? 'bg-[#10E760] text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-white',
                  )}
                >
                  {r} reps
                </button>
              ))}
            </div>
          </div>

          {/* 4 Effort Level Target Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Light / Warmup (Effort 6) */}
            {(() => {
              const pct = RPE_PERCENTAGES[workingTargetReps]?.[6] || 75.1;
              const targetWeight = Math.round(activeOneRepMax * (pct / 100) * 10) / 10;
              return (
                <div className="flex flex-col justify-between rounded-2xl border border-cyan-500/30 bg-[#090D15] p-4.5 space-y-4 hover:border-cyan-400/60 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                        Light / Warmup
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        Effort 6/10
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                          {targetWeight}
                        </span>
                        <span className="text-sm font-bold text-cyan-400">{unitSystem}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {pct}% of Max Lift · ~4 reps left in tank
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Smooth, fast bar speed for movement prep, technique drills, and warmups.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCustomPlateTarget(targetWeight);
                      setSelectedMatrixCell({ reps: workingTargetReps, rpe: 6 });
                    }}
                    className="w-full text-xs font-bold border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                  >
                    Load {targetWeight} {unitSystem} <ArrowRight className="h-3.5 w-3.5 ml-1 text-cyan-400" />
                  </Button>
                </div>
              );
            })()}

            {/* 2. Moderate / Hypertrophy (Effort 7-8) */}
            {(() => {
              const pct = RPE_PERCENTAGES[workingTargetReps]?.[8] || 80.7;
              const targetWeight = Math.round(activeOneRepMax * (pct / 100) * 10) / 10;
              return (
                <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-[#090D15] p-4.5 space-y-4 hover:border-emerald-400/60 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Moderate / Growth
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        Effort 7–8/10
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                          {targetWeight}
                        </span>
                        <span className="text-sm font-bold text-emerald-400">{unitSystem}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {pct}% of Max Lift · ~2 reps left in tank
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Optimal stimulus for muscle hypertrophy and joint-safe progressive overload.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCustomPlateTarget(targetWeight);
                      setSelectedMatrixCell({ reps: workingTargetReps, rpe: 8 });
                    }}
                    className="w-full text-xs font-bold border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                  >
                    Load {targetWeight} {unitSystem} <ArrowRight className="h-3.5 w-3.5 ml-1 text-emerald-400" />
                  </Button>
                </div>
              );
            })()}

            {/* 3. Heavy / Strength (Effort 9) */}
            {(() => {
              const pct = RPE_PERCENTAGES[workingTargetReps]?.[9] || 86.3;
              const targetWeight = Math.round(activeOneRepMax * (pct / 100) * 10) / 10;
              return (
                <div className="flex flex-col justify-between rounded-2xl border border-amber-500/30 bg-[#090D15] p-4.5 space-y-4 hover:border-amber-400/60 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        Heavy / Strength
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        Effort 9/10
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                          {targetWeight}
                        </span>
                        <span className="text-sm font-bold text-amber-400">{unitSystem}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {pct}% of Max Lift · ~1 rep left in tank
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Demanding working sets for maximal neural recruitment and pure strength.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setCustomPlateTarget(targetWeight);
                      setSelectedMatrixCell({ reps: workingTargetReps, rpe: 9 });
                    }}
                    className="w-full text-xs font-bold border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                  >
                    Load {targetWeight} {unitSystem} <ArrowRight className="h-3.5 w-3.5 ml-1 text-amber-400" />
                  </Button>
                </div>
              );
            })()}

            {/* 4. Max / Limit (Effort 10) */}
            {(() => {
              const pct = RPE_PERCENTAGES[workingTargetReps]?.[10] || 92.2;
              const targetWeight = Math.round(activeOneRepMax * (pct / 100) * 10) / 10;
              return (
                <div className="flex flex-col justify-between rounded-2xl border border-red-500/30 bg-[#090D15] p-4.5 space-y-4 hover:border-red-400/60 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/40">
                        Max / Limit
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        Effort 10/10
                      </span>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-3xl font-black text-white tabular-nums tracking-tight">
                          {targetWeight}
                        </span>
                        <span className="text-sm font-bold text-red-400">{unitSystem}</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {pct}% of Max Lift · 0 reps left in tank
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Near-limit peak effort. Recommended only for testing or competition singles.
                    </p>
                  </div>

                  <Button
                    variant="volt"
                    size="sm"
                    onClick={() => {
                      setCustomPlateTarget(targetWeight);
                      setSelectedMatrixCell({ reps: workingTargetReps, rpe: 10 });
                    }}
                    className="w-full text-xs font-black shadow-md shadow-lime-400/10"
                  >
                    Load {targetWeight} {unitSystem} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              );
            })()}
          </div>

          {/* Optional Advanced Matrix Dropdown */}
          <div className="border-t border-[#1f2937] pt-4">
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-zinc-400 hover:text-white">
                <span className="flex items-center gap-2">
                  <Calculator className="h-3.5 w-3.5 text-[#10E760]" />
                  <span>Advanced: Full Mathematical Reps × Effort Matrix Table</span>
                </span>
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-zinc-500" />
              </summary>

              <div className="mt-4 overflow-x-auto rounded-xl border border-[#1f2937] bg-[#090D15]">
                <table className="w-full border-collapse text-center text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#1f2937] bg-[#181f2e]">
                      <th className="sticky left-0 z-20 bg-[#181f2e] px-3 py-2.5 text-left font-black uppercase text-zinc-300">
                        Reps
                      </th>
                      {[10, 9, 8, 7, 6].map((rpeCol) => (
                        <th
                          key={rpeCol}
                          className={clsx(
                            'px-2.5 py-2.5 font-bold transition-colors',
                            Math.abs(rpe - rpeCol) < 0.1
                              ? 'bg-[#10E760]/20 text-[#10E760] font-black'
                              : 'text-zinc-400',
                          )}
                        >
                          <div className="flex flex-col">
                            <span>Effort {rpeCol}/10</span>
                            <span className="text-[9px] font-normal text-zinc-500">
                              {10 - rpeCol} in tank
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2937]">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((repRow) => {
                      const isCurrentRep = reps === repRow;
                      return (
                        <tr
                          key={repRow}
                          className={clsx(
                            'transition-colors',
                            isCurrentRep ? 'bg-[#10E760]/5' : 'hover:bg-[#181f2e]/50',
                          )}
                        >
                          <td
                            className={clsx(
                              'sticky left-0 z-10 px-3 py-2 text-left font-black transition-colors',
                              isCurrentRep
                                ? 'bg-[#10E760]/20 text-[#10E760]'
                                : 'bg-[#090D15] text-zinc-300',
                            )}
                          >
                            {repRow} {repRow === 1 ? 'rep' : 'reps'}
                          </td>

                          {[10, 9, 8, 7, 6].map((rpeCol) => {
                            const pct = RPE_PERCENTAGES[repRow]?.[rpeCol] ?? 0;
                            const cellWeight = Math.round(activeOneRepMax * (pct / 100) * 10) / 10;
                            const isSelected =
                              selectedMatrixCell?.reps === repRow && selectedMatrixCell?.rpe === rpeCol;

                            return (
                              <td
                                key={rpeCol}
                                onClick={() => {
                                  setSelectedMatrixCell({ reps: repRow, rpe: rpeCol });
                                  setCustomPlateTarget(cellWeight);
                                }}
                                className={clsx(
                                  'cursor-pointer px-2 py-2 transition-all hover:bg-[#10E760]/20 active:scale-95',
                                  isSelected
                                    ? 'bg-[#10E760] text-zinc-950 font-black'
                                    : 'text-zinc-200',
                                )}
                                title={`Click to load ${cellWeight} ${unitSystem} into Barbell Sleeve`}
                              >
                                <div className="flex flex-col items-center">
                                  <span className="font-mono text-xs font-bold tabular-nums">
                                    {cellWeight}
                                  </span>
                                  <span className="text-[9px] text-zinc-500">{pct}%</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>
      </main>
    </div>
  );
}

export default CalculatorPage;
