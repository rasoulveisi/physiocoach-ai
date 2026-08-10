# Task 10 report: catalog rollout architecture corrections

The catalog workflow now enforces
`importing -> analyzing -> review_required -> ready -> active -> retired`.

- Additive migration `0009_many_pandemic.sql` adds a defaulted
  `review_revision` and persisted duplicate-name review groups.
- Source, enrichment, and safety SQL are transactional and status guarded.
  Enrichment never enters review; safety import alone advances `analyzing` to
  `review_required`.
- Metadata, safety, and duplicate decisions require `review_required` and use
  atomic D1 batches. Successful decisions increment the catalog revision while
  automated analyzer evidence remains immutable.
- Readiness evaluates a specific revision and uses a status-plus-revision
  compare-and-swap. Concurrent changes report
  `catalog_changed_during_readiness`.
- Readiness blocks pending duplicates, invalid enums or empty reasons,
  incomplete severity cells, decreasing safety strictness, incomplete metadata,
  unapproved profiles, and inconsistent analysis evidence.
- Activation accepts only `ready`, atomically retires the prior active snapshot,
  and never reopens active or retired rows. Rollback uses a fresh reviewed snapshot.
- Authenticated duplicate list/resolve routes preserve distinct source IDs and
  are documented in OpenAPI and the operator runbook.

Tests cover revision races, active-to-ready rejection, duplicate blockers,
malformed rating content, and non-monotonic severity. A real SQLite/D1-compatible
integration executes three complete source/enrichment/safety workflows and proves
initial activation, replacement retirement, and fresh-snapshot rollback. The
fake provider is used only to emit schema-valid deterministic fixture artifacts.

Final local verification on 2026-07-31:

- `pnpm validate`: ESLint passed, Vitest passed 336 tests with 4 skipped, and
  TypeScript `tsc --noEmit` passed.
- Focused CLI fixture: imported 2/2 records, enriched 2/2, analyzed 2/2 with
  complete coverage, and generated 108 persisted rating cells.
- Real SQLite lifecycle integration: 3/3 tests passed, including initial,
  replacement, and rollback-snapshot activation.
- Regenerated Angular OpenAPI client: frontend lint and production build passed;
  the existing initial-bundle budget warning remains.
