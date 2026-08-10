# Assessment No-Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mobile assessment steps usable without required scrolling by splitting combined questions and making centered numeric picker taps confirm and advance.

**Architecture:** Keep the existing Angular standalone components. Extend `NumberRangePickerComponent` with an explicit centered-value confirmation path, then wire onboarding mobile numeric steps to confirm-and-advance through the existing `nextStep()` flow. Keep desktop grouped onboarding behavior unchanged.

**Tech Stack:** Angular 21 standalone components, Angular signals, PrimeNG, Vitest, pnpm.

---

## File Structure

- Modify `src/app/shared/ui/number-range-picker.component.ts`: add compact hint input and distinguish mobile center confirmation from value changes.
- Modify `src/app/shared/ui/number-range-picker.component.html`: make center wheel tap emit confirmation and non-center tap only select.
- Create `src/app/shared/ui/number-range-picker.component.spec.ts`: cover confirmation, non-center selection, and drag behavior.
- Modify `src/app/features/onboarding/onboarding.page.ts`: add `mobileStepCount`, numeric confirmation handlers, mobile gating for 12 steps, and save snapshot ranges.
- Modify `src/app/features/onboarding/onboarding.page.html`: use 12-step mobile progress, split limitations/posture, hide numeric Continue buttons, wire picker confirmation, and compact mobile-only heavy messaging.
- Modify `src/app/features/onboarding/onboarding.page.spec.ts`: cover 12 mobile steps and mobile numeric confirmation behavior.

---

### Task 1: Number Picker Confirmation Contract

**Files:**
- Modify: `src/app/shared/ui/number-range-picker.component.ts`
- Modify: `src/app/shared/ui/number-range-picker.component.html`
- Create: `src/app/shared/ui/number-range-picker.component.spec.ts`

- [ ] **Step 1: Write picker tests**

Create `src/app/shared/ui/number-range-picker.component.spec.ts` with tests that mount the standalone component, force mobile layout by using the wheel buttons, subscribe to `valueChange` and `done`, and verify:

```ts
it('emits done when the centered wheel value is clicked', () => {
  // Set value 34, click button[data-offset="0"], expect done 34.
});

it('emits only valueChange when a non-centered wheel value is clicked', () => {
  // Set value 34, click button[data-offset="1"], expect valueChange 35 and no done.
});

it('does not emit done after pointer drag', () => {
  // Dispatch pointerdown, pointermove beyond threshold, pointerup on [data-action="number-wheel"], expect valueChange and no done.
});
```

- [ ] **Step 2: Run picker tests to verify they fail**

Run:

```bash
pnpm test -- src/app/shared/ui/number-range-picker.component.spec.ts
```

Expected: at least the center confirmation and non-center behavior tests fail because the current template calls `onValueSelect()` for every visible wheel option.

- [ ] **Step 3: Implement picker confirmation**

In `number-range-picker.component.ts`:

- Add `readonly confirmHint = input<string | null>(null);`
- Add `protected onWheelOptionClick(slot: NumberPickerSlot): void`:
  - return if `slot.option === null`
  - if `slot.offset === 0`, call `onDone()`
  - otherwise call `onValueSelect(slot.option.value)`

In `number-range-picker.component.html`:

- Change wheel option click binding to `(click)="onWheelOptionClick(slot)"`
- Add compact hint rendering below the wheel:

```html
@if (confirmHint(); as hint) {
  <p class="text-center text-xs font-medium text-slate-500 dark:text-slate-400">{{ hint }}</p>
}
```

- [ ] **Step 4: Run picker tests to verify they pass**

Run:

```bash
pnpm test -- src/app/shared/ui/number-range-picker.component.spec.ts
```

Expected: new picker tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/shared/ui/number-range-picker.component.ts src/app/shared/ui/number-range-picker.component.html src/app/shared/ui/number-range-picker.component.spec.ts
git commit -m "feat(onboarding): confirm centered number picker value"
```

---

### Task 2: Mobile Onboarding Twelve-Step Flow

**Files:**
- Modify: `src/app/features/onboarding/onboarding.page.ts`
- Modify: `src/app/features/onboarding/onboarding.page.html`
- Modify: `src/app/features/onboarding/onboarding.page.spec.ts`

- [ ] **Step 1: Write onboarding tests**

Update `src/app/features/onboarding/onboarding.page.spec.ts` to verify:

```ts
it('shows twelve mobile assessment steps', async () => {
  setViewportWidth(390);
  const { fixture } = await mount();
  expect(fixture.nativeElement.textContent).toContain('Question 1 of 12');
});

