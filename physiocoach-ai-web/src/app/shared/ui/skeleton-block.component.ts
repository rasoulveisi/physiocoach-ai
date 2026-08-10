import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'pc-skeleton-block',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      role="status"
      aria-live="polite"
      [attr.aria-label]="ariaLabel()"
      [class]="containerClass()"
    >
      <span class="sr-only">{{ ariaLabel() }}</span>
      @for (index of placeholderIndexes(); track index) {
        <span
          class="pc-skeleton"
          [class]="skeletonClass()"
          [style.height]="heightStyle()"
        ></span>
      }
    </section>
  `,
})
export class SkeletonBlockComponent {
  readonly count = input(1);
  readonly height = input<string | number>('1.25rem');
  readonly skeletonClass = input<string>('w-full');
  readonly containerClass = input<string>('grid min-w-0 gap-2');
  readonly ariaLabel = input<string>('Loading content');

  protected readonly placeholderIndexes = computed(() => {
    const count = Number(this.count());
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    return Array.from({ length: safeCount }, (_, index) => index);
  });

  protected readonly heightStyle = computed(() => {
    const height = this.height();
    if (typeof height === 'number') {
      return `${height}px`;
    }
    return height || '1.25rem';
  });
}
