# Persian Interface Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Persian as a persistent, user-selectable RTL interface language while keeping English as the default and fallback.

**Architecture:** Configure ngx-translate with runtime JSON resources and wrap language selection, persistence, and document direction in a focused `LocalizationService`. Migrate app-owned copy feature by feature, keeping English and Persian resources structurally identical and leaving API/AI content unchanged.

**Tech Stack:** Angular 21 standalone components, TypeScript 5.9, `@ngx-translate/core`, `@ngx-translate/http-loader`, Vitest, Tailwind CSS, PrimeNG, pnpm.

## Global Constraints

- English is the first-visit default and fallback language.
- Supported language codes are exactly `en` and `fa`.
- Store the preference under `physiocoach.language`.
- Persian copy is clear, modern, friendly, and medically accurate.
- Translation resources live at `public/i18n/en.json` and `public/i18n/fa.json`.
- Translate only app-owned interface and accessibility copy; do not translate API/AI-provided exercise names, workout instructions, safety notes, or server errors.
- Persian sets `lang="fa"` and `dir="rtl"`; English sets `lang="en"` and `dir="ltr"`.
- English and Persian JSON must contain identical leaf-key paths and interpolation parameter names.
- Use semantic, feature-namespaced keys rather than English sentences as keys.
- Do not introduce date, number, measurement, or unit localization in this phase.
- Every task ends with focused tests and a commit.

---

## File Structure

**New localization infrastructure**

- `src/app/core/i18n/localization.service.ts` — supported locales, initialization, persistence, ngx-translate switching, and document language/direction.
- `src/app/core/i18n/localization.service.spec.ts` — service behavior with a fake translation service and storage.
- `public/i18n/en.json` — canonical English interface copy.
- `public/i18n/fa.json` — Persian copy with exact key parity.
- `scripts/check-translations.mjs` — recursive key and interpolation parity validation.

**Configuration and global presentation**

- `package.json`, `pnpm-lock.yaml` — ngx-translate dependencies and parity command.
- `src/app/app.config.ts` — root translation providers and startup initializer.
- `src/index.html` — English bootstrap metadata and Persian-capable font resource.
- `src/styles.css` — Persian font selection, RTL-safe typography, and direction-aware exceptions.

**Feature migrations**

- `src/app/core/layout/app-shell.component.{ts,html}` — translated navigation, sign-out messages, and mobile accessibility.
- `src/app/shared/ui/{disclaimer.component,exercise-visual.component,number-range-picker.component,page-state.component,metric-tile.component,skeleton-block.component}.{ts,html}` where present — shared app-owned copy and ARIA text.
- `src/app/features/*/*.page.{ts,html}` — feature-owned template and TypeScript copy.
- Existing feature specs plus focused new specs — translated runtime messages and representative rendering.

---

### Task 1: Localization Runtime and Persistence

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/app/app.config.ts`
- Create: `src/app/core/i18n/localization.service.ts`
- Create: `src/app/core/i18n/localization.service.spec.ts`
- Create: `public/i18n/en.json`
- Create: `public/i18n/fa.json`

**Interfaces:**

- Produces: `type SupportedLanguage = 'en' | 'fa'`
- Produces: `SUPPORTED_LANGUAGES: readonly LanguageOption[]`
- Produces: `LocalizationService.currentLanguage: Signal<SupportedLanguage>`
- Produces: `LocalizationService.initialize(): Promise<void>`
- Produces: `LocalizationService.selectLanguage(language: SupportedLanguage): Promise<void>`
- Consumes: browser `localStorage`, Angular `DOCUMENT`, and ngx-translate `TranslateService`

- [ ] **Step 1: Install runtime dependencies**

Run:

```bash
pnpm add @ngx-translate/core @ngx-translate/http-loader
```

Expected: `package.json` contains both packages under `dependencies`, and `pnpm-lock.yaml` resolves versions compatible with Angular 21.

- [ ] **Step 2: Write failing localization service tests**

Create `src/app/core/i18n/localization.service.spec.ts` with a fake exposing `setFallbackLang('en')` and `use(language)`, then cover these exact cases:

```ts
it('defaults to English when storage is empty', async () => {
  await service.initialize();
  expect(service.currentLanguage()).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  expect(document.documentElement.dir).toBe('ltr');
});

