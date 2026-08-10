import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { catchError, finalize, from, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  standalone: true,
  imports: [ButtonModule, FormsModule],
  templateUrl: './auth.page.html',
})
export class AuthPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.authStore.isAuthenticated()) {
        void this.router.navigate(['/dashboard']);
      }
    });
  }

  protected readonly isSubmitting = signal(false);
  protected readonly isOpeningGoogle = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly authMode = signal<'signIn' | 'signUp'>('signIn');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');

  ngOnInit(): void {
    from(this.auth.initialize(true))
      .pipe(
        catchError((error) => {
          console.error('Session restore failed', error);
          return of(void 0);
        }),
      )
      .subscribe();
  }

  toggleAuthMode(): void {
    this.errorMessage.set(null);
    if (this.authMode() === 'signIn') {
      this.authMode.set('signUp');
    } else {
      this.authMode.set('signIn');
    }
    this.password.set('');
    this.confirmPassword.set('');
  }

  onSubmit(): void {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const mode = this.authMode();
    let authOperation$;

    if (mode === 'signIn') {
      authOperation$ = from(this.auth.signInWithEmailAndPassword(this.email(), this.password()));
    } else {
      if (this.password() !== this.confirmPassword()) {
        this.errorMessage.set('Passwords do not match.');
        this.isSubmitting.set(false);
        return;
      }
      authOperation$ = from(this.auth.signUpWithEmailAndPassword(this.email(), this.password()));
    }

    authOperation$.pipe(
      catchError((error) => {
        this.handleError(error);
        return of(void 0);
      }),
      finalize(() => {
        this.isSubmitting.set(false);
      })
    ).subscribe();
  }

  continueWithGoogle(): void {
    this.isOpeningGoogle.set(true);
    this.errorMessage.set(null);

    from(this.auth.signInWithGoogle())
      .pipe(
        catchError((error) => {
          this.handleError(error);
          return of(void 0);
        }),
        finalize(() => {
          this.isOpeningGoogle.set(false);
        }),
      )
      .subscribe();
  }

  private handleError(error: unknown): void {
    console.error('Authentication error:', error);
    if (error instanceof Error) {
      this.errorMessage.set(error.message);
    } else {
      this.errorMessage.set('An unexpected error occurred. Please try again.');
    }
  }
}
