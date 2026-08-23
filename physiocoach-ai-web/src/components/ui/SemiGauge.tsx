import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SemiGaugeProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  label?: string;
  sublabel?: string;
  strokeColor?: string;
  trackColor?: string;
  size?: number;
  strokeWidth?: number;
}

export const SemiGauge = ({
  value,
  max,
  label,
  sublabel,
  strokeColor = 'stroke-zinc-950',
  trackColor = 'stroke-zinc-950/15',
  size = 124,
  strokeWidth = 10,
  className,
  ...props
}: SemiGaugeProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={clsx('relative inline-flex items-center justify-center shrink-0 select-none', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 block"
      >
        {/* Background Track Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={trackColor}
        />
        {/* Active Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={clsx('transition-all duration-700 ease-out', strokeColor)}
        />
      </svg>

      {/* Centered Calorie Number & Unit */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {label && (
          <span className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 tabular-nums leading-none">
            {label}
          </span>
        )}
        {sublabel && (
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-zinc-950/70 mt-0.5">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};
