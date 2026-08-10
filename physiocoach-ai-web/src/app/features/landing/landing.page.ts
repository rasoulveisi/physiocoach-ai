import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { IntersectDirective } from '../../shared/directives/intersect.directive';

interface PreviewExercise {
  name: string;
  sets: string;
  reps: string;
  tag: string;
  badgeClass: string;
}

interface Stat {
  label: string;
  /** Target numeric value to count up to. */
  target: number;
  /** Decimal places to render. */
  decimals: number;
  /** Locale-formatted thousands separators. */
  group: boolean;
  /** Prefix/suffix rendered around the number. */
  prefix: string;
  suffix: string;
}

@Component({
  standalone: true,
  imports: [IntersectDirective, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.page.html',
})
export class LandingPage {
  // ── Reactive state ───────────────────────────────────────────
  /** True once the page has scrolled past the nav threshold. */
  protected readonly scrolled = signal(false);
  /** Index of the currently highlighted carousel exercise. */
  protected readonly activeExercise = signal(0);
  /** Parallax offset (px) for the hero glow blobs, driven by the cursor. */
  protected readonly parallax = signal({ x: 0, y: 0 });
  /** Live counter values rendered in the social-proof bar. */
  protected readonly animatedStats = signal<string[]>([]);
  /** Index of the expanded FAQ entry (-1 = none). */
  protected readonly openFaq = signal(-1);

  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroSection');

  /** Backing timers / RAF handles, cleaned up via DestroyRef. */
  private carouselTimer?: ReturnType<typeof setInterval>;
  private parallaxRaf?: number;

  // ── Static content ───────────────────────────────────────────
  protected readonly previewExercises: PreviewExercise[] = [
    {
      name: 'Chest-supported row',
      sets: '4 sets',
      reps: '8-10 reps · RPE 7',
      tag: 'Posture',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
    },
    {
      name: 'Half-kneeling press',
      sets: '3 sets',
      reps: '8 reps/side · controlled',
      tag: 'Guarded',
      badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    },
    {
      name: 'Nordic curl',
      sets: '3 sets',
      reps: '6-8 reps · slow eccentric',
      tag: 'Strength',
      badgeClass: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    },
  ];

  protected readonly stats: Stat[] = [
    { label: 'Active users', target: 2000, decimals: 0, group: true, prefix: '', suffix: '+' },
    { label: 'Plans generated', target: 15, decimals: 0, group: false, prefix: '', suffix: 'K+' },
    { label: 'Safety compliance', target: 94, decimals: 0, group: false, prefix: '', suffix: '%' },
    { label: 'User rating', target: 4.9, decimals: 1, group: false, prefix: '', suffix: '★' },
    { label: 'Avg setup time', target: 3, decimals: 0, group: false, prefix: '', suffix: ' min' },
  ];

  protected readonly features = [
    {
      icon: '🦴',
      iconBg: 'from-indigo-50 to-indigo-100',
      title: 'Posture-aware planning',
      description:
        'Tell us your posture flags — rounded shoulders, anterior pelvic tilt, knee valgus — and every exercise is selected to correct, not aggravate.',
    },
    {
      icon: '🤖',
      iconBg: 'from-green-50 to-green-100',
      title: 'AI-generated workouts',
      description:
        'GPT-4 analyzes your body metrics, lifestyle, equipment, and goals to produce a truly personalized weekly training split with progression logic.',
    },
    {
      icon: '📈',
      iconBg: 'from-amber-50 to-amber-100',
      title: 'Progressive overload built-in',
      description:
        'Every plan includes clear RPE targets, set/rep schemes, and progression rules so you always know when and how to advance.',
    },
    {
      icon: '⚠️',
      iconBg: 'from-rose-50 to-rose-100',
      title: 'Safety guardrails',
      description:
        'Joint limitations, past injuries, and mobility constraints are respected. Guarded exercises are flagged. High-risk movements are substituted.',
    },
    {
      icon: '📊',
      iconBg: 'from-cyan-50 to-cyan-100',
      title: 'Progress tracking',
      description:
        'Log sessions, track volume trends, monitor streaks, and detect plateaus before they stall your gains.',
    },
    {
      icon: '📱',
      iconBg: 'from-sky-50 to-sky-100',
      title: 'Works on any device',
      description:
        'Full PWA + native Android app. Take your plan to the gym with offline support and a distraction-free session view.',
    },
  ];

  protected readonly steps = [
    {
      number: 1,
      icon: '📋',
      title: 'Complete your assessment',
      description:
        'Answer 11 quick questions about your body, lifestyle, equipment, and any limitations. Takes under 3 minutes.',
    },
    {
      number: 2,
      icon: '✨',
      title: 'AI builds your plan',
      description:
        'Our AI analyzes your profile and generates a posture-aware, progressive weekly training plan in under 60 seconds.',
    },
    {
      number: 3,
      icon: '💪',
      title: 'Train and improve',
      description:
        'Log sessions, track progress, and watch your plan adapt as you grow stronger and safer.',
    },
  ];

  protected readonly faqs = [
    {
      q: 'Is PhysioCoach AI a replacement for a physiotherapist?',
      a: "No. PhysioCoach AI is a fitness tool that respects your body's constraints. It is not medical advice and is not a substitute for a qualified physiotherapist or clinician.",
    },
    {
      q: 'How does the posture-aware planning actually work?',
      a: 'During your assessment you flag issues like rounded shoulders, anterior pelvic tilt, or knee valgus. Our AI weights exercise selection, volume, and substitutions around those flags so your plan corrects rather than aggravates them.',
    },
    {
      q: 'What equipment do I need?',
      a: 'Whatever you have. Tell us your equipment — full gym, dumbbells at home, or bodyweight only — and the plan adapts its exercise pool accordingly.',
    },
    {
      q: 'Is my data private?',
      a: 'Your assessment and training data is encrypted in transit and at rest, and is never sold. You can export or delete your data at any time from settings.',
    },
    {
      q: 'Does it work offline?',
      a: 'Yes. As a PWA with a native Android app, your current plan and session view are available offline. AI regeneration of a plan requires a connection.',
    },
  ];

  constructor() {
    // Seed the animated counters at their formatted "0" state.
    this.animatedStats.set(this.stats.map((s) => this.formatValue(0, s)));

    afterNextRender(() => {
      this.startCarousel();
      this.bindScroll();
      this.bindParallax();
    });

    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

  // ── Carousel ─────────────────────────────────────────────────
  private startCarousel(): void {
    const total = this.previewExercises.length;
    this.carouselTimer = setInterval(() => {
      this.activeExercise.update((i) => (i + 1) % total);
    }, 2800);
  }

  protected selectExercise(index: number): void {
    this.activeExercise.set(index);
    // Restart the auto-advance cadence so manual picks get their full window.
    clearInterval(this.carouselTimer);
    this.startCarousel();
  }

  // ── Scroll-driven nav state ──────────────────────────────────
  private bindScroll(): void {
    const onScroll = () => this.scrolled.set(window.scrollY > 8);
    onScroll(); // set initial state
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── Parallax (cursor-driven hero glow) ───────────────────────
  private bindParallax(): void {
    const hero = this.heroRef()?.nativeElement;
    if (!hero) return;

    hero.addEventListener('mousemove', (event: MouseEvent) => {
      if (this.parallaxRaf !== undefined) return; // throttle via RAF
      const rect = hero.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      this.parallaxRaf = requestAnimationFrame(() => {
        this.parallaxRaf = undefined;
        // Normalize to [-1, 1] around the section center, scaled subtley.
        const offsetX = (x / rect.width - 0.5) * 30;
        const offsetY = (y / rect.height - 0.5) * 30;
        this.parallax.set({ x: offsetX, y: offsetY });
      });
    });

    hero.addEventListener('mouseleave', () => {
      this.parallax.set({ x: 0, y: 0 });
    });
  }

  // ── Count-up animation (runs once, when stats enter view) ───
  protected animateStats(): void {
    this.stats.forEach((stat, index) => this.animateOne(index, stat));
  }

  private animateOne(index: number, stat: Stat): void {
    const duration = 1400;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = stat.target * eased;

      this.animatedStats.update((values) => {
        const next = [...values];
        next[index] = this.formatValue(current, stat);
        return next;
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  private formatValue(value: number, stat: Stat): string {
    const formatted = stat.group
      ? Math.round(value).toLocaleString('en-US')
      : value.toFixed(stat.decimals);
    return `${stat.prefix}${formatted}${stat.suffix}`;
  }

  // ── FAQ accordion ────────────────────────────────────────────
  protected toggleFaq(index: number): void {
    this.openFaq.update((current) => (current === index ? -1 : index));
  }

  // ── Cleanup ──────────────────────────────────────────────────
  private cleanup(): void {
    clearInterval(this.carouselTimer);
    if (this.parallaxRaf !== undefined) {
      cancelAnimationFrame(this.parallaxRaf);
    }
  }
}
