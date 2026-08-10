import { Injectable, inject } from '@angular/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NativeAuthRedirectService {
  private readonly auth = inject(AuthService);
  private hasStarted = false;

  start(): void {
    if (this.hasStarted || !Capacitor.isNativePlatform()) {
      return;
    }

    this.hasStarted = true;
    void App.addListener('appUrlOpen', (event) => {
      void this.handleAppUrlOpen(event);
    });
  }

  private async handleAppUrlOpen(event: URLOpenListenerEvent): Promise<void> {
    if (!this.isAuthRedirectUrl(event.url)) {
      return;
    }

    try {
      await Browser.close().catch(() => undefined);
      await this.auth.completeNativeRedirect(event.url);
    } catch (error) {
      console.error('Native auth redirect session sync failed', error);
    }
  }

  private isAuthRedirectUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'ir.otconnect.physiocoach:') {
        return (
          parsedUrl.hostname === 'oauth-callback' ||
          parsedUrl.pathname === '/oauth-callback' ||
          parsedUrl.pathname.startsWith('/oauth-callback')
        );
      }
      if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
        const host = parsedUrl.hostname;
        return (
          (host === 'physiocoach.otconnect.ir' ||
            host === 'dev.physiocoach-ai-web.pages.dev' ||
            host === 'localhost' ||
            host === '127.0.0.1') &&
          parsedUrl.pathname.startsWith('/oauth-callback')
        );
      }
      return false;
    } catch {
      return false;
    }
  }
}
