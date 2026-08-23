import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SemiGaugeProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  label?: string;
  sublabel?: string;
  strokeColor?: string;
  size?: number;
  strokeWidth?: number;
}

export const SemiGauge = ({
  value,
  max,
  label,
  sublabel,
  strokeColor = 'stroke-lime-400',
  size = 160,
  strokeWidth = 12,
  className,
  ...props
}: SemiGaugeProps) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={clsx('relative inline-flex flex-col items-center', className)} {...props}>
      <svg
        width={size}
        height={size / 2 + strokeWidth}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
        className="overflow-visible"
      >
        {/* Background track */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-zinc-800"
        />
        {/* Progress arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={clsx('transition-all duration-500', strokeColor)}
          style={{
            transformOrigin: 'center',
            transform: 'rotate(180deg)',
          }}
        />
      </svg>
      
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
        {label && (
          <div className="text-3xl font-black tabular-nums tracking-tight">
            {label}
          </div>
        )}
        {sublabel && (
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mt-0.5">
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};
