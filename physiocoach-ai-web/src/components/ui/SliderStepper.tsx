import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';

export interface SliderStepperProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext?: () => void;
  canGoBack?: boolean;
  showNextButton?: boolean;
  nextButtonText?: string;
  nextButtonDisabled?: boolean;
  nextButtonLoading?: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}

export function SliderStepper({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  canGoBack = true,
  showNextButton = true,
  nextButtonText = 'Continue',
  nextButtonDisabled = false,
  nextButtonLoading = false,
  title,
  subtitle,
  badge,
  children,
  className,
}: SliderStepperProps) {
  const progressPercent = Math.min(100, Math.round((currentStep / totalSteps) * 100));

  return (
    <div
      className={clsx(
        'h-full w-full max-w-xl mx-auto flex flex-col bg-zinc-950 text-zinc-50 overflow-hidden select-none selection:bg-lime-400 selection:text-zinc-950',
        className,
      )}
    >
      {/* 1. Fixed Top Header & Progress HUD */}
      <header className="shrink-0 px-4 sm:px-6 pt-3 pb-2 space-y-3 border-b border-zinc-900/60 bg-zinc-950">
        {/* Top bar with back button & step indicator */}
        <div className="flex items-center justify-between">
          {canGoBack && currentStep > 1 ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="grid size-9 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="size-9" />
          )}

          <div className="flex items-center gap-2">
            {badge && (
              <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-400">
                {badge}
              </span>
            )}
            <span className="font-mono text-xs font-black text-zinc-400">
              {currentStep} <span className="text-zinc-600">/</span> {totalSteps}
            </span>
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="h-1 w-full rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-lime-400 transition-all duration-300 ease-out rounded-full shadow-[0_0_8px_rgba(163,230,53,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* 2. Scrollable Middle Content Viewport */}
      <main className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-6 sm:py-6 flex flex-col items-center text-center w-full overscroll-contain">
        {/* Question Title & Subtitle */}
        <div className="mb-5 space-y-1.5 max-w-md shrink-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Slide Body Container */}
        <div className="w-full flex flex-col items-center flex-1 pb-4">
          {children}
        </div>
      </main>

      {/* 3. Anchored Action Button Footer */}
      {showNextButton && (
        <footer className="shrink-0 w-full p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
          <Button
            type="button"
            variant="volt"
            size="lg"
            pill={true}
            disabled={nextButtonDisabled}
            loading={nextButtonLoading}
            onClick={onNext}
            className="w-full text-sm sm:text-base font-black shadow-lg shadow-lime-400/10"
          >
            {nextButtonText} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </footer>
      )}
    </div>
  );
}
