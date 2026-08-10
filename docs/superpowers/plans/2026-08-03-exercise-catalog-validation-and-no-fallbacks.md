# Exercise Catalog Validation and No-Fallback Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ensure every generated-plan exercise comes from the analyzed catalog, carries a stable catalog identity and advisory condition flags, renders only its correct PhysioCoach-owned image, and is hidden if an invalid exercise reaches the web client.

**Architecture:** The API remains the source of truth: import, derive attributes, analyze condition suitability, and validate candidates before plan generation. Flags are advisory metadata and never block generation; the API excludes unsuitable candidates before generation and records the flags used for the user profile. The web client consumes the stable exercise ID and owned image URL, removes all visual/plan fallbacks, logs invalid records, and hides invalid exercises.

**Tech Stack:** Cloudflare/API TypeScript services and tests; Angular 21, TypeScript, Vitest, and the existing PhysioCoach-owned WebP catalog.

## Global Constraints

- Modify both `/Users/rasoul/rasoul/PhysioCoach Ai/physiocoach-ai-api` and `/Users/rasoul/rasoul/PhysioCoach Ai/physiocoach-ai-web`.
- Do not regenerate images or add image validation to the runtime pipeline.
- Do not use external, generic, SVG, pattern, muscle-group, or global image fallbacks.
- Do not block plan generation because an exercise has advisory flags.
- Invalid or missing exercise records must never be rendered; log them and omit them.
- Preserve stable source IDs, catalog safety behavior, and existing catalog activation/rollback semantics.
- No exercise should reach generation without completed catalog analysis and suitability metadata.

## Task 1: Establish the API catalog contract and validation boundary

**Files:**
- Inspect/modify: `physiocoach-ai-api/src/types/exercise-catalog.ts`
- Inspect/modify: `physiocoach-ai-api/src/types/exercise-safety-catalog.ts`
- Inspect/modify: `physiocoach-ai-api/src/types/workout-plan-contract.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/plan-validator.ts`
- Test: `physiocoach-ai-api/tests/exercise-catalog-schema.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-safety-schema.test.ts`
- Test: `physiocoach-ai-api/tests/schemas/workout-plan.schema.test.ts`

**Interfaces:**
- Produce a required plan-exercise identity contract containing `masterExerciseId`, canonical `name`, `movementPattern`, `muscleGroup`, and catalog analysis metadata.
- Produce an explicit advisory flag shape for condition suitability, including condition key, severity/category, reason, and source/version of the analysis.
- Preserve existing `redFlags` and safety response fields; do not convert advisory flags into generation-blocking errors.

- [ ] Write schema tests proving a generated exercise must contain a stable catalog ID and analyzed metadata.
- [ ] Write schema tests proving advisory flags serialize in a stable shape and do not make the plan invalid.
- [ ] Write validator tests proving missing IDs, unknown catalog IDs, and unanalyzed exercises are rejected from the candidate set.
- [ ] Implement the smallest contract and validator changes needed to enforce those invariants at the API boundary.
- [ ] Run the three API schema/validator test files and confirm the new failures are limited to the intended contract changes.

## Task 2: Make dataset import and catalog analysis authoritative

**Files:**
- Inspect/modify: `physiocoach-ai-api/src/services/exercise-dataset-mapper.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/exercise-attribute-deriver.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/exercise-safety-analyzer.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/exercise-safety-rules.ts`
- Inspect/modify: `physiocoach-ai-api/scripts/analyze-exercise-safety.mjs`
- Inspect/modify: `physiocoach-ai-api/scripts/import-exercises-dataset.mjs`
- Test: `physiocoach-ai-api/tests/import-exercises-dataset.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-dataset-mapper.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-attribute-deriver.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-safety-analyzer.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-safety-rules.test.ts`

**Interfaces:**
- Consume the canonical dataset records from `seed-input/exercises.json`.
- Produce one stable catalog record per source exercise with derived attributes, analysis version, analysis status, and condition suitability flags.

