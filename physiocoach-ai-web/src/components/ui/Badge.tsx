import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'volt' | 'lime' | 'dark' | 'amber' | 'cyan' | 'hardware';

const styles: Record<BadgeVariant, string> = {
  lime: 'bg-lime-400/10 text-lime-400 border border-lime-400/20',
  volt: 'bg-lime-400/10 text-lime-400 border border-lime-400/30',
  dark: 'bg-zinc-950 text-zinc-300 border border-zinc-800',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/30',
  cyan: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
  info: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30',
  neutral: 'bg-zinc-900 text-zinc-300 border border-zinc-800',
  hardware: 'bg-zinc-950 text-zinc-200 border border-zinc-800 font-mono text-[11px]',
};

export const Badge = ({
  className,
  children,
  variant = 'neutral',
  pill,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant; pill?: boolean }) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold tracking-wide transition-colors',
        pill ? 'rounded-full' : 'rounded-md',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

