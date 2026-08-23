import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <label className="block text-sm font-semibold text-slate-300" htmlFor={inputId}>
        {label && <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'h-11 w-full rounded-xl border bg-obsidian-950 px-3.5 font-medium text-white outline-none transition-all placeholder:text-slate-500 focus:border-volt focus:ring-1 focus:ring-volt',
            error ? 'border-red-500/70 focus:border-red-500' : 'border-obsidian-700 hover:border-obsidian-600',
            className,
          )}
          {...props}
        />
        {error ? (
          <span className="mt-1 block text-xs text-red-400">{error}</span>
        ) : (
          hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
        )}
      </label>
    );
  },
);
Input.displayName = 'Input';