it('restores a stored Persian preference', async () => {
  localStorage.setItem('physiocoach.language', 'fa');
  await service.initialize();
  expect(service.currentLanguage()).toBe('fa');
  expect(document.documentElement.lang).toBe('fa');
  expect(document.documentElement.dir).toBe('rtl');
});

it('ignores unsupported stored values', async () => {
  localStorage.setItem('physiocoach.language', 'de');
  await service.initialize();
  expect(service.currentLanguage()).toBe('en');
});

it('persists and applies a selected language', async () => {
  await service.selectLanguage('fa');
  expect(localStorage.getItem('physiocoach.language')).toBe('fa');
  expect(document.documentElement.lang).toBe('fa');
  expect(document.documentElement.dir).toBe('rtl');
});

it('falls back to English when Persian loading rejects', async () => {
  translate.use.mockRejectedValueOnce(new Error('missing fa.json'));
  await service.selectLanguage('fa');
  expect(service.currentLanguage()).toBe('en');
  expect(document.documentElement.dir).toBe('ltr');
});
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run:

```bash
pnpm test -- src/app/core/i18n/localization.service.spec.ts
```

Expected: FAIL because `LocalizationService` does not exist.

- [ ] **Step 4: Implement the localization service**

Create the service with these public types and behavior:

```ts
export type SupportedLanguage = 'en' | 'fa';

export interface LanguageOption {
  code: SupportedLanguage;
  labelKey: 'SETTINGS.LANGUAGE.ENGLISH' | 'SETTINGS.LANGUAGE.PERSIAN';
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', labelKey: 'SETTINGS.LANGUAGE.ENGLISH' },
  { code: 'fa', labelKey: 'SETTINGS.LANGUAGE.PERSIAN' },
];

const STORAGE_KEY = 'physiocoach.language';

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly selectedLanguage = signal<SupportedLanguage>('en');
  readonly currentLanguage = this.selectedLanguage.asReadonly();

  async initialize(): Promise<void> {
    this.translate.setFallbackLang('en');
    const stored = localStorage.getItem(STORAGE_KEY);
    await this.applyLanguage(stored === 'fa' || stored === 'en' ? stored : 'en', false);
  }

  async selectLanguage(language: SupportedLanguage): Promise<void> {
    await this.applyLanguage(language, true);
  }

  private async applyLanguage(language: SupportedLanguage, persist: boolean): Promise<void> {
    try {
      await firstValueFrom(this.translate.use(language));
      this.commitLanguage(language, persist);
    } catch {
      await firstValueFrom(this.translate.use('en'));
      this.commitLanguage('en', persist);
    }
  }

  private commitLanguage(language: SupportedLanguage, persist: boolean): void {
    this.selectedLanguage.set(language);
    this.document.documentElement.lang = language;
    this.document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
    if (persist) localStorage.setItem(STORAGE_KEY, language);
  }
}
```

Use a safe storage wrapper if the existing test environment exposes storage access errors; the observable/promise adapter must match the installed ngx-translate API.

- [ ] **Step 5: Add root providers and startup initialization**

In `src/app/app.config.ts`, configure the standalone API:

```ts
provideTranslateService({
  fallbackLang: 'en',
  lang: 'en',
  loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
}),
provideAppInitializer(() => inject(LocalizationService).initialize()),
```

Create both JSON files with the initial canonical structure:

