# Exercise Catalog Safety & Ingestion Offline Workflow

This document outlines the offline workflow for analyzing exercise datasets, evaluating exercise safety matrices, deriving movement attributes, and populating/updating the Cloudflare D1 exercise catalog database.

> [!NOTE]
> This analysis and dataset ingestion tool is an **offline initialization script**. It does **not** run inside the live production API Worker on Cloudflare Workers. The production API queries the pre-seeded D1 database (`master_exercises`, `exercise_media`, `exercise_safety_profiles`).

---

## 1. Overview of Offline Components

- **Dataset Ingestion**: Ingests exercise datasets (e.g. Free-Exercise-DB) from JSON fixtures.
- **Safety Analyzer**: Evaluates exercise safety matrices against physical considerations (e.g. `rounded_shoulders`, `knee_pain`, `lower_back_pain`).
- **Attribute Deriver & Candidate Clusterer**: Maps movement patterns, target muscles, equipment requirements, and candidate difficulty levels.
- **D1 Migration / Seed Exporter**: Exports evaluated master exercises, safety profiles, and media mappings to SQL seed migrations in `src/db/migrations/`.

---

## 2. Running Catalog Safety Analysis (CLI Command)

To analyze or update exercise safety matrices locally, run the safety analyzer CLI script:

```bash
# Run safety analysis against a dataset fixture
node scripts/analyze-exercise-safety.mjs \
  --catalog=./tests/fixtures/exercises-dataset-sample.json \
  --out=./tmp/safety-analysis.json \
  --state=./tmp/analyzer-state.json \
  --provider=fake
```

### Command Flags:
- `--catalog`: Path to the source exercise dataset JSON file.
- `--out`: Destination path for generated safety matrix analysis JSON.
- `--state`: State cache file path for incremental analysis runs.
- `--provider`: AI provider for safety matrix evaluation (`fake` for deterministic test runs, or `openrouter` for live LLM evaluation).

---

## 3. Applying Catalog Seeds to Local & Remote D1

Once the safety analysis and catalog dataset are generated:

1. **Generate D1 Migration**:
   ```bash
   npx drizzle-kit generate
   ```

2. **Apply Local Migration**:
   ```bash
   npx wrangler d1 migrations apply physiocoach_prod --config ./wrangler.toml --local
   ```

3. **Deploy Remote Migration (Production)**:
   ```bash
   npx wrangler d1 migrations apply physiocoach_prod --config ./wrangler.toml --remote
   ```

---

## 4. Verification

After updating the catalog, verify media and exercise lookups via HTTP requests:

- `GET /api/v1/exercise-catalog/media?exerciseId=<id>`
- `POST /api/v1/exercise-catalog/media/batch`
