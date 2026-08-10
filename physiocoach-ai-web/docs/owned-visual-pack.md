# PhysioCoach-owned exercise visual pack

The catalog metadata and safety decisions remain sourced from the exercise
dataset. Visuals are generated locally by
`scripts/generate-owned-exercise-visuals.mjs`; no third-party or other
third-party image is copied into the web application.

Each source exercise receives one deterministic SVG at:

```text
/images/exercises/catalog/<four-digit-source-id>.svg
```

The generator uses the exercise name, category, target, and equipment to select
an appropriate movement family (`squat`, `hinge`, `lunge`, `pull`, `push`,
`arms`, `carry`, `core`, `mobility`, or `full-body`). It then applies a stable
PhysioCoach color variant and embeds the exercise name and source ID in the SVG
metadata for accessibility and auditability.

Regenerate the pack when the dataset snapshot changes:

```bash
node scripts/generate-owned-exercise-visuals.mjs \
  ../physiocoach-ai-api/seed-input/exercises.json \
  public/images/exercises/catalog
```

The API's dev `exercise_media` rows point to these per-exercise assets and are
marked `ownership_status='owned'`, `review_status='approved'`, and
`source='physiocoach-owned-pack'`. The pack is intentionally self-contained so
it can later be replaced with commissioned artwork without changing catalog IDs,
safety logic, or workout-plan generation.
