import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  environment: 'local' | 'development' | 'staging' | 'production';
}

declare global {
  interface Window {
    __PHYSIOCOACH_CONFIG__?: Partial<AppConfig>;
  }
}

const runtimeConfig = typeof window === 'undefined' ? undefined : window.__PHYSIOCOACH_CONFIG__;

const DEV_API_URL = 'https://physiocoach-ai-api-dev.otconnect.ir/api/v1';
const PROD_API_URL = 'https://physiocoach-ai-api.otconnect.ir/api/v1';
const LOCAL_API_URL = 'http://localhost:8787/api/v1';

function resolveApiUrl(configUrl?: string): string {
  if (typeof window === 'undefined') {
    return LOCAL_API_URL;
  }

  const host = window.location.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return LOCAL_API_URL;
  }

  if (host === 'dev.physiocoach-ai-web.pages.dev') {
    return DEV_API_URL;
  }

  // Keep production host as the highest priority in case stale runtime config gets baked into static build.
  if (host === 'physiocoach.otconnect.ir') {
    return PROD_API_URL;
  }

  if (configUrl) {
    return configUrl;
  }

  return PROD_API_URL;
}

export const appConfig: AppConfig = {
  apiUrl: resolveApiUrl(runtimeConfig?.apiUrl),
  environment: runtimeConfig?.environment ?? 'local',
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
