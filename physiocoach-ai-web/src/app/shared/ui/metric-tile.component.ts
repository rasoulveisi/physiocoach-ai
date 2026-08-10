import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'pc-metric-tile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="group relative overflow-hidden rounded-[14px] border border-surface-border
                    bg-surface-0 px-5 py-4 shadow-card
                    transition-[box-shadow,transform] duration-200
                    hover:shadow-card-md hover:-translate-y-0.5"
    >
      <!-- Gradient top accent -->
      <div
        class="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 to-violet-500"
        aria-hidden="true"
      ></div>

      <!-- Label -->
      <p class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-muted">
        {{ label() }}
      </p>

      <!-- Value + Trend -->
      <div class="mt-2 flex items-end justify-between gap-2">
        <p class="text-[1.875rem] font-extrabold leading-none tracking-[-0.03em] text-primary">
          {{ value() }}
        </p>
        @if (trend()) {
          <span
            [class]="
              trendIsPositive()
                ? 'border border-success-border bg-success-surface text-success-text'
                : 'border border-danger-border  bg-danger-surface  text-danger-text'
            "
            class="rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
          >
            {{ trendIsPositive() ? '↑' : '↓' }} {{ trend() }}
          </span>
        }
      </div>

      <!-- Caption -->
      @if (caption()) {
        <p class="mt-1.5 text-[0.8125rem] leading-[1.4] text-secondary">
          {{ caption() }}
        </p>
      }
    </article>
  `,
})
export class MetricTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly trend = input<string | null>(null);
  readonly caption = input<string | null>(null);

  protected trendIsPositive(): boolean {
    const t = this.trend();
    return !t || !t.startsWith('-');
  }
}
