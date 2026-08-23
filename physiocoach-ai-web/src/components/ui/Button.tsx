import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'volt' | 'amber';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'xs';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  pill?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-lime-400 text-zinc-950 hover:bg-lime-300 font-extrabold shadow-sm active:scale-[0.98]',
  volt: 'bg-lime-400 text-zinc-950 hover:bg-lime-300 font-extrabold shadow-sm active:scale-[0.98]',
  secondary: 'bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800 hover:text-white font-bold active:scale-[0.98]',
  outline: 'border border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-lime-400 hover:text-lime-400 font-bold active:scale-[0.98]',
  amber: 'bg-amber-500 text-zinc-950 hover:bg-amber-400 font-extrabold active:scale-[0.98]',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 font-bold active:scale-[0.98]',
  ghost: 'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 font-bold active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-8 px-3 text-xs rounded-lg',
  sm: 'h-9 px-3.5 text-xs rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-12 px-6 text-sm sm:text-base rounded-xl',
  icon: 'size-10 rounded-xl p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, pill, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-bold tracking-tight transition-all duration-150 select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        pill && 'rounded-full',
        className,
      )}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

