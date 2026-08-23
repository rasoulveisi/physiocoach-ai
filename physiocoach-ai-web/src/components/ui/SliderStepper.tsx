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
        'relative min-h-[calc(100vh-4rem)] bg-zinc-950 text-zinc-50 flex flex-col justify-between p-4 pb-28 sm:p-6 sm:pb-10 max-w-xl mx-auto selection:bg-lime-400 selection:text-zinc-950',
        className,
      )}
    >
      {/* Top Header & Progress HUD */}
      <header className="space-y-4 pt-2">
        {/* Top bar with back button & step indicator */}
        <div className="flex items-center justify-between">
          {canGoBack && currentStep > 1 ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="grid size-10 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div className="size-10" />
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

      {/* Slide Content Area */}
      <main className="my-auto py-6 flex flex-col items-center text-center w-full">
        {/* Question Title & Subtitle */}
        <div className="mb-6 space-y-2 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Slide Body Container */}
        <div className="w-full flex flex-col items-center">
          {children}
        </div>
      </main>

      {/* Floating Action Button above mobile navbar */}
      {showNextButton && (
        <footer className="pt-4 pb-2 w-full sticky bottom-20 sm:bottom-0 z-30 bg-zinc-950/90 backdrop-blur-sm rounded-2xl">
          <Button
            type="button"
            variant="volt"
            size="lg"
            pill={true}
            disabled={nextButtonDisabled}
            loading={nextButtonLoading}
            onClick={onNext}
            className="w-full text-base font-black shadow-lg"
          >
            {nextButtonText} <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </footer>
      )}
    </div>
  );
}
