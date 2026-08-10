# Task 8 report: executable catalog rollout artifacts

Implemented release-review corrections for catalog rollout artifacts.

- Dataset, enrichment, and safety SQL no longer declare `BEGIN`/`COMMIT`; each
  generated file is executed as one Wrangler D1 file transaction.
- Every safety import write and the final status transition require the persisted
  catalog ID, exact dataset SHA-256, `analyzing` status, and analysis version.
  A checksum mismatch therefore writes no runs, profiles, ratings, or evidence
  and leaves the catalog status unchanged.
- The smoke DTO validation now uses the real generated-workout response envelope:
  `data.id` and `data.plan.days`, requiring nonempty plan/exercise IDs and a
  nonempty avoid-ID set.
- The rollout runbook uses `CATALOG_ID` consistently, requires
  `OPENROUTER_API_KEY` for production analysis, URL-encodes duplicate names,
  documents the exact manual safety override request, and includes an executable
  runbook check.

Verification used repository-local binaries because the workspace `pnpm` shim
references a missing global executable:

```text
./node_modules/.bin/eslint .
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
node scripts/check-exercise-catalog-runbook.mjs

43 test files passed (1 skipped); 347 tests passed (4 skipped).
```

The local Wrangler D1 regression test generates the actual dataset, enrichment,
and safety SQL files, executes them against an isolated migrated local D1 state,
then proves an artifact with the same source IDs but a different checksum fails
closed with zero imported safety rows.
