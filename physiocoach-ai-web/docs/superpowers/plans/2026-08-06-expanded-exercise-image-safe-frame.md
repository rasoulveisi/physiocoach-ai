# Expanded Exercise Image Safe Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give expanded workout-plan exercise images an adaptive, padded, contained stage while preserving compact thumbnails and all source assets.

**Architecture:** The shared `ExerciseVisualComponent` will own all image-stage geometry based on its existing `compact` input. The workout-plan page will remain responsible only for the outer card layout and will stop imposing a second expanded aspect ratio.

**Tech Stack:** Angular 21 standalone components, signal inputs, Tailwind CSS 3, Angular TestBed, Vitest.

## Global Constraints

- Apply the change only to expanded workout-plan exercise cards.
- Use `4:3` by default, `3:2` from the `sm` breakpoint, and `16:9` from the `lg` breakpoint.
- Use `object-fit: contain`, centered alignment, `0.5rem` default padding, and `0.75rem` padding from `sm`.
- Preserve compact thumbnails at exactly `56px × 56px`.
- Do not modify anything under `public/images/`.
- Do not create a Git worktree; workspace instructions require explicit approval and none was requested for this task.
- Do not change backend or API code.

---

### Task 1: Protect expanded and compact stage behavior with component tests

**Files:**

- Create: `src/app/shared/ui/exercise-visual.component.spec.ts`
- Test: `src/app/shared/ui/exercise-visual.component.spec.ts`

**Interfaces:**

- Consumes: `ExerciseVisualComponent` and its existing `compact: InputSignal<boolean>` input.
- Produces: Regression coverage for the rendered stage classes and component-host width behavior.

- [ ] **Step 1: Write the failing component tests**

```typescript
import { TestBed } from '@angular/core/testing';

import { ExerciseVisualComponent } from './exercise-visual.component';

describe('ExerciseVisualComponent', () => {
  function render(compact: boolean): { host: HTMLElement; stage: HTMLElement } {
    const fixture = TestBed.createComponent(ExerciseVisualComponent);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const stage = host.querySelector('figure[data-exercise-visual] > div');
    expect(stage).not.toBeNull();

    return { host, stage: stage as HTMLElement };
  }

  it('renders an adaptive padded safe frame when expanded', () => {
    const { host, stage } = render(false);

    expect(host.classList).toContain('block');
    expect(host.classList).toContain('min-w-0');
    expect(stage.classList).toContain('aspect-[4/3]');
    expect(stage.classList).toContain('sm:aspect-[3/2]');
    expect(stage.classList).toContain('lg:aspect-[16/9]');
    expect(stage.classList).toContain('p-2');
    expect(stage.classList).toContain('sm:p-3');
  });

  it('keeps the compact stage at 56 pixels without expanded safe-frame classes', () => {
    const { stage } = render(true);

    expect(stage.classList).toContain('h-14');
    expect(stage.classList).toContain('w-14');
    expect(stage.classList).not.toContain('aspect-[4/3]');
    expect(stage.classList).not.toContain('p-2');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test -- --include src/app/shared/ui/exercise-visual.component.spec.ts
```

Expected: FAIL because the component host lacks `block min-w-0` and the expanded stage still has only the fixed `aspect-[16/9]` class without safe padding.

---

### Task 2: Implement the single-owner adaptive stage

**Files:**

- Modify: `src/app/shared/ui/exercise-visual.component.ts:9-14,24`
- Modify: `src/app/shared/ui/exercise-visual.component.html:1-8`
- Modify: `src/app/features/workout-plan/workout-plan.page.html:151-158`
- Test: `src/app/shared/ui/exercise-visual.component.spec.ts`

**Interfaces:**

- Consumes: `compact: InputSignal<boolean>`.
- Produces: `stageClasses: Signal<string>` rendered on the visual stage; non-compact output receives responsive ratios and padding, compact output remains `h-14 w-14`.

- [ ] **Step 1: Add the component host contract and derived stage classes**

In `ExerciseVisualComponent` metadata, add:

```typescript
host: {
  class: 'block min-w-0',
},
```

After `mediaFailed`, add:

```typescript
protected readonly stageClasses = computed(() =>
  this.compact()
    ? 'h-14 w-14'
    : 'min-h-44 aspect-[4/3] p-2 sm:aspect-[3/2] sm:p-3 lg:aspect-[16/9]',
);
```

- [ ] **Step 2: Make the template consume the single stage-class contract**

Keep the stage's existing base classes and replace its four individual height/width/aspect bindings with:

```html
[class]="stageClasses()"
```

Do not change the image's `h-full w-full object-contain` classes or any accessibility/loading attributes.

- [ ] **Step 3: Remove the duplicate expanded aspect ratio from the workout-plan wrapper**

Delete only:

```html
[class.aspect-[16/9]]="isExerciseExpanded(dayIndex, exerciseIndex)"
```

Keep the wrapper's compact `h-14` and `w-14` bindings and expanded `w-full` binding.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm test -- --include src/app/shared/ui/exercise-visual.component.spec.ts
```

Expected: both tests PASS with zero failures.

---

### Task 3: Verify the complete frontend and scope boundaries

**Files:**

- Review: `src/app/shared/ui/exercise-visual.component.ts`
- Review: `src/app/shared/ui/exercise-visual.component.html`
- Review: `src/app/features/workout-plan/workout-plan.page.html`
- Review: `src/app/shared/ui/exercise-visual.component.spec.ts`

**Interfaces:**

- Consumes: the completed layout behavior from Tasks 1 and 2.
- Produces: evidence that lint, the full test suite, and the production build pass and that image assets remain untouched.

- [ ] **Step 1: Run required frontend validation**

Run:

```bash
pnpm validate
```

Expected: lint exits 0, all Angular/Vitest tests pass, and the production build exits 0.

- [ ] **Step 2: Review the scoped diff**

Run:

```bash
git status --short
git diff --check
git diff -- src/app/shared/ui/exercise-visual.component.ts src/app/shared/ui/exercise-visual.component.html src/app/features/workout-plan/workout-plan.page.html src/app/shared/ui/exercise-visual.component.spec.ts
git diff --name-only -- public/images
```

Expected: no whitespace errors, only the intended source/test/docs files are changed, and `git diff --name-only -- public/images` prints nothing.

- [ ] **Step 3: Leave the verified changes uncommitted for user review**

Do not commit, push, deploy, or create a pull request. The user did not request any of those operations.
