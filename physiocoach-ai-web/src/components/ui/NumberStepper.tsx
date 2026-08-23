import type { ChangeEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { clsx } from 'clsx';

export interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  unitToggle?: {
    options: [string, string];
    active: string;
    onToggle: (unit: string) => void;
  };
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  unitToggle,
  className,
}: NumberStepperProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(Math.max(min, value - step));
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(Math.min(max, value + step));
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) {
      onChange(Math.min(max, Math.max(min, val)));
    }
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  return (
    <div className={clsx('w-full max-w-sm mx-auto flex flex-col items-center space-y-6', className)}>
      {/* Unit Toggle if available */}
      {unitToggle && (
        <div className="flex rounded-full border border-zinc-800 bg-zinc-900 p-1 text-xs font-bold">
          {unitToggle.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => unitToggle.onToggle(opt)}
              className={clsx(
                'rounded-full px-4 py-1 transition-colors uppercase tracking-wider',
                unitToggle.active === opt
                  ? 'bg-lime-400 text-zinc-950 font-black'
                  : 'text-zinc-400 hover:text-white',
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Main Stepper Display and Quick Buttons */}
      <div className="flex items-center justify-between w-full gap-4">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label="Decrease value"
          className="grid size-14 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-200 shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-800 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Minus className="h-6 w-6 stroke-[2.5]" />
        </button>

        <div className="flex flex-col items-center justify-center">
          <div className="flex items-baseline gap-1.5">
            <input
              type="number"
              min={min}
              max={max}
              value={value}
              onChange={handleInputChange}
              className="w-32 bg-transparent text-center font-mono text-5xl font-black text-white outline-none tracking-tight tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 mt-1">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label="Increase value"
          className="grid size-14 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-200 shadow-sm transition-all hover:border-zinc-700 hover:bg-zinc-800 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>
      </div>

      {/* Scrub Range Slider */}
      <div className="w-full px-2 space-y-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="w-full h-2 rounded-lg bg-zinc-800 accent-lime-400 cursor-pointer appearance-none outline-none focus:ring-2 focus:ring-lime-400/30"
        />
        <div className="flex justify-between text-[10px] font-mono text-zinc-500 font-bold px-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
}
