import { useState, useEffect, useRef, type TouchEvent } from 'react';
import { ArrowRight, ShieldCheck, Activity, Dumbbell, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { usePageMetadata } from '../services/metadata';

interface SlideItem {
  id: number;
  tag: string;
  title: string;
  description: string;
  icon: typeof Dumbbell;
}

const SLIDES: SlideItem[] = [
  {
    id: 0,
    tag: 'PRECISION TRAINING',
    title: 'Get Stronger Every Day',
    description: 'Personalized progressive overload, live set tracking, and clinical posture restoration — all in one app.',
    icon: Dumbbell,
  },
  {
    id: 1,
    tag: 'BIOMECHANICAL SAFEGUARDS',
    title: 'Posture-Aware AI Programming',
    description: 'Our clinical algorithm protects joints by filtering contraindicated shearing exercises for your spine, shoulders, and knees.',
    icon: ShieldCheck,
  },
  {
    id: 2,
    tag: 'INTELLIGENT WORKOUT HUD',
    title: 'Real-Time Live Gym Tracker',
    description: 'Automated rest timer countdowns, weight plate calculations, and instant smart exercise swaps on the gym floor.',
    icon: Activity,
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isInteracting = useRef(false);

  usePageMetadata({
    title: 'PhysioCoach AI · Precision Strength & Biomechanical Rehab Platform',
    description:
      'Personalized progressive overload, clinical posture safeguards, live gym set tracking, and joint-friendly exercise programming.',
    canonicalUrl: 'https://physiocoach.ai/',
    ogType: 'website',
  });

  // Auto-play carousel every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isInteracting.current) {
        setActiveSlide((prev) => (prev + 1) % SLIDES.length);
      }
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  const handleTouchStart = (e: TouchEvent) => {
    isInteracting.current = true;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swipe Left -> Next
        setActiveSlide((prev) => (prev + 1) % SLIDES.length);
      } else {
        // Swipe Right -> Prev
        setActiveSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
      }
    }

    setTimeout(() => {
      isInteracting.current = false;
    }, 2000);
  };

  return (
    <main
      className="h-full w-full max-w-lg mx-auto flex flex-col justify-between p-6 sm:p-8 select-none selection:bg-lime-400 selection:text-zinc-950 text-zinc-50 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Brand Header */}
      <header className="shrink-0 flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 font-black tracking-tight">
          <div className="grid size-8 place-items-center rounded-xl bg-lime-400 text-zinc-950 shadow-sm">
            <Dumbbell className="h-4 w-4 stroke-[2.5]" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-white">
            PHYSIO<span className="text-lime-400">COACH</span>{' '}
            <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
              AI
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate(isAuthenticated ? '/dashboard' : '/auth')}
          className="text-xs font-bold text-zinc-400 hover:text-white transition-colors"
        >
          {isAuthenticated ? 'Dashboard' : 'Sign In'}
        </button>
      </header>

      {/* Swipeable Carousel Viewport */}
      <section className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute h-52 w-52 rounded-full bg-lime-400/10 blur-3xl -z-10" />

        {/* Carousel Slide Track */}
        <div className="w-full flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
          {SLIDES.map((slide) => {
            const Icon = slide.icon;
            return (
              <div key={slide.id} className="w-full shrink-0 flex flex-col items-center px-2 space-y-4">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-[10px] font-mono font-bold tracking-wider text-lime-400">
                  <Icon className="h-3 w-3" />
                  {slide.tag}
                </div>

                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                  {slide.title}
                </h1>

                <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  {slide.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Interactive Indicator Dots */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeSlide === idx ? 'w-7 bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.6)]' : 'w-2 bg-zinc-800 hover:bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Bottom Primary Action Button */}
      <footer className="shrink-0 pt-2 pb-2">
        <Button
          variant="volt"
          size="lg"
          pill={true}
          onClick={() => navigate(isAuthenticated ? '/dashboard' : '/auth')}
          className="w-full font-black text-sm sm:text-base shadow-lg shadow-lime-400/20"
        >
          {isAuthenticated ? 'Go to Dashboard' : 'Start Training'} <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </footer>
    </main>
  );
}