```json
{
  "COMMON": {
    "LOADING": "Loading…",
    "RETRY": "Retry",
    "SAVE": "Save",
    "CANCEL": "Cancel",
    "CLOSE": "Close"
  },
  "SETTINGS": {
    "LANGUAGE": {
      "LABEL": "Language",
      "ENGLISH": "English",
      "PERSIAN": "Persian"
    }
  }
}
```

Persian values:

```json
{
  "COMMON": {
    "LOADING": "در حال بارگذاری…",
    "RETRY": "تلاش دوباره",
    "SAVE": "ذخیره",
    "CANCEL": "انصراف",
    "CLOSE": "بستن"
  },
  "SETTINGS": {
    "LANGUAGE": {
      "LABEL": "زبان",
      "ENGLISH": "انگلیسی",
      "PERSIAN": "فارسی"
    }
  }
}
```

- [ ] **Step 6: Run focused tests and build**

Run:

```bash
pnpm test -- src/app/core/i18n/localization.service.spec.ts
pnpm build
```

Expected: localization tests PASS; build completes and copies `dist/**/browser/i18n/en.json` and `fa.json`.

- [ ] **Step 7: Commit the runtime**

```bash
git add package.json pnpm-lock.yaml src/app/app.config.ts src/app/core/i18n public/i18n
git commit -m "feat: add runtime localization foundation"
```

---

### Task 2: Translation Parity, Settings Selector, and RTL Foundation

**Files:**

- Create: `scripts/check-translations.mjs`
- Modify: `package.json`
- Modify: `src/app/features/settings/settings.page.ts`
- Modify: `src/app/features/settings/settings.page.html`
- Create: `src/app/features/settings/settings.page.spec.ts`
- Modify: `src/styles.css`
- Modify: `src/index.html`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`

**Interfaces:**

- Consumes: `LocalizationService`, `SUPPORTED_LANGUAGES`, and `SupportedLanguage`
- Produces: `pnpm check:i18n`
- Produces: Settings language selector calling `selectLanguage()`

- [ ] **Step 1: Write the parity checker and make it fail on a fixture mismatch**

Implement recursive leaf-path collection and interpolation extraction:

```js
function leafPaths(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.keys(value).flatMap((key) => leafPaths(value[key], prefix ? `${prefix}.${key}` : key));
}

function parameters(value) {
  return [...String(value).matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1]).sort();
}
```

The script must load both files, report missing/extra paths and parameter mismatches, and exit nonzero on any mismatch. Add:

```json
"check:i18n": "node scripts/check-translations.mjs"
```

Run once with a temporary missing key, confirm exit code 1, then restore parity.

- [ ] **Step 2: Add failing Settings tests**

Cover that the selector renders both choices and calls the service:

```ts
it('changes the interface language from Settings', async () => {
  const select = fixture.nativeElement.querySelector('#language') as HTMLSelectElement;
  select.value = 'fa';
  select.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  expect(localization.selectLanguage).toHaveBeenCalledWith('fa');
});
```

Run `pnpm test -- src/app/features/settings/settings.page.spec.ts`; expected FAIL because the control does not exist.

- [ ] **Step 3: Add the selector and migrate Settings-owned copy**

Import `TranslatePipe`; inject `LocalizationService`; expose `SUPPORTED_LANGUAGES`; and implement:

```ts
protected onLanguageChange(language: string): void {
  if (language === 'en' || language === 'fa') {
    void this.localization.selectLanguage(language);
  }
}
```

Add a native selector before theme:

```html
<label class="grid min-w-0 gap-1">
  <span class="text-sm font-medium">{{ 'SETTINGS.LANGUAGE.LABEL' | translate }}</span>
  <select id="language" name="language"
    [ngModel]="localization.currentLanguage()"
    (ngModelChange)="onLanguageChange($event)">
    @for (language of languages; track language.code) {
      <option [value]="language.code">{{ language.labelKey | translate }}</option>
    }
  </select>