- [ ] Add tests for knee, neck, lower-back, impact, overhead, deep-flexion, explosive, rotational, balance, and spinal-load cases using the existing condition vocabulary.
- [ ] Add tests proving incomplete or ambiguous records are marked unanalyzed and cannot be activated.
- [ ] Implement deterministic analysis from structured catalog attributes and existing safety rules; do not infer safety at plan-render time.
- [ ] Ensure the import/analyze workflow persists the analysis version and reviewed/derived status with each exercise.
- [ ] Ensure duplicate/source-ID handling preserves the existing source ID mapping.
- [ ] Run the complete dataset import, mapper, attribute, safety analyzer, and safety rule test set.

## Task 3: Filter candidates before AI/fallback plan construction without blocking on advisory flags

**Files:**
- Inspect/modify: `physiocoach-ai-api/src/routes/workout-plans.ts`
- Inspect/modify: `physiocoach-ai-api/src/routes/workout-plans.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/plan-validator.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/exercise-matching.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/catalog-activation.ts`
- Test: `physiocoach-ai-api/tests/workout-plan-fresh-generation.test.ts`
- Test: `physiocoach-ai-api/tests/workout-plan-persistence.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-matching.test.ts`
- Test: `physiocoach-ai-api/tests/catalog-activation.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-catalog-workflow.integration.test.ts`

**Interfaces:**
- Consume the user’s condition/profile inputs and the active analyzed catalog.
- Produce a candidate pool containing only analyzed, active, catalog-identified exercises; attach advisory flags to returned exercises where applicable.

- [ ] Add integration tests proving unsuitable knee/neck exercises are absent from the candidate pool while other flagged-but-allowed exercises remain eligible.
- [ ] Add tests proving advisory flags do not produce a 409 or otherwise block generation.
- [ ] Add tests proving every generated exercise retains its catalog ID and analysis metadata through normalization, persistence, and reload.
- [ ] Move filtering ahead of both AI candidate selection and deterministic fallback-plan construction.
- [ ] Ensure empty candidate pools produce an explicit API error with structured logging rather than silently inventing an exercise.
- [ ] Preserve existing admin catalog activation, rollback, red-exercise, and safety coverage behavior.
- [ ] Run the API integration and generation test suite.

## Task 4: Remove API-side exercise/image fallback behavior and add operational logging

**Files:**
- Inspect/modify: `physiocoach-ai-api/src/routes/exercise-catalog.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/exercise-matching.ts`
- Inspect/modify: `physiocoach-ai-api/src/services/plan-validator.ts`
- Inspect/modify: `physiocoach-ai-api/src/types/exercise-catalog.ts`
- Test: `physiocoach-ai-api/tests/exercise-catalog-routes.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-catalog-runbook.test.ts`
- Test: `physiocoach-ai-api/tests/exercise-matching.test.ts`

**Interfaces:**
- Produce only catalog-owned media metadata for catalog exercises; no generic visual URL, pattern image, name-only substitution, or external runtime fallback.
- Produce structured log events for rejected/omitted exercises containing safe IDs, reason codes, catalog version, and analysis version.

- [ ] Add route tests proving catalog media lookup is keyed by stable exercise ID when available.
- [ ] Add tests proving unknown or missing exercise IDs return no media and are logged rather than substituted.
- [ ] Replace fallback matching with explicit invalid-result handling while preserving authorized external media precedence only where the existing product contract explicitly requires it.
- [ ] Add runbook examples for invalid identity, unanalyzed catalog records, unsuitable-condition filtering, and empty candidate pools.
- [ ] Run route, matching, and runbook tests.

## Task 5: Make the web plan contract and normalization strict

