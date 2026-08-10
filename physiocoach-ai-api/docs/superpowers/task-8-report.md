# Task 8 report: dynamic onboarding consideration severity

Implemented in `physiocoach-ai-web`.

- Loads and groups active `GET /considerations` options by `groupCode`.
- Stores severity-aware `AssessmentConsideration` values, defaulting a newly selected option to `mild`.
- Shows inline Mild, Moderate, and Severe controls without changing the 12-step mobile flow; inferred API values retain the `Confirm severity` indicator until edited.
- Includes considerations in assessment generation and snapshot fingerprints, while preserving the legacy fields accepted by the API.
- Uses persisted latest-assessment considerations for posture recommendations instead of the former fixed flag lookup.
- Regenerated `src/app/core/api/generated/schema.ts` from `http://localhost:8787/api/v1/openapi.json`; it includes `AssessmentConsideration` and `BodyConsideration`.
- Handles consideration-catalog and latest-assessment load failures independently, preserves existing/default selections, and presents visible retry actions for each request.

Verification in the web repository:

- `npx ng test --watch=false` — 27 files, 147 tests passed.
- `npx ng lint` — passed.
- `npx ng build` — passed; existing initial bundle budget warning remains.
