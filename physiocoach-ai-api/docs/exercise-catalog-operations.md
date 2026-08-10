# Exercise catalog operations

Run these commands from the API repository. They create immutable import and
analysis artifacts; they do not activate a catalog or copy exercise media.

```bash
mkdir -p seed-input seed-output
curl -L --fail https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json -o seed-input/exercises.json
SOURCE_COMMIT_SHA="$(git ls-remote https://github.com/hasaneyldrm/exercises-dataset.git refs/heads/main | cut -f1)"
pnpm import:exercises-dataset -- --file=seed-input/exercises.json --commit="$SOURCE_COMMIT_SHA" --out=seed-output
CATALOG_ID="$(node -p "require('./seed-output/exercises-dataset-import-report.json').summary.catalogVersionId")"
pnpm enrich:exercise-catalog -- --report=seed-output/exercises-dataset-import-report.json --out=seed-output/exercise-enrichment.sql
pnpm exec wrangler d1 execute physiocoach_dev --config ./wrangler.toml --env dev --remote --file=seed-output/exercises-dataset-import.sql
pnpm exec wrangler d1 execute physiocoach_dev --config ./wrangler.toml --env dev --remote --file=seed-output/exercise-enrichment.sql
: "${OPENROUTER_API_KEY:?Set OPENROUTER_API_KEY before production safety analysis.}"
pnpm analyze:exercise-safety -- --catalog=seed-input/exercises.json --state=seed-output/safety-state.json --out=seed-output/safety-analysis.json --analysisVersion=safety-v1 --provider=openrouter
pnpm import:exercise-safety -- --artifact=seed-output/safety-analysis.json --catalog=seed-input/exercises.json --catalogVersionId="$CATALOG_ID" --out=seed-output/safety-analysis.sql
pnpm exec wrangler d1 execute physiocoach_dev --config ./wrangler.toml --env dev --remote --file=seed-output/safety-analysis.sql
```

The analysis command requires a shell-exported `OPENROUTER_API_KEY`; `--provider=fake` is only for
non-production artifact tests. The source SQL creates the catalog as `importing`
and persists duplicate-name groups as pending review rows. Enrichment is allowed
only in `importing` or `analyzing` and always leaves the catalog `analyzing`.
Safety import requires `analyzing`, records pending profiles, and advances to
`review_required`; no CLI ever sets `ready`. Apply audited metadata, duplicate,
and safety decisions only in review, then confirm coverage, mark ready, and
activate. Run the authenticated smoke check after activation:
`AUTH_ACCESS_TOKEN=<admin-jwt> API_SMOKE_ACTIVE_CATALOG_ID="$CATALOG_ID" pnpm smoke:api:dev`.

Before activation, record the catalog ID emitted by the import and obtain an
admin API JWT. Resolve every enrichment review item with the exact metadata and
duplicate endpoints shown below, approve every pending safety profile, and inspect coverage.
POST `ready` only after coverage reports no blockers, source accounting is
exactly 1,324 records, every published exercise has complete classified
attributes and equipment, every safety profile is approved with a complete
matrix, rating enums and reasons are valid, strictness never decreases from mild
to moderate to severe, every duplicate group is resolved, and no conflict remains.
Readiness compares the evaluated `review_revision`; repeat review if it reports
`catalog_changed_during_readiness`. POST `activate` only after `ready` succeeds.

```bash
curl -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/catalogs/$CATALOG_ID/coverage"
curl -X POST -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/catalogs/$CATALOG_ID/ready"
curl -X POST -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/catalogs/$CATALOG_ID/activate"
```

Do this in dev first. Activation atomically retires the previous active catalog
and activates one `ready` replacement. `active` and `retired` snapshots are
immutable. To roll back, import the prior source as a new snapshot, repeat the
complete analysis and review workflow, then activate that new ready row; never
reopen the retired row. Exercise both replacement and rollback in dev. Production
activation is deliberately a separate, approved operation and is not part of
this procedure.

Review duplicates before approval. A resolution records that similarly named
exercises are intentional and does not merge their stable source IDs:

```bash
NORMALIZED_NAME='lever chest press'
NORMALIZED_NAME_ENCODED="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$NORMALIZED_NAME")"
curl -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/catalogs/$CATALOG_ID/duplicate-reviews"
curl -X POST -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/catalogs/$CATALOG_ID/duplicate-reviews/$NORMALIZED_NAME_ENCODED/resolve" \
  --data '{"reason":"Both source exercises are intentional","reviewedBy":"admin@example.com"}'
```

