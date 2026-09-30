export interface ProgressProps {
  value: number;
  label?: string;
  className?: string;
}

export function Progress({ value, label, className = '' }: ProgressProps) {
  const safe = Math.min(100, Math.max(0, value));

  return (
    <div className={className}>
      {label && (
        <div className="mb-2 flex justify-between text-sm font-semibold text-zinc-300">
          <span>{label}</span>
          <span className="font-mono">{safe}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 overflow-hidden rounded-full bg-zinc-800"
      >
        <div
          className="h-full rounded-full bg-lime-400 transition-all duration-300 ease-out"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}
