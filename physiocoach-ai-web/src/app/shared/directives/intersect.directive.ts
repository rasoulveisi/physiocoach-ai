import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';

/**
 * Lightweight IntersectionObserver directive.
 *
 * Usage:
 *   <div pcIntersect (intersected)="onVisible()" [intersectDelay]="150">…</div>
 *
 * Adds `.in-view` to the host element once when it enters the viewport.
 * Pair with the `.reveal` / `.reveal-left` / `.reveal-scale` CSS classes
 * (defined in styles.css) for scroll-triggered entrance animations.
 */
@Directive({
  selector: '[pcIntersect]',
  standalone: true,
})
export class IntersectDirective implements OnInit, OnDestroy {
  /** Delay (ms) before `.in-view` is applied — useful for staggered reveals. */
  @Input() intersectDelay = 0;

  /** Fires once when the element first enters the viewport. */
  @Output() readonly intersected = new EventEmitter<void>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const apply = () => {
            entry.target.classList.add('in-view');
            this.intersected.emit();
          };
          if (this.intersectDelay > 0) {
            setTimeout(apply, this.intersectDelay);
          } else {
            apply();
          }
          this.observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
