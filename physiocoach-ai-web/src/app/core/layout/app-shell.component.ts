import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, defer, finalize, from, map, of, timer } from 'rxjs';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { CurrentUserService } from '../auth/current-user.service';
import { WorkoutSessionStore } from '../../features/workout-session/workout-session.store';

interface MobileNavItem {
  label: string;
  path: string;
  exact: boolean;
  icon: string;
  /** Render as a raised center "Session" FAB. */
  fab?: boolean;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [ButtonModule, RouterLink, RouterLinkActive, RouterOutlet, ToastModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  protected readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  protected readonly isSigningOut = signal(false);
  protected readonly canShowAdmin = () => this.currentUser.isAdmin();

  protected readonly topNavItems = [
    { label: 'Today', path: '/dashboard', exact: true, icon: 'pi pi-home' },
    { label: 'Plan', path: '/plan', exact: true, icon: 'pi pi-list' },
    { label: 'Session', path: '/session', exact: true, icon: 'pi pi-play' },
    { label: 'Assessment', path: '/onboarding', exact: true, icon: 'pi pi-id-card' },
    { label: 'Profile', path: '/settings', exact: true, icon: 'pi pi-user' },
  ];

  protected readonly mobilePrimaryItems: MobileNavItem[] = [
    { label: 'Today', path: '/dashboard', exact: true, icon: 'pi pi-home' },
    { label: 'Plan', path: '/plan', exact: true, icon: 'pi pi-list' },
    { label: 'Session', path: '/session', exact: true, icon: 'pi pi-play', fab: true },
    { label: 'Assessment', path: '/onboarding', exact: true, icon: 'pi pi-id-card' },
    { label: 'Profile', path: '/settings', exact: true, icon: 'pi pi-user' },
  ];

  protected readonly adminPathItem = {
    label: 'Admin',
    path: '/admin',
    exact: true,
    icon: 'pi pi-shield',
  };

  protected readonly currentUser = inject(CurrentUserService);
  protected readonly workoutSessionStore = inject(WorkoutSessionStore);

  protected readonly activeWorkout = computed(() => {
    const session = this.workoutSessionStore.activeSession();
    if (!session || session.status !== 'active') {
      return null;
    }

    return session;
  });

  /** 0–100 live completion percentage for the floating session pill. */
  protected readonly sessionProgressPercent = computed(() => {
    const session = this.activeWorkout();
    if (!session || session.progress.totalSets <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((session.progress.completedSets / session.progress.totalSets) * 100));
  });

  /** Ticking clock (1s) so the live workout timer stays current under OnPush. */
  private readonly now = toSignal(timer(0, 1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });

  /** Whole seconds elapsed since the active workout started (or null when unknown). */
  protected readonly elapsedSeconds = computed(() => {
    const session = this.activeWorkout();
    if (!session?.startedAt) {
      return null;
    }
    const started = new Date(session.startedAt).getTime();
    if (Number.isNaN(started)) {
      return null;
    }
    return Math.max(0, Math.floor((this.now() - started) / 1000));
  });

  /** HH:MM:SS (or MM:SS) live timer label for the floating pill. */
  protected readonly elapsedLabel = computed(() => {
    const total = this.elapsedSeconds();
    if (total === null) {
      return '00:00';
    }
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  });

  constructor() {
    if (this.isAuthenticated()) {
      this.currentUser.loadCurrentUser().subscribe();
      this.workoutSessionStore.ensureActiveSession();
    }
  }

  protected isAuthenticated(): boolean {
    return this.authStore.isAuthenticated();
  }

  protected isAssessmentRoute(): boolean {
    return this.router.url.startsWith('/onboarding');
  }

  protected signOut(): void {
    if (this.isSigningOut()) {
      return;
    }

    this.isSigningOut.set(true);
    defer(() => from(this.auth.signOut()))
      .pipe(
        catchError((error) => {
          const details = error instanceof Error ? error.message : 'Please try again.';
          this.messageService.add({
            severity: 'error',
            summary: 'Sign out failed',
            detail: details,
            life: 3000,
          });
          return of(void 0);
        }),
        finalize(() => this.isSigningOut.set(false)),
      )
      .subscribe();
  }
}
