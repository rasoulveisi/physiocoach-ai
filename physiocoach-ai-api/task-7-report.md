# Task 7 — Safe workout candidate clustering

Implemented catalog safety clustering before workout AI generation.

- Loads exercises only from the active catalog version with an approved, complete safety profile.
- Joins the selected user consideration code and exact severity to the safety matrix.
- Partitions candidates into green, amber, and red using the strictest matched rating.
- Removes red candidates before prompt construction; presents amber candidates separately with reasons and required modifications.
- Enforces one amber candidate per day, rejects selected red IDs, and adds omitted required modifications to exercise notes.
- Stops generation with `insufficient_safe_candidates` when safety exclusions leave inadequate safe coverage.

Verification run:

```text
corepack pnpm vitest run tests/exercise-candidate-clusterer.test.ts tests/workout-plan-fresh-generation.test.ts tests/ai-orchestrator.test.ts tests/safety.test.ts
47 passed
corepack pnpm build
corepack pnpm lint
```

## Corrective follow-up

The catalog hydration boundary is fail-closed: AI exercise names are resolved against the full
candidate set before safety checks, red matches are rejected even without an ID, and unmatched
name-only output fails catalog validation instead of becoming a custom exercise. Required movement
patterns are retained before safety filtering; if red candidates eliminate safe coverage for a
required pattern, generation fails with `insufficient_safe_candidates`.
