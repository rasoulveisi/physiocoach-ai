import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col justify-between p-6 sm:p-10">
      {/* Top Brand Header */}
      <header className="flex items-center gap-1.5">
        <span className="text-lg font-black tracking-tight">
          PHYSIO<span className="text-lime-400">COACH</span>
        </span>
        <span className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 rounded">
          AI
        </span>
      </header>

      {/* Hero Center */}
      <section className="text-center">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Get Stronger Every Day</h1>
        <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
          Personalized workouts, live tracking, and clinical posture support — all in one app.
        </p>

        {/* Carousel Indicator Dots */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          <span className="w-6 h-1.5 bg-lime-400 rounded-full" />
          <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
          <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full" />
        </div>
      </section>

      {/* Bottom Dual-Action Pill Buttons */}
      <footer className="space-y-3">
        <Button
          variant="volt"
          size="lg"
          pill={true}
          onClick={() => navigate('/onboarding')}
          className="w-full font-black text-base"
        >
          Start Training <ArrowRight className="h-4 w-4 ml-1" />
        </Button>

        <Button
          variant="outline"
          size="lg"
          pill={true}
          onClick={() => navigate('/auth')}
          className="w-full border-zinc-800 bg-zinc-900/80 text-zinc-200"
        >
          Connect Smartwatch / Sign In
        </Button>
      </footer>
    </main>
  );
}