**Files:**
- Modify: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.model.ts`
- Modify: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.store.ts`
- Modify: `physiocoach-ai-web/src/app/features/workout-session/workout-session.model.ts`
- Modify: `physiocoach-ai-web/src/app/features/workout-session/workout-session.page.ts`
- Test: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.store.spec.ts`
- Test: `physiocoach-ai-web/src/app/features/workout-session/workout-session.page.spec.ts`

**Interfaces:**
- Consume API plan exercises with required `masterExerciseId` and analysis metadata.
- Produce normalized view models only for valid exercises; invalid records are logged and omitted from days/session groups.

- [ ] Add tests for valid catalog exercises, missing IDs, malformed IDs, and unknown IDs.
- [ ] Add tests proving invalid exercises are hidden rather than replaced with a fallback exercise or placeholder.
- [ ] Add tests proving advisory suitability flags remain available to the UI and do not block rendering of valid exercises.
- [ ] Implement a single strict normalization helper used by plan and session flows.
- [ ] Log one structured warning per omitted exercise with a deduplication key to avoid repeated error noise during change detection.
- [ ] Run the focused web plan/session tests.

## Task 6: Replace the visual resolver fallback tree with strict owned-image resolution

**Files:**
- Modify: `physiocoach-ai-web/src/app/shared/ui/exercise-image-resolver.ts`
- Modify: `physiocoach-ai-web/src/app/shared/ui/exercise-visual-resolver.ts`
- Modify: `physiocoach-ai-web/src/app/shared/ui/exercise-visual.component.ts`
- Modify: `physiocoach-ai-web/src/app/shared/ui/exercise-visual.component.html`
- Test: `physiocoach-ai-web/src/app/shared/ui/exercise-image-resolver.spec.ts`
- Test: `physiocoach-ai-web/src/app/shared/ui/exercise-visual-resolver.spec.ts`

**Interfaces:**
- Consume a valid catalog exercise ID.
- Produce exactly `/images/exercises/catalog/{sourceId}.webp` for valid catalog IDs, or an invalid result that the parent hides; never produce an SVG, pattern, muscle, generic, or global fallback.

- [ ] Replace tests that expect generic/curated image fallback with tests expecting an invalid result for unsupported or malformed catalog identities.
- [ ] Add representative resolver tests for `0001`, `1459`, `2808`, and `3785`.
- [ ] Remove fallback image-map branches from the plan/session visual path; retain no runtime visual fallback.
- [ ] Make image load errors log the exercise ID and hide the visual/card according to the parent’s invalid-record policy.
- [ ] Keep external catalog media precedence only for explicitly valid API media records; do not silently replace missing owned images.
- [ ] Run the focused resolver and component tests.

## Task 7: Expose advisory flags without making them generation blockers

**Files:**
- Modify: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.page.html`
- Modify: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.page.ts`
- Modify: `physiocoach-ai-web/src/app/features/workout-session/workout-session.page.html`
- Modify: `physiocoach-ai-web/src/app/features/workout-session/workout-session.page.ts`
- Test: `physiocoach-ai-web/src/app/features/workout-plan/workout-plan.page.spec.ts`
- Test: `physiocoach-ai-web/src/app/features/workout-session/workout-session.page.spec.ts`

**Interfaces:**
- Consume advisory condition flags attached to valid plan exercises.
- Produce clear, non-blocking flag labels/details while omitting invalid exercise records.

- [ ] Add UI tests proving a knee/neck suitability flag is visible as an advisory message on a valid exercise.
- [ ] Add UI tests proving flagged exercises remain in the plan when the API permits them.
- [ ] Add UI tests proving invalid records and failed image records are absent from rendered cards.
- [ ] Implement the smallest accessible display for flags, preserving existing safety disclaimer and guidance text.
- [ ] Ensure no client-side filtering changes the API’s approved plan; the client only hides invalid records and displays flags.
- [ ] Run focused plan/session component tests.

## Task 8: End-to-end verification and operational handoff

**Files:**
- Modify: `physiocoach-ai-api/docs/exercise-catalog-operations.md`
- Modify: `physiocoach-ai-web/docs/deployment.md`
- Test/command: both repositories’ validation and smoke scripts

- [ ] Run the API catalog analysis/import verification against the complete dataset and record counts for total, analyzed, approved, flagged, omitted, and invalid records.
- [ ] Generate representative plans for knee and neck scenarios and verify unsuitable exercises are filtered before generation, advisory flags remain non-blocking, and every returned exercise has a stable ID.
- [ ] Verify representative images `0001`, `1459`, `2808`, and `3785` render in plan and session contexts.
- [ ] Verify invalid records are logged and hidden without any fallback visual or replacement exercise.
- [ ] Run API tests, web tests, lint, production build, and the documented smoke checks.
- [ ] Confirm the only expected logs are structured validation/omission events and no repeated browser 404s or fallback warnings occur.
- [ ] Review the final diff across both repositories and confirm no image assets were regenerated.

## Decisions Applied

- “Flagged” means pre-validation metadata describing whether an exercise is appropriate for conditions such as knee or neck problems; flags are advisory and do not block generation.
- Filtering happens before plan generation, using the analyzed API catalog and user condition/profile data.
- Missing/invalid exercises are considered a defect to prevent upstream; if one reaches the client, it is logged and hidden.
- Runtime image validation is out of scope; correctness comes from the catalog ID-to-owned-WebP contract.
- All image and plan fallbacks are removed from the relevant paths.
- Provider/model retry fallback may remain as infrastructure resilience, but it must never introduce non-catalog exercises, omit required IDs, or substitute plan content.

## Branch Audit: `dev` versus `prod`

The `dev` branches were inspected in both repositories before planning execution.

### API work already present on `dev`

- `src/services/workout-generator.ts` already builds a catalog-backed candidate pool.
- Candidate filtering already considers experience level, equipment, and `excludedLimitations`.
- `src/services/plan-validator.ts` already recognizes `knee_pain`, `lower_back_pain`, and `neck_pain`, and removes risky plan patterns.
- The generator already validates returned exercise IDs against the approved candidate pool in `validatePlanCatalogMembership`.
- `src/types/exercise-catalog.ts` already has stable catalog IDs, movement patterns, equipment/muscle links, and `excludedLimitations`.
- Existing API tests already cover catalog matching, safety analysis, catalog activation, and plan generation.

### API gaps that remain on `dev`

- `masterExerciseId` is still optional in parts of the generator/contract, and unmapped exercises are explicitly accepted as custom exercises.
- Suitability is represented mainly as exclusion lists and plan corrections; the requested per-exercise pre-validation/analysis metadata is not yet a complete required contract.
- The generator still contains model fallback behavior and fallback-plan terminology; this plan’s “no fallbacks” requirement must be applied only to exercise selection/plan content as agreed, without accidentally removing provider retry behavior unless separately approved.
- Name matching remains available after ID lookup; it must not be allowed to create a plan exercise without a valid catalog ID.

### Web work already present on `dev`

- The dev visual path is the older fallback implementation: name maps, pattern/muscle fallbacks, curated SVG animations, and generic animations.
- The owned WebP catalog/resolver work is on `prod`, not on `dev`.
- Therefore, the web implementation should be based on the current `prod` WebP implementation and then made strict; dev should not be merged wholesale over it.

### Planning consequence

Tasks 1–4 are now primarily hardening and contract completion in the API, not greenfield catalog filtering. Tasks 5–7 remain required in the web repository to make the current `prod` visual path strict, hide invalid records, and remove fallback rendering. The existing API tests should be extended rather than duplicated.

## Combined-Branch Integration Strategy

The implementation will combine compatible work selectively rather than merging one branch over the other:

1. Keep the `prod` web visual pack and WebP resolver as the source of truth for runtime visuals.
2. Bring the useful `dev` API candidate filtering, limitation handling, catalog membership checks, and safety tests into the production API path.
3. Tighten the API contract so name matching can help select an existing catalog candidate, but can never produce a plan exercise without that candidate’s stable ID and analyzed metadata.
4. Keep provider/model retries when they only retry generation infrastructure. Every retry must use the same analyzed candidate pool and must pass the same catalog validation.
5. Remove exercise-level fallbacks: no custom/unmapped plan exercises, generic substitutes, pattern/muscle images, SVG animations, placeholder images, or silently repaired exercise identities.
6. Return structured generation diagnostics when the approved candidate pool is empty or output validation fails; do not invent a replacement exercise to make generation appear successful.
7. Add cross-repository integration tests proving that a plan generated through either the primary model or a provider retry has identical catalog identity, filtering, analysis metadata, and image resolution behavior.
