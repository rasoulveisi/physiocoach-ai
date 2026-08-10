# Task 3 report: deterministic exercise safety attributes

Implemented deterministic derivation and safety rules for catalog enrichment.

- Derivation uses normalized names, English instructions, target/muscles, equipment, and body part.
- Hard rules cover behind-neck work, high-impact landing, advanced ballistic lifts, deep loaded knee flexion, high spinal load, and unstable overhead work.
- The ballistic classifier explicitly covers push jerks, hang cleans/cleans, snatches, thrusters, kettlebell swings, and high pulls. Back squats, deadlifts, good mornings, and barbell overhead presses are conservatively treated as high spinal load.
- Every restriction contains stable rule codes and human-readable reasons.
- `mergeSuitability` is conservative: an absent rating is `avoid`, and AI cannot weaken a deterministic restriction.
- Severity restrictions are monotonic (`recommended < caution < avoid`).

Verification passed using local binaries:

```text
./node_modules/.bin/vitest run tests/exercise-attribute-deriver.test.ts tests/exercise-safety-rules.test.ts tests/safety.test.ts
3 files passed, 25 tests passed

./node_modules/.bin/eslint src/services/exercise-attribute-deriver.ts src/services/exercise-safety-rules.ts tests/exercise-attribute-deriver.test.ts tests/exercise-safety-rules.test.ts
./node_modules/.bin/tsc --noEmit
git diff --check
```

Blocker: the workspace `pnpm` shim references a missing global executable at
`/Users/rasoul/Library/pnpm/global/v11/fdbd-19e88c7d751/node_modules/@pnpm/exe/pnpm`.
The repository-local binaries above were used as the safe equivalent for Task 3.