</label>
```

Migrate all remaining Settings text under `SETTINGS.*`, including `PROFILE`, `PREFERENCES`, auth state, theme/unit/view options, reminders, reload labels, avatar/email ARIA text, and toast summaries/details. Use `translate.instant()` only inside event handlers and effects; leave `store.error()` unchanged because it is server-owned.

- [ ] **Step 4: Add RTL typography and document metadata**

Load a Persian-capable font such as Vazirmatn alongside Plus Jakarta Sans in `src/index.html`. Add:

```css
html[dir='rtl'] body {
  font-family: 'Vazirmatn', Tahoma, Arial, sans-serif;
}

html[dir='rtl'] .pc-kicker {
  letter-spacing: 0;
}

[dir='rtl'] .directional-icon {
  transform: scaleX(-1);
}
```

Keep bootstrap `<html lang="en" dir="ltr">`; runtime initialization owns subsequent changes. Translate static metadata through a small initialization helper only if it is moved under app control; otherwise retain English metadata because English is the default public document.

- [ ] **Step 5: Run Settings, parity, lint, and build checks**

```bash
pnpm test -- src/app/features/settings/settings.page.spec.ts src/app/core/i18n/localization.service.spec.ts
pnpm check:i18n
pnpm lint
pnpm build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-translations.mjs package.json src/app/features/settings src/styles.css src/index.html public/i18n
git commit -m "feat: add language settings and RTL foundation"
```

---

### Task 3: Shell and Shared UI Localization

**Files:**

- Modify: `src/app/core/layout/app-shell.component.ts`
- Modify: `src/app/core/layout/app-shell.component.html`
- Create: `src/app/core/layout/app-shell.component.spec.ts`
- Modify: `src/app/shared/ui/disclaimer.component.{ts,html,spec.ts}`
- Modify: `src/app/shared/ui/exercise-visual.component.{ts,html}`
- Modify: `src/app/shared/ui/number-range-picker.component.{ts,html,spec.ts}`
- Modify: `src/app/shared/ui/page-state.component.ts`
- Modify: `src/app/shared/ui/metric-tile.component.ts`
- Modify: `src/app/shared/ui/skeleton-block.component.ts`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`

**Interfaces:**

- Nav item shape changes from `{ label: string }` to `{ labelKey: string }`.
- Shared components consume `TranslatePipe` or `TranslateService` for app-owned defaults.
- Exercise/API names and descriptions remain raw.

- [ ] **Step 1: Write failing shell tests**

Assert representative translated output and sign-out error translation:

```ts
it('renders translated navigation labels', () => {
  expect(element.textContent).toContain('Today');
  translate.use('fa');
  fixture.detectChanges();
  expect(element.textContent).toContain('امروز');
});

it('uses translated fallback detail when sign out rejects without an Error', async () => {
  auth.signOut.mockRejectedValue('failed');
  component.signOut();
  await fixture.whenStable();
  expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({
    summary: 'خروج ناموفق بود',
    detail: 'لطفاً دوباره تلاش کنید.'
  }));
});
```

Run the focused spec; expected FAIL on raw English labels.

- [ ] **Step 2: Migrate shell copy**

Use keys `NAV.TODAY`, `NAV.PLAN`, `NAV.SESSION`, `NAV.PROGRESS`, `NAV.ASSESSMENT`, `NAV.POSTURE`, `NAV.MEASUREMENTS`, `NAV.PROFILE`, `NAV.SETTINGS`, `NAV.ADMIN`, `NAV.MORE`, `NAV.MOBILE_ARIA`, `AUTH.SIGNED_IN`, `AUTH.SIGN_OUT`, `AUTH.SIGNING_OUT`, `AUTH.LOGOUT`, `AUTH.SIGN_OUT_FAILED`, and `COMMON.TRY_AGAIN`.

Render item labels as `{{ item.labelKey | translate }}`. Translate app-owned toast fallback text in TypeScript with `translate.instant()`. Do not translate an actual `Error.message` returned by authentication.

- [ ] **Step 3: Migrate shared component copy**