it('keeps mobile valueChange local and advances only on numeric confirmation', async () => {
  setViewportWidth(390);
  const { fixture, store } = await mount();
  const component = fixture.componentInstance as unknown as ComponentAccessor;
  selectPickerValue(fixture, 'age', 35);
  expect(store.state().age).toBe(35);
  expect(component.currentStep()).toBe(1);
  confirmPickerValue(fixture, 'age', 36);
  expect(store.state().age).toBe(36);
  expect(component.currentStep()).toBe(2);
});

it('splits mobile limitations, posture flags, and goals into separate steps', async () => {
  setViewportWidth(390);
  const { fixture } = await mount();
  const component = fixture.componentInstance as unknown as ComponentAccessor;
  component.currentStep.set(10);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Any joint pain or physical limitations?');
  expect(fixture.nativeElement.textContent).not.toContain('Select any posture flags');
  component.currentStep.set(11);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('Select any posture flags');
  expect(fixture.nativeElement.textContent).not.toContain('What are your main fitness goals?');
  component.currentStep.set(12);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('What are your main fitness goals?');
});
```

Add a helper `confirmPickerValue()` that finds `NumberRangePickerComponent` by `data-field` and emits its `done` output.

- [ ] **Step 2: Run onboarding tests to verify they fail**

Run:

```bash
pnpm test -- src/app/features/onboarding/onboarding.page.spec.ts
```

Expected: tests fail because the current mobile flow has 11 steps, numeric `done` is not wired, and limitations/posture are combined.

- [ ] **Step 3: Implement twelve-step mobile flow**

In `onboarding.page.ts`:

- Add `protected readonly mobileStepCount = 12;`
- Add `protected isNumericMobileStep(step = this.currentStep()): boolean` returning `true` for steps `1`, `3`, `4`, `5`, and `8`.
- Add `protected confirmNumberAndAdvance(field: 'age' | 'heightCm' | 'weightKg' | 'frequencyDays', value: number | undefined): void` that calls `updateNumber(field, value)` then `nextStep()`.
- Add `protected confirmOptionalNumberAndAdvance(field: 'bodyFatEstimate', value: number | undefined): void` that calls `updateOptionalNumber(field, value)` then `nextStep()`.
- Update `canAdvanceStep` so step `10` and step `11` return `true`, step `12` checks `goalsError() === null`, and no mobile case references old step 11 goals.
- Update `nextStep()` mobile branch to advance while `currentStep() < this.mobileStepCount`.
- Update `saveCurrentStepSnapshot()` mobile assessment range to `step >= 8 && step <= 11`.

In `onboarding.page.html`:

- Replace hard-coded `11` in mobile progress text and width with `mobileStepCount`.
- Add `[confirmHint]="'Tap centered value to continue'"` and `(done)="confirmNumberAndAdvance(...)"` or `(done)="confirmOptionalNumberAndAdvance(...)"` to mobile numeric pickers only.
- Split mobile step 10 into limitations only.
- Add mobile step 11 for posture flags only.
- Move mobile goals to step 12.
- Hide mobile Continue button on numeric steps by using `isNumericMobileStep(currentStep())`.
- Generate plan button appears on step 12.
- Keep desktop grouped blocks unchanged.

- [ ] **Step 4: Run onboarding tests**

Run:

```bash
pnpm test -- src/app/features/onboarding/onboarding.page.spec.ts
```

Expected: onboarding tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/features/onboarding/onboarding.page.ts src/app/features/onboarding/onboarding.page.html src/app/features/onboarding/onboarding.page.spec.ts
git commit -m "feat(onboarding): split mobile assessment steps"
```

---

### Task 3: Final Verification and No-Scroll Polish

**Files:**
- Inspect: `src/app/features/onboarding/onboarding.page.html`
- Inspect: `src/app/shared/ui/number-range-picker.component.html`
- Modify only when a verification command fails or an acceptance criterion is objectively unmet: `src/app/features/onboarding/onboarding.page.html`
- Modify only when a verification command fails or an acceptance criterion is objectively unmet: `src/app/shared/ui/number-range-picker.component.html`

- [ ] **Step 1: Run full tests**

Run:

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: lint passes with no new errors.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm build
```

Expected: production build completes.

- [ ] **Step 4: Inspect mobile layout classes**

Verify the final template satisfies the UX constraints:

- Numeric mobile steps have no `Continue` button.
- Mobile progress reads `Question N of 12`.
- Step 10 and 11 are separate mobile-only questions.
- Goals step does not include the cache status panel on mobile.
- Medical disclaimer is hidden on mobile assessment flow or otherwise cannot push the primary action below the fold.

- [ ] **Step 5: Commit fixes if any**

If verification or layout polish required changes, commit them:

```bash
git add src/app/features/onboarding/onboarding.page.html src/app/shared/ui/number-range-picker.component.html
git commit -m "fix(onboarding): keep mobile assessment actions reachable"
```

If no files changed after verification, do not create an empty commit.
