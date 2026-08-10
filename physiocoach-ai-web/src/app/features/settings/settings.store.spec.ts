import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SettingsApiService } from './settings-api.service';
import { type UserSettings } from './settings.model';
import { SettingsStore } from './settings.store';

class FakeSettingsApiService {
  getSettings() {
    return of<UserSettings>({
      theme: 'dark',
      unitSystem: 'imperial',
      defaultWorkoutView: 'byPlan',
      remindersEnabled: true,
    });
  }

  patchSettings() {
    return of<UserSettings>({
      theme: 'light',
      unitSystem: 'imperial',
      defaultWorkoutView: 'byPlan',
      remindersEnabled: true,
    });
  }
}

describe('SettingsStore', () => {
  beforeEach(() => {
    installLocalStorageStub();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
  });

  it('loads settings and applies patch updates', () => {
    TestBed.configureTestingModule({
      providers: [SettingsStore, { provide: SettingsApiService, useClass: FakeSettingsApiService }],
    });

    const store = TestBed.inject(SettingsStore);
    store.loadSettings();

    expect(store.settings().theme).toBe('dark');

    store.setTheme('light');

    expect(store.settings().theme).toBe('light');
    expect(store.unitsLabel()).toBe('lbs/in');
  });

  it('keeps theme locally when remote save fails', () => {
    class FailingThemeSettingsApiService extends FakeSettingsApiService {
      override patchSettings() {
        return throwError(() => new Error('Remote rejected settings'));
      }
    }

    TestBed.configureTestingModule({
      providers: [
        SettingsStore,
        { provide: SettingsApiService, useClass: FailingThemeSettingsApiService },
      ],
    });

    const store = TestBed.inject(SettingsStore);
    store.loadSettings();

    store.setTheme('dark');

    expect(store.settings().theme).toBe('dark');
    expect(store.error()).toBeNull();
    expect(localStorage.getItem('physiocoach_theme_preference_v1')).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});

function installLocalStorageStub(): void {
  if (globalThis.localStorage) {
    return;
  }

  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  });
}
