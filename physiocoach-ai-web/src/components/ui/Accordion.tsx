import React, { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItemProps {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function AccordionItem({
  title,
  subtitle,
  icon,
  badge,
  children,
  defaultOpen = false,
  className = '',
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 transition-colors ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 p-3.5 sm:p-4 text-left transition-colors hover:bg-zinc-800/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="shrink-0 text-lime-400">{icon}</div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white truncate">{title}</span>
              {badge}
            </div>
            {subtitle && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-lime-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800/60 p-3.5 sm:p-4 text-xs text-zinc-300 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

export interface AccordionProps {
  children: ReactNode;
  className?: string;
}

export function Accordion({ children, className = 'space-y-2.5' }: AccordionProps) {
  return <div className={className}>{children}</div>;
}
