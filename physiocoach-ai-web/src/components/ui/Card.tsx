import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type CardVariant = 'default' | 'lime';

export const Card = ({ 
  className, 
  variant = 'default',
  ...props 
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) => {
  const variantStyles: Record<CardVariant, string> = {
    default: 'bg-zinc-900 border border-zinc-800 rounded-2xl',
    lime: 'bg-lime-400 text-zinc-950 border border-lime-400 rounded-2xl sm:rounded-3xl',
  };

  return (
    <div
      className={clsx(
        'transition-all',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
};

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('p-5 pb-2 border-b border-zinc-800/80', className)} {...props} />
);

export const CardTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={clsx('text-lg font-black tracking-tight', className)} {...props} />
);

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('p-5 pt-4', className)} {...props} />
);

export const CardFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('flex items-center gap-3 p-5 pt-3 border-t border-zinc-800/80', className)} {...props} />
);

