import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import type { ThemeSetting } from '../../features/settings/settings.model';

type ResolvedTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'physiocoach_theme_preference_v1';
  private mediaQuery: MediaQueryList | null = null;
  private currentTheme: ThemeSetting = 'system';

  constructor() {
    if (this.isBrowser() && typeof window.matchMedia === 'function') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', () => {
        if (this.currentTheme === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  applyTheme(theme: ThemeSetting, persist = true): void {
    this.currentTheme = theme;

    if (!this.isBrowser()) {
      return;
    }

    if (persist) {
      try {
        localStorage.setItem(this.storageKey, theme);
      } catch {
        // Storage can be unavailable in restricted browser-like contexts.
      }
    }

    const resolved = this.resolveTheme(theme);
    const root = this.document.documentElement;

    root.dataset['theme'] = resolved;
    root.dataset['themePreference'] = theme;
    root.style.colorScheme = resolved;
  }

  readStoredTheme(): ThemeSetting | null {
    if (!this.isBrowser()) {
      return null;
    }

    try {
      const value = localStorage.getItem(this.storageKey);
      return this.isThemeSetting(value) ? value : null;
    } catch {
      return null;
    }
  }

  private resolveTheme(theme: ThemeSetting): ResolvedTheme {
    if (theme !== 'system') {
      return theme;
    }

    return this.mediaQuery?.matches ? 'dark' : 'light';
  }

  private isThemeSetting(value: string | null): value is ThemeSetting {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
