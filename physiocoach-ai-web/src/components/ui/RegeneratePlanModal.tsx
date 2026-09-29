import { useEffect } from 'react';
import { ChevronRight, RotateCcw, Sliders, Sparkles, X } from 'lucide-react';
import { Button } from './Button';

export interface RegeneratePlanModalProps {
  open: boolean;
  onClose: () => void;
  onSelectAssessment: () => void;
  onSelectCurrentProfile: () => void;
  loading?: boolean;
}

export function RegeneratePlanModal({
  open,
  onClose,
  onSelectAssessment,
  onSelectCurrentProfile,
  loading = false,
}: RegeneratePlanModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, loading]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="regenerate-plan-title"
        className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl p-5 pb-8 sm:max-w-md sm:rounded-3xl sm:border sm:border-zinc-800 sm:p-6 animate-fade-up sm:animate-scale-in"
      >
        {/* Mobile Drag Indicator */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-700/80 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="regenerate-plan-title"
                className="text-lg font-black tracking-tight text-white"
              >
                Regenerate Workout Plan
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Choose how you would like to rebuild your training routine:
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            className="text-zinc-400 hover:text-white shrink-0 -mt-1 -mr-1"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Options */}
        <div className="mt-4 space-y-3">
          {/* Option 1: Re-take Assessment */}
          <button
            type="button"
            onClick={onSelectAssessment}
            disabled={loading}
            className="w-full group relative flex items-start gap-3.5 p-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 hover:border-cyan-500/50 hover:bg-zinc-850 transition-all text-left active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="grid size-11 place-items-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 group-hover:bg-cyan-500/20 transition-all shrink-0">
              <Sliders className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">
                  Re-take Assessment
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Update joint safeguards, posture flags, equipment, and days. AI will synthesize your new routine upon completion.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>

          {/* Option 2: Regenerate with Current Profile */}
          <button
            type="button"
            onClick={onSelectCurrentProfile}
            disabled={loading}
            className="w-full group relative flex items-start gap-3.5 p-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 hover:border-lime-400/50 hover:bg-zinc-850 transition-all text-left active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="grid size-11 place-items-center rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20 group-hover:scale-105 group-hover:bg-lime-400/20 transition-all shrink-0">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm group-hover:text-lime-400 transition-colors">
                  Use Current Profile
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-lime-400/15 text-lime-400 border border-lime-400/30">
                  Instant
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Keep existing biometrics, safeguards, and schedule. Instantly generate a fresh routine with progressive overload.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-lime-400 group-hover:translate-x-0.5 transition-all shrink-0 self-center" />
          </button>
        </div>

        {/* Footer / Cancel */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full text-zinc-400 hover:text-white py-2.5 rounded-xl border border-transparent hover:border-zinc-800"
          >
            Cancel
          </Button>
        </div>
      </section>
    </div>
  );
}