Add exact common namespaces:

- `DISCLAIMER.TEXT`: safety disclaimer shown by `pc-disclaimer`.
- `EXERCISE_VISUAL.*`: visual unavailable/loading/fallback labels and app-owned ARIA text.
- `NUMBER_PICKER.*`: decrease/increase/select labels with `{{ label }}` interpolation.
- `PAGE_STATE.*`: generic loading/empty/retry app-owned defaults.
- `METRIC.*`: app-owned metric accessibility patterns.

Inputs containing API exercise names remain values and are interpolated without translation. Keep CSS class inputs and technical resolver strings unchanged.

- [ ] **Step 4: Add paired English/Persian keys**

Representative values must include:

```json
"NAV": { "TODAY": "Today", "PLAN": "Plan", "SESSION": "Session", "PROGRESS": "Progress", "MORE": "More" }
```

```json
"NAV": { "TODAY": "امروز", "PLAN": "برنامه", "SESSION": "جلسه", "PROGRESS": "پیشرفت", "MORE": "بیشتر" }
```

Preserve exact key and interpolation parity for all additions.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- src/app/core/layout/app-shell.component.spec.ts src/app/shared/ui/disclaimer.component.spec.ts src/app/shared/ui/number-range-picker.component.spec.ts
pnpm check:i18n
pnpm lint
git add src/app/core/layout src/app/shared/ui public/i18n
git commit -m "feat: localize app shell and shared interface"
```

Expected: tests, parity, and lint PASS before commit.

---

### Task 4: Authentication and OAuth Localization

**Files:**

- Modify: `src/app/features/auth/auth.page.ts`
- Modify: `src/app/features/auth/auth.page.html`
- Modify: `src/app/features/auth/auth.page.spec.ts`
- Modify: `src/app/features/oauth-callback/oauth-callback.page.ts`
- Create: `src/app/features/oauth-callback/oauth-callback.page.spec.ts`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`

**Interfaces:**

- Consumes: ngx-translate pipe and service.
- Keeps provider/server `Error.message` values unchanged.

- [ ] **Step 1: Add failing tests for owned authentication messages**

Test password mismatch and unknown-error fallback in both languages:

```ts
expect(component.errorMessage()).toBe('Passwords do not match.');
await translate.use('fa');
component.onSubmit();
expect(component.errorMessage()).toBe('رمزهای عبور یکسان نیستند.');
```

Test OAuth callback loading, retry, and fallback error copy. Run both specs; expected FAIL before migration.

- [ ] **Step 2: Migrate template and TypeScript copy**

Use `AUTH.*` keys for welcome, sign-in/sign-up mode, email/password fields, confirm password, Google action, submitting states, toggle prompts, terms/privacy copy, password mismatch, and unexpected error. Use `OAUTH.*` for callback progress, success, retry, and owned fallback errors.

Keep these distinctions explicit:

```ts
if (error instanceof Error) {
  this.errorMessage.set(error.message); // provider/server copy remains unchanged
} else {
  this.errorMessage.set(this.translate.instant('AUTH.UNEXPECTED_ERROR'));
}
```

- [ ] **Step 3: Add complete paired translations**

Use friendly Persian such as `ورود`, `ساخت حساب`, `ایمیل`, `رمز عبور`, `تکرار رمز عبور`, `ادامه با گوگل`, and `خطایی غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.` Keep product and provider names LTR-isolated where needed.

- [ ] **Step 4: Verify and commit**

```bash
pnpm test -- src/app/features/auth/auth.page.spec.ts src/app/features/oauth-callback/oauth-callback.page.spec.ts
pnpm check:i18n
pnpm lint
git add src/app/features/auth src/app/features/oauth-callback public/i18n
git commit -m "feat: localize authentication flows"
```

---

### Task 5: Landing Page Localization

**Files:**

