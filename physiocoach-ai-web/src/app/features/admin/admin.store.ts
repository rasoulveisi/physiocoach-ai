import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, of, take, tap } from 'rxjs';

import { AdminApiService } from './admin-api.service';
import { type AdminHealth, type AdminSummary } from './admin.model';

@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(false);
  readonly summary = signal<AdminSummary | null>(null);
  readonly health = signal<AdminHealth | null>(null);
  readonly error = signal<string | null>(null);

  readonly hasSummary = computed(() => this.summary() !== null);
  readonly featuresText = computed(() => this.summary()?.features.join(', ') ?? '');
  readonly internalOpsLabel = computed(() =>
    this.summary()?.canAccessInternalOps ? 'enabled' : 'disabled',
  );

  load(): void {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api
      .getSummary()
      .pipe(
        take(1),
        tap((summary) => this.summary.set(summary)),
        catchError((error) => {
          this.error.set(error instanceof Error ? error.message : 'Could not load admin summary.');
          this.summary.set(null);
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();

    this.api
      .getHealth()
      .pipe(
        take(1),
        tap((health) => this.health.set(health)),
        catchError(() => {
          this.health.set(null);
          return of(null);
        }),
      )
      .subscribe();
  }
}
