import { useState, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface PlateCalculatorModalProps {
  open: boolean;
  onClose(): void;
  initialWeight?: number;
  exerciseName?: string;
  onApplyWeight?: (weightKg: number) => void;
  unitSystem?: 'metric' | 'imperial';
}

const DENOMINATIONS_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

const PLATE_STYLES: Record<number, { bg: string; border: string; text: string; height: number; width: number }> = {
  25: { bg: 'bg-red-600', border: 'border-red-400', text: 'text-white', height: 76, width: 16 },
  20: { bg: 'bg-blue-600', border: 'border-blue-400', text: 'text-white', height: 70, width: 15 },
  15: { bg: 'bg-amber-500', border: 'border-amber-300', text: 'text-obsidian-950', height: 60, width: 14 },
  10: { bg: 'bg-emerald-500', border: 'border-emerald-300', text: 'text-obsidian-950', height: 52, width: 12 },
  5: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-obsidian-950', height: 42, width: 10 },
  2.5: { bg: 'bg-obsidian-800', border: 'border-obsidian-600', text: 'text-white', height: 34, width: 8 },
  1.25: { bg: 'bg-slate-400', border: 'border-slate-200', text: 'text-obsidian-950', height: 28, width: 7 },
};

export function PlateCalculatorModal({
  open,
  onClose,
  initialWeight = 60,
  exerciseName,
  onApplyWeight,
  unitSystem = 'metric',
}: PlateCalculatorModalProps) {
  const [targetWeight, setTargetWeight] = useState<number>(() => Math.max(20, initialWeight || 20));
  const [barWeight, setBarWeight] = useState<number>(20);

  const breakdown = useMemo(() => {
    if (targetWeight <= barWeight) {
      return { sideWeight: 0, plates: [], remainder: 0 };
    }

    const sideWeight = (targetWeight - barWeight) / 2;
    let remaining = Math.round(sideWeight * 100) / 100;
    const plates: { weight: number; count: number }[] = [];

    for (const denom of DENOMINATIONS_KG) {
      const count = Math.floor(remaining / denom + 1e-9);
      if (count > 0) {
        plates.push({ weight: denom, count });
        remaining = Math.round((remaining - count * denom) * 100) / 100;
      }
    }

    return { sideWeight, plates, remainder: remaining };
  }, [targetWeight, barWeight]);

  const plateDiscs = useMemo(() => {
    const discs: { weight: number; key: string }[] = [];
    for (const plate of breakdown.plates) {
      for (let i = 0; i < plate.count; i++) {
        discs.push({ weight: plate.weight, key: `${plate.weight}-${i}` });
      }
    }
    return discs;
  }, [breakdown]);

  const handlePreset = (delta: number) => {
    setTargetWeight((prev) => Math.max(barWeight, Math.round((prev + delta) * 10) / 10));
  };

  const handleApply = () => {
    if (onApplyWeight) {
      onApplyWeight(targetWeight);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Barbell Plate Calculator"
      maxWidth="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Cancel
          </Button>
          <Button variant="volt" onClick={handleApply} className="font-bold">
            Apply {targetWeight} kg
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {exerciseName && (
          <p className="text-xs font-black uppercase tracking-wider text-lime-400 capitalize">{exerciseName}</p>
        )}

        {/* Target Weight & Steppers */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Target Weight</span>
          <div className="my-2 flex items-center justify-center gap-3">
            <Button
              size="icon"
              variant="secondary"
              onClick={() => handlePreset(-2.5)}
              disabled={targetWeight <= barWeight}
              aria-label="Decrease 2.5kg"
              className="size-9 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
            >
              <Minus className="h-4 w-4" />
            </Button>

            <span className="font-mono text-3xl sm:text-4xl font-black text-white tabular-nums">
              {targetWeight} <span className="text-lg font-normal text-zinc-400">kg</span>
            </span>

            <Button
              size="icon"
              variant="secondary"
              onClick={() => handlePreset(2.5)}
              aria-label="Increase 2.5kg"
              className="size-9 rounded-xl border border-zinc-800 bg-zinc-900 text-white"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 pt-2">
            {[-10, -5, -2.5, 2.5, 5, 10].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => handlePreset(delta)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs font-bold text-zinc-300 transition-colors hover:border-lime-400 hover:text-lime-400 active:scale-95"
              >
                {delta > 0 ? `+${delta}` : delta} kg
              </button>
            ))}
          </div>
        </div>

        {/* Bar Weight Selector */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
          <span className="text-xs font-bold text-zinc-300">Barbell Baseline:</span>
          <div className="flex gap-2">
            {[20, 15, 10].map((weight) => (
              <button
                key={weight}
                type="button"
                onClick={() => setBarWeight(weight)}
                className={`rounded-xl border px-3 py-1 font-mono text-xs font-bold transition-all ${
                  barWeight === weight
                    ? 'border-lime-400 bg-lime-400/10 text-lime-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {weight} kg
              </button>
            ))}
          </div>
        </div>

        {/* Barbell Sleeve Visual Graphic */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Per-Side Sleeve View</span>
            <span className="font-mono text-xs font-bold text-lime-400">
              {breakdown.sideWeight} kg / side
            </span>
          </div>

          {/* Graphical Barbell Sleeve Diagram */}
          <div className="relative flex h-24 items-center justify-center overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/80 px-4">
            <div className="flex items-center gap-1">
              <div className="h-20 w-4 rounded-sm border border-zinc-600 bg-zinc-500" title="Barbell Collar Stop" />

              <div className="relative flex items-center gap-1.5">
                {plateDiscs.map((disc) => {
                  const style = PLATE_STYLES[disc.weight] || PLATE_STYLES[1.25];
                  return (
                    <div
                      key={disc.key}
                      style={{ height: `${style.height}px`, width: `${style.width * 2}px` }}
                      className={`flex shrink-0 items-center justify-center rounded-sm border ${style.bg} ${style.border} ${style.text} transition-all`}
                      title={`${disc.weight} kg disc`}
                    >
                      <span className="rotate-90 select-none font-mono text-[9px] font-extrabold tracking-tighter">
                        {disc.weight}
                      </span>
                    </div>
                  );
                })}

                <div className="h-6 w-16 rounded-r-md border border-zinc-700 bg-zinc-600/40" title="Outer Sleeve End" />
              </div>
            </div>
          </div>
        </div>

        {/* Plate Count List Breakdown */}
        <div>
          <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-zinc-400">
            Plates Required (Each Side)
          </span>
          {breakdown.plates.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {breakdown.plates.map((plate) => {
                const style = PLATE_STYLES[plate.weight] || PLATE_STYLES[1.25];
                return (
                  <div
                    key={plate.weight}
                    className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`size-3 rounded-full border ${style.bg} ${style.border}`} />
                      <span className="font-mono text-sm font-bold text-white">{plate.weight} kg</span>
                    </div>
                    <span className="font-mono text-sm font-black text-lime-400">× {plate.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-center text-xs text-zinc-400">
              Only the barbell ({barWeight} kg) is required. No plates needed.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