- Modify: `src/app/features/landing/landing.page.ts`
- Modify: `src/app/features/landing/landing.page.html`
- Create: `src/app/features/landing/landing.page.spec.ts`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`

**Interfaces:**

- Landing data arrays store translation keys, not rendered English.
- Numeric animation stays unchanged; only surrounding labels/prefixes/suffixes that are app-owned become translated.

- [ ] **Step 1: Write failing landing rendering tests**

Render the page with animations/timers mocked and assert representative hero, workflow, testimonial/FAQ, CTA, footer, carousel, and ARIA copy in English and Persian.

```ts
expect(text()).toContain('Train smarter. Move better.');
await translate.use('fa');
fixture.detectChanges();
expect(text()).toContain('هوشمندانه‌تر تمرین کنید. بهتر حرکت کنید.');
```

Expected: FAIL while the component contains literal English.

- [ ] **Step 2: Convert data arrays to semantic keys**

Change structures to `nameKey`, `setsKey`, `repsKey`, `tagKey`, `labelKey`, `titleKey`, `descriptionKey`, `questionKey`, and `answerKey`. Keep numeric targets and CSS badge classes unchanged. Resolve keys in the template through `TranslatePipe`; do not call `instant()` when the text must react to a live language change.

- [ ] **Step 3: Migrate every landing template string**

Populate `LANDING.NAV`, `LANDING.HERO`, `LANDING.PREVIEW`, `LANDING.STATS`, `LANDING.FEATURES`, `LANDING.HOW_IT_WORKS`, `LANDING.SAFETY`, `LANDING.TESTIMONIALS`, `LANDING.FAQ`, `LANDING.CTA`, `LANDING.FOOTER`, and `LANDING.ACCESSIBILITY`. Ensure carousel dot labels and decorative images remain semantically correct.

- [ ] **Step 4: Check responsive RTL presentation**

Use logical margins/padding or conditional direction classes where landing CSS assumes left/right. Mark only true directional arrows with `directional-icon`; do not mirror logos, checkmarks, play icons, or exercise illustrations.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- src/app/features/landing/landing.page.spec.ts
pnpm check:i18n
pnpm lint
pnpm build
git add src/app/features/landing public/i18n
git commit -m "feat: localize landing experience"
```

---

### Task 6: Onboarding Localization

**Files:**

- Modify: `src/app/features/onboarding/onboarding.page.ts`
- Modify: `src/app/features/onboarding/onboarding.page.html`
- Modify: `src/app/features/onboarding/onboarding.page.spec.ts`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`

**Interfaces:**

- Onboarding option values sent to the API stay unchanged.
- Display labels become `labelKey` fields.
- Validation and submission fallback messages use translation keys; server messages remain raw.

- [ ] **Step 1: Extend tests with English/Persian representative copy**

Cover step headings, option labels, navigation controls, validation errors, submission states, modal/confirmation text, units, and ARIA labels. Add a payload assertion proving values such as `beginner`, `metric`, equipment identifiers, posture flags, and goal identifiers are unchanged after display-label migration.

- [ ] **Step 2: Refactor display models without changing API models**

For UI option constants use:

```ts
interface LocalizedOption<T extends string> {
  value: T;
  labelKey: string;
  descriptionKey?: string;
}
```

Templates submit `option.value` and render `option.labelKey | translate`. Do not translate enum values or request payload properties.

- [ ] **Step 3: Migrate all onboarding-owned copy**

Group keys by `ONBOARDING.PROGRESS`, `WELCOME`, `PROFILE`, `MEASUREMENTS`, `EXPERIENCE`, `GOALS`, `EQUIPMENT`, `POSTURE`, `SCHEDULE`, `REVIEW`, `VALIDATION`, `SUBMISSION`, and `ACCESSIBILITY`. Use interpolations for changing values, for example `ONBOARDING.PROGRESS.STEP` with `{{ current }}` and `{{ total }}` in both files.

- [ ] **Step 4: Perform RTL-specific picker and wizard adjustments**

Verify step direction, back/next chevrons, number picker controls, unit suffix placement, selected-state icons, and sticky mobile actions. Mirror only back/next arrows. Keep numeric values and units unchanged per scope.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test -- src/app/features/onboarding/onboarding.page.spec.ts src/app/features/onboarding/onboarding.store.spec.ts
pnpm check:i18n
pnpm lint
pnpm build
git add src/app/features/onboarding public/i18n
git commit -m "feat: localize onboarding assessment"
```

