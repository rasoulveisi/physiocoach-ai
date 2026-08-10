import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  template: `
    <main class="grid h-dvh overflow-y-auto place-items-center bg-slate-950 px-4 py-10 text-white text-center">
      <section class="grid gap-6 justify-items-center">
        <!-- Spinner Ring -->
        <div class="relative flex items-center justify-center w-16 h-16">
          <div class="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
          <i class="pi pi-bolt text-xl text-blue-400 animate-pulse"></i>
        </div>

        <div class="grid gap-2">
          <p class="text-sm font-medium tracking-wide text-slate-300">
            {{ statusMessage() }}
          </p>
          <p class="text-xs text-slate-500 max-w-xs leading-relaxed">
            Please wait while we secure your connection and redirect you.
          </p>
        </div>

        <!-- Fallback button shown immediately if native redirect is pending -->
        @if (isNativeRedirect()) {
          <div class="mt-4 animate-fade-in">
            <button
              (click)="openApp()"
              class="px-6 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all duration-200 cursor-pointer inline-flex items-center gap-2"
            >
              <i class="pi pi-external-link"></i>
              Open PhysioCoach AI App
            </button>
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fadeIn 0.4s ease-out forwards;
    }
  `]
})
export class OauthCallbackPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly nativeRedirectUrl = signal('ir.otconnect.physiocoach://oauth-callback');
  protected readonly isNativeRedirect = signal(false);
  protected readonly statusMessage = signal('Completing sign-in...');

  ngOnInit(): void {
    const code = this.route.snapshot.queryParams['code'];
    const state = this.route.snapshot.queryParams['state'];
    const isNativeParam = this.route.snapshot.queryParams['native'] === 'true';

    if (isNativeParam && code) {
      this.handleNativeRedirect(code, state);
    } else {
      void this.completeWebRedirect();
    }
  }

  private async completeWebRedirect(): Promise<void> {
    try {
      await this.auth.completeNativeRedirect(window.location.href);
    } catch (error) {
      console.error('Failed to complete OAuth redirect', error);
      this.statusMessage.set(
        error instanceof Error ? error.message : 'Sign-in could not be completed.',
      );
    }
  }

  private handleNativeRedirect(code: string, state?: string): void {
    this.isNativeRedirect.set(true);
    const params = new URLSearchParams({ code });
    if (state) {
      params.set('state', state);
    }
    const targetUrl = `ir.otconnect.physiocoach://oauth-callback?${params.toString()}`;
    this.nativeRedirectUrl.set(targetUrl);

    // 1. Try immediate window replacement
    try {
      window.location.replace(targetUrl);
    } catch {
      // Silently catch
    }

    // 2. Try hidden iframe injection
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = targetUrl;
      document.body.appendChild(iframe);
    } catch {
      // Silently catch
    }

    // 3. Standard timeout fallback
    setTimeout(() => {
      window.location.href = targetUrl;
    }, 200);
  }

  protected openApp(): void {
    try {
      window.location.href = this.nativeRedirectUrl();
    } catch {
      // Silently catch
    }
  }
}
