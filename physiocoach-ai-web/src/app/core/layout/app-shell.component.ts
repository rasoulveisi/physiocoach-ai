import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, defer, finalize, from, of } from 'rxjs';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { DisclaimerComponent } from '../../shared/ui/disclaimer.component';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { CurrentUserService } from '../auth/current-user.service';
import { WorkoutSessionStore } from '../../features/workout-session/workout-session.store';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [ButtonModule, DisclaimerComponent, RouterLink, RouterLinkActive, RouterOutlet, ToastModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  protected readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  protected readonly isSigningOut = signal(false);
  protected readonly isMoreMenuOpen = signal(false);
  protected readonly canShowAdmin = () => this.currentUser.isAdmin();

  protected readonly topNavItems = [
    { label: 'Today', path: '/dashboard', exact: true, icon: 'pi pi-home' },
    { label: 'Plan', path: '/plan', exact: true, icon: 'pi pi-list' },
    { label: 'Session', path: '/session', exact: true, icon: 'pi pi-play' },
    { label: 'Assessment', path: '/onboarding', exact: true, icon: 'pi pi-id-card' },
    { label: 'Profile', path: '/settings', exact: true, icon: 'pi pi-user' },
  ];

  protected readonly mobilePrimaryItems = [
    { label: 'Today', path: '/dashboard', exact: true, icon: 'pi pi-home' },
    { label: 'Plan', path: '/plan', exact: true, icon: 'pi pi-list' },
    { label: 'Session', path: '/session', exact: true, icon: 'pi pi-play' },
    { label: 'Profile', path: '/settings', exact: true, icon: 'pi pi-user' },
  ];

  protected readonly mobileMoreItems = [
    { label: 'Assessment', path: '/onboarding', exact: true, icon: 'pi pi-id-card' },
    { label: 'Profile', path: '/settings', exact: true, icon: 'pi pi-cog' },
  ];

  protected readonly adminPathItem = {
    label: 'Admin',
    path: '/admin',
    exact: true,
    icon: 'pi pi-shield',
  };

  protected readonly mobileAdminItem = {
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

  constructor() {
    if (this.isAuthenticated()) {
      this.currentUser.loadCurrentUser().subscribe();
      this.workoutSessionStore.ensureActiveSession();
    }
  }

  protected toggleMoreMenu(): void {
    this.isMoreMenuOpen.update((value) => !value);
  }

  protected closeMoreMenu(): void {
    this.isMoreMenuOpen.set(false);
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