---

### Task 7: Dashboard, Workout Plan, and Workout Session Localization

**Files:**

- Modify: `src/app/features/dashboard/dashboard.page.{ts,html,spec.ts}`
- Modify: `src/app/features/workout-plan/workout-plan.page.{ts,html,spec.ts}`
- Modify: `src/app/features/workout-session/workout-session.page.{ts,html,spec.ts}`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`

**Interfaces:**

- App-owned status/label maps return translation keys.
- API plan names, exercise names, instructions, media labels, and safety notes remain raw.
- Unit abbreviations and numeric formatting remain unchanged.

- [ ] **Step 1: Add failing feature tests**

For each feature, assert at least one title, empty/loading/error action, status label, button, and ARIA label switches from English to Persian. Assert an API exercise named `Goblet Squat` remains exactly `Goblet Squat` under Persian.

- [ ] **Step 2: Localize Dashboard**

Add `DASHBOARD.*` for greeting, today summary, next workout, progress cards, assessment prompts, actions, empty/loading states, and owned fallback errors. Use interpolation for user names and counts while leaving profile/API data untouched.

- [ ] **Step 3: Localize Workout Plan**

Add `WORKOUT_PLAN.*` for generation progress, generation failure heading/action, plan/source explanations, training-day labels, sets/reps/rest labels, empty state, regeneration actions, and accessibility. Do not translate `planStore.jobError()`, plan titles, exercise names, exercise instructions, or safety notes returned by the API.

- [ ] **Step 4: Localize Workout Session**

Add `WORKOUT_SESSION.*` for session controls, complete/skip actions, set tracking labels, timer controls, status text, confirmation UI, empty/loading states, and app-owned toasts. Keep exercise content and actual server error strings raw.

- [ ] **Step 5: Verify RTL action and metric layouts**

Check card action order, directional navigation, timer controls, progress bars, set tables, badges, and long Persian buttons at mobile widths. Do not reverse numeric sequence or chart axes merely because the document is RTL.

- [ ] **Step 6: Verify and commit**

```bash
pnpm test -- src/app/features/dashboard/dashboard.page.spec.ts src/app/features/workout-plan/workout-plan.page.spec.ts src/app/features/workout-session/workout-session.page.spec.ts
pnpm check:i18n
pnpm lint
pnpm build
git add src/app/features/dashboard src/app/features/workout-plan src/app/features/workout-session public/i18n
git commit -m "feat: localize workout experience"
```

---

### Task 8: Progress, Assessments, Measurements, Admin, and Final Coverage

**Files:**

- Modify: `src/app/features/progress/progress.page.{ts,html,spec.ts}`
- Modify: `src/app/features/posture-assessment/posture-assessment.page.{ts,html}`
- Create: `src/app/features/posture-assessment/posture-assessment.page.spec.ts`
- Modify: `src/app/features/measurements/measurements.page.{ts,html}`
- Create: `src/app/features/measurements/measurements.page.spec.ts`
- Modify: `src/app/features/admin/admin.page.{ts,html}`
- Create: `src/app/features/admin/admin.page.spec.ts`
- Modify: `src/index.html`
- Modify: `public/manifest.webmanifest`
- Modify: `public/i18n/en.json`
- Modify: `public/i18n/fa.json`
- Modify: `README.md`

**Interfaces:**

- Completes all app-owned translation namespaces.
- Keeps chart data, API content, measurements, units, IDs, emails, and server errors unchanged.

- [ ] **Step 1: Add failing representative tests**

Cover progress chart labels and empty states, posture-assessment headings/actions, measurement form labels/actions, and admin headings/actions/toasts in both languages. Include assertions that API data points, unit abbreviations, user emails, and server errors remain raw.

- [ ] **Step 2: Migrate Progress copy**

Add `PROGRESS.*` keys for headings, ranges, chart legends, summaries, streaks, personal records, loading/empty states, tooltips, and accessibility. Chart dataset labels should be rebuilt or reactively refreshed when the language changes; numeric data and axes remain unchanged.

- [ ] **Step 3: Migrate posture assessment and measurements copy**

Add `POSTURE_ASSESSMENT.*` and `MEASUREMENTS.*` for headings, explanations, field labels, actions, validation, loading/empty states, and app-owned notifications. Preserve measurement values, API identifiers, unit abbreviations, and server error text.

- [ ] **Step 4: Migrate admin copy**

Add `ADMIN.*` for headings, filters, table headers, actions, statuses, confirmations, pagination/accessibility, and app-owned toasts. Preserve user-provided names/emails, IDs, role codes sent to the API, and server messages.

- [ ] **Step 5: Audit every user-facing literal**

Run:

```bash
rg -n "(['\"])[A-Za-z][^'\"]*\1|>[[:space:]]*[A-Za-z][^<{]*<" src/app --glob '*.ts' --glob '*.html'
```

Classify every result. Convert remaining app-owned interface literals to keys. Leave only code identifiers, routes, CSS classes, API values, developer logs, test fixture data, brand names, and explicitly out-of-scope API content. Run `pnpm check:i18n` after every JSON correction.

- [ ] **Step 6: Document localization maintenance**

Add a README section documenting:

```md
### Interface translations

