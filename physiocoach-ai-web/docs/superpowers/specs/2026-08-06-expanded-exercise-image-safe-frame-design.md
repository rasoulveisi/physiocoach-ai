# Expanded Exercise Image Safe Frame Design

## Goal

Keep exercise visuals fully contained and comfortably framed when a workout-plan exercise card is expanded, without changing source images or compact thumbnails.

## Current Behavior and Root Cause

The workout-plan page gives the expanded image wrapper a fixed `16:9` aspect ratio. The shared exercise visual then creates a second independent `16:9` stage inside that wrapper. Both layers hide overflow. This duplicated sizing prevents the image stage from adapting to narrower screens and leaves no deliberate safe spacing around edge-to-edge exercise artwork.

The media element already uses `object-fit: contain`; the problem is the expanded card's surrounding presentation contract rather than image resolution or image selection.

## Approved Behavior

- Apply the change only when a workout-plan exercise card is expanded.
- Use a responsive stage ratio:
  - `4:3` by default for narrow/mobile screens.
  - `3:2` from the small breakpoint.
  - `16:9` from the large breakpoint.
- Center the image and continue using `object-fit: contain`.
- Add `0.5rem` safe padding by default and `0.75rem` from the small breakpoint.
- Let the shared exercise visual own the expanded stage ratio and padding.
- Remove the expanded aspect-ratio rule from the workout-plan wrapper so only one component controls stage geometry.
- Preserve the existing `56px × 56px` compact thumbnail exactly.
- Do not modify, regenerate, crop, or replace any exercise image asset.

## Component Changes

### Shared exercise visual

`ExerciseVisualComponent` will derive the stage utility classes from its existing `compact` input:

- Compact: `h-14 w-14`.
- Expanded/non-compact: `aspect-[4/3] p-2 sm:aspect-[3/2] sm:p-3 lg:aspect-[16/9]`.

The component host will be a block-level, minimum-width-safe element so its figure consistently fills the workout-plan card width. The image remains `h-full w-full object-contain`.

### Workout-plan card

The outer image frame will retain width, rounding, background, and overflow containment. It will no longer set an expanded `16:9` ratio. Compact height and width bindings remain unchanged.

## Accessibility and Loading

Existing alternative text, lazy loading, loading skeleton, error handling, and attribution behavior remain unchanged. Safe padding belongs to the visual stage and therefore applies equally during image loading without introducing layout shift within a selected breakpoint.

## Verification

- Add a focused component test that renders `ExerciseVisualComponent` in non-compact mode and verifies the adaptive safe-frame classes are present.
- In the same test suite, render compact mode and verify it keeps `h-14 w-14` without expanded ratio or padding classes.
- Run the focused test through Angular's Vitest runner.
- Run `pnpm validate` as required by the workspace instructions, covering lint, all tests, and production build.
- Review the final diff to confirm no files under `public/images/` changed.

## Out of Scope

- Editing or regenerating exercise media.
- Changing collapsed-card thumbnail presentation.
- Changing exercise metadata, card content, or expansion behavior.
- Backend or API changes.
