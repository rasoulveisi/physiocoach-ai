import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  inject,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import Aura from '@primeng/themes/aura';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { APP_CONFIG, appConfig as localAppConfig } from './core/config/app-config';
import { NativeAuthRedirectService } from './core/auth/native-auth-redirect.service';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';
import { authRefreshInterceptor } from './core/interceptors/auth-refresh.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([apiErrorInterceptor, authRefreshInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: "[data-theme='dark']",
        },
      },
    }),
    MessageService,
    provideRouter(routes),
    provideAppInitializer(() => {
      inject(NativeAuthRedirectService).start();
    }),
    { provide: APP_CONFIG, useValue: localAppConfig },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