English and Persian UI copy lives in `public/i18n/en.json` and `public/i18n/fa.json`.
Keep both files structurally identical and run `pnpm check:i18n` after editing either file.
English is the canonical fallback; API-generated content is not localized by the web app.
```

Keep default manifest/name metadata English because a single runtime web manifest cannot reactively switch with the in-app locale in this phase.

- [ ] **Step 7: Run full automated verification**

```bash
pnpm check:i18n
pnpm lint
pnpm test
pnpm build
git diff --check
```

Expected: parity passes with zero differences; lint has zero errors; all tests pass; production build succeeds; diff check is clean.

- [ ] **Step 8: Perform manual browser verification**

Start `pnpm dev`, then inspect every route in English and Persian at desktop and a narrow mobile viewport. Verify:

- language changes immediately and survives reload;
- no English flash occurs after a stored Persian selection;
- document `lang`/`dir` are correct;
- no raw translation keys appear;
- public, authenticated, onboarding, workout, assessment, progress, measurements, settings, and admin screens have no overflow;
- directional arrows mirror, while logos, media, charts, play icons, and numeric sequences do not;
- API exercise text and server messages remain unchanged;
- dark mode works in both directions.

- [ ] **Step 9: Commit final coverage**

```bash
git add src/app/features/progress src/app/features/posture-assessment src/app/features/measurements src/app/features/admin src/index.html public/manifest.webmanifest public/i18n README.md
git commit -m "feat: complete Persian interface localization"
```

---

## Final Review Checklist

- [ ] Map every acceptance criterion in `docs/superpowers/specs/2026-07-13-persian-localization-design.md` to a completed task above.
- [ ] Confirm `pnpm check:i18n`, `pnpm lint`, `pnpm test`, and `pnpm build` all pass from a clean working tree.
- [ ] Confirm no app-owned English literal remains outside `en.json` unless it is intentionally static English metadata.
- [ ] Confirm all Persian translations are natural, consistent, and reviewed in context.
- [ ] Confirm API/AI-provided content has not been passed through translation lookup.
- [ ] Confirm only the selected language preference is persisted; no backend schema change was introduced.
