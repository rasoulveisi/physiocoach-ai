# Assessment No-Scroll UX Design

## Goal

Make the mobile assessment flow usable without required scrolling by showing one question per step, keeping navigation reachable, and letting numeric picker steps advance when the user taps the centered selected value.

## Problem

The assessment flow is stable functionally, but several mobile screens require the user to scroll before the next action is reachable. This is worst on Android-sized screens because the current page stacks a card header, progress indicator, question content, footer actions, generation/cache messaging, and medical disclaimer in one long page.

The current mobile flow is already close to a single-question stepper, but step 10 combines two optional questions:

- Joint pain or physical limitations
- Posture flags

Numeric questions also require a separate Continue action even though the picker already has a clear centered value.

## Approved Direction

Use the center-tap picker interaction for mobile numeric questions.

Dragging, swiping, wheel movement, or arrow-key movement changes the highlighted centered value but does not advance the assessment. When the user taps the centered selected value after the picker is stable, the app treats that tap as confirmation, emits the selected value, saves the current step snapshot through the existing step transition path, and moves to the next step.

For mobile single-select questions, keep the existing tap-to-select-and-advance behavior.

For mobile multi-select questions, keep a reachable action because users may select more than one item. These steps should use compact content and a sticky or otherwise always-visible action area so Continue or Generate Workout Plan is reachable without scrolling.

## Step Model

Mobile assessment becomes 12 steps:

1. Age
2. Biological sex
3. Height
4. Weight
5. Body fat estimate, optional
6. Lifestyle
7. Experience level
8. Training days per week
9. Equipment
10. Physical limitations, optional
11. Posture flags, optional
12. Goals

Desktop can keep the current grouped 4-stage model. The no-scroll requirement is for mobile assessment screens.

## Component Boundaries

### `src/app/shared/ui/number-range-picker.component.ts`

Add a dedicated confirmation output for the centered mobile wheel value. The existing `valueChange` output remains responsible for updating the current value. The existing `done` output may be reused if its semantics stay "confirmed current selected value", but the template should distinguish normal option value changes from center-value confirmation.

Expected behavior:

- Clicking or tapping the centered wheel option confirms the current selection.
- Clicking or tapping non-centered visible options only moves the selection to that option.
- Dragging the wheel changes selection silently during movement and emits `valueChange` at pointer end, matching current behavior.
- Keyboard and desktop select behavior continue to emit `valueChange` only.
- Sheet mode `Done` continues to emit confirmation and close the sheet.

### `src/app/shared/ui/number-range-picker.component.html`

Update the mobile wheel button click behavior:

- `offset === 0`: confirm selected value.
- `offset !== 0`: select that option without confirmation.

The visual center row should continue to communicate that it is the selected value. Add a compact hint reading "Tap centered value to continue" for mobile onboarding numeric steps. The hint must fit within the numeric step without forcing scroll.

### `src/app/features/onboarding/onboarding.page.ts`

Add mobile numeric confirmation handlers that update the relevant store field and then call the existing step advancement path. Required numeric fields should use the same validation gates already used by `canAdvanceStep`.

The handler should preserve current snapshot behavior by going through `nextStep()` after updating the value, instead of duplicating save and navigation logic.

Step counting should use one source of truth, for example `mobileStepCount = 12`, so the progress label and progress bar do not hard-code `11`.

Update mobile step gating:

- Step 10, limitations, is optional and can always advance.
- Step 11, posture flags, is optional and can always advance.
- Step 12, goals, requires at least one goal.

Keep the desktop stage mapping functionally unchanged. Desktop should still show equipment, limitations, and posture flags in the same grouped stage.

### `src/app/features/onboarding/onboarding.page.html`

Split the current mobile step 10 into two mobile-only steps:

- Step 10: physical limitations
- Step 11: posture flags

Move goals to mobile step 12.

For mobile numeric picker steps, wire the picker confirmation output to the new mobile numeric confirmation handler. Hide the normal mobile Continue button on numeric steps because the centered picker value is the action. Keep Back available from step 2 onward.

Compact the mobile assessment shell:

- Keep the progress indicator visible and short.
- Reduce excess card/header spacing on mobile.
- Avoid showing the medical disclaimer inside the active mobile question area. It can remain on desktop or be moved below the mobile flow where it does not affect the primary action reachability.
- Avoid showing cache status messaging inside the goals step on mobile unless there is a generation-relevant warning. It should not push Generate Workout Plan below the fold.

## Error Handling

Invalid numeric values should not advance. This uses the existing per-step validation checks. If a number picker emits a value outside its configured range, the current clamping behavior should normalize it before the onboarding handler advances.

Submission errors remain unchanged and should appear after the final Generate Workout Plan action.

## Testing

Add or update tests in `src/app/features/onboarding/onboarding.page.spec.ts`:

- Mobile numeric confirmation on age advances from step 1 to step 2.
- Mobile numeric `valueChange` alone updates the store but does not advance.
- Mobile step count displays 12 steps.
- Mobile step 10 shows only limitations.
- Mobile step 11 shows only posture flags.
- Mobile step 12 shows goals and requires at least one goal.
- Back button is available from steps 2 through 12.

Create `src/app/shared/ui/number-range-picker.component.spec.ts` if no picker spec exists, and cover:

- Center mobile option click emits the confirmation output.
- Non-center mobile option click emits only `valueChange`.
- Pointer drag does not emit confirmation.

## Acceptance Criteria

- On Android-sized screens, numeric assessment steps do not require scrolling to reach Continue because there is no Continue button on those steps.
- Tapping the centered numeric picker value confirms and advances.
- Multi-select assessment steps have a reachable Continue or Generate action.
- Each mobile assessment step asks one question only.
- Progress label reads `Question N of 12` on mobile.
- Desktop grouped assessment behavior remains functionally unchanged.
