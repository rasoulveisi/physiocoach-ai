import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'pc-page-state',
  standalone: true,
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
    >
      <div class="grid gap-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
          {{ eyebrow() }}
        </p>
        <h2 class="text-xl font-semibold leading-tight">{{ title() }}</h2>
        <p class="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {{ message() }}
        </p>
      </div>

      @if (actionLabel()) {
        <button
          pButton
          type="button"
          class="w-full justify-center sm:w-fit"
          (click)="action.emit()"
        >
          {{ actionLabel() }}
        </button>
      }
    </section>
  `,
})
export class PageStateComponent {
  readonly eyebrow = input('Next step');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();
}