Use the normalized name returned by `duplicate-reviews`; do not hand-assemble a
URL path.

Preserve source rows for audit and resolve every deterministic/AI conflict with a
reviewer override or corrected analysis. Legacy inferred considerations remain explicitly marked `inferred`;
they are defaults to review, not a user-confirmed diagnosis, and their severity
must remain visible and editable.

Resolve an `unclassified` enrichment record with an audited admin metadata
override (the `attributes` object must contain every derived attribute):

```bash
curl -X PATCH -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/exercises/$EXERCISE_ID/catalog-metadata" \
  --data '{"catalogVersionId":"'$CATALOG_ID'","movementPattern":"core","attributes":{"movementPattern":"core","loadedRegions":[],"impactLevel":"low","spinalLoad":"low","balanceDemand":"low","technicalComplexity":"beginner","overhead":false,"behindNeck":false,"deepFlexion":false,"explosive":false,"unilateral":false,"rotational":false,"inverted":false},"reason":"Reviewed source instructions","reviewedBy":"admin@example.com"}'
```

Use a manual safety override only to document an explicit human review decision.
It must name the catalog's current analysis version; the authenticated actor is
recorded as the reviewer.

```bash
EXERCISE_ID='ex_catalog_example_0001'
ANALYSIS_VERSION='safety-v1'
curl -X PATCH -H "Authorization: Bearer $AUTH_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  "https://physiocoach-ai-api-dev.otconnect.ir/api/v1/admin/exercises/$EXERCISE_ID/safety" \
  --data '{"rating":"avoid","reason":"Unsafe without the documented modification.","analysisVersion":"'$ANALYSIS_VERSION'"}'
```

Never download, import, publish, or copy third-party visual media into this
repository, D1, R2, or the application. Only approved owned or separately
licensed stored media may be attached after catalog activation.

## Real dataset media rights gate

The dataset contains 1,324 image and GIF references, but its README states that
the media is for educational/non-commercial use and belongs to its respective
copyright holders. Do not import those files into a commercial deployment until
a signed commercial permission record exists. Validate that permission before
any media import:

```bash
node scripts/validate-exercise-media-rights.mjs \
  --dataset=seed-input/exercises.json \
  --manifest=docs/media-rights-manifest.example.json
```

The manifest must bind the exact dataset checksum to the rights holder,
permission document, application-use profile, health-topic and AI-use
permissions, image/GIF scope, attribution, resolution, and allowed source IDs.
A failed validation must stop the media import. PhysioCoach must not publish the
media as a downloadable or reusable asset.

After receiving the signed document, do not paste a vague URL into the manifest.
Store the document in the restricted release-evidence store, record its immutable
URL or document ID, and replace the example values with the exact rights holder,
attribution, and scope. Then run the gate before downloading any media:

```bash
cp docs/media-rights-manifest.example.json seed-output/media-rights-manifest.json
# Edit seed-output/media-rights-manifest.json with the signed license details.
node scripts/validate-exercise-media-rights.mjs \
  --dataset=seed-input/exercises.json \
  --manifest=seed-output/media-rights-manifest.json
```

Only a successful gate authorizes the next release step: fetch the licensed
`image` and `gif_url` objects, verify their content hashes, upload them to the
approved private/public media store, and generate `exercise_media` rows with
`ownership_status='licensed'`, `review_status='approved'`, the license name,
rights holder, attribution text, source ID, object key, and content hash. The
API must serve only those rows; an image/GIF with a missing hash, source ID, or
license evidence remains unpublished. Keep the signed document and generated
manifest beside the release artifact for audit and rollback.

The deterministic artifact generator performs that local inventory and emits
the D1 rows only after the rights gate succeeds. It does not upload files or
activate a catalog:

```bash
pnpm prepare:licensed-media -- \
  --dataset=seed-input/exercises.json \
  --manifest=seed-output/media-rights-manifest.json \
  --mediaRoot=/path/to/licensed/exercises-dataset \
  --report=seed-output/exercises-dataset-import-report.json \
  --out=seed-output/licensed-exercise-media.sql \
  --baseUrl=https://media.example.com
```
