import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose(): void;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  maxWidth = 'lg',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-obsidian-950/80 p-4 backdrop-blur-md animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${maxSizes[maxWidth]} max-h-[90vh] flex flex-col rounded-2xl border border-obsidian-700 bg-obsidian-900 text-slate-100 animate-scale-in`}
      >
        <div className="flex items-center justify-between border-b border-obsidian-800 p-5">
          <h2 id="modal-title" className="text-xl font-black tracking-tight text-white">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-obsidian-800 p-4 bg-obsidian-950/40">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}

