# PhysioCoach owned visual style

This directory contains the approved visual direction and prompt-only production
manifest. The images are anatomical exercise illustrations, not iconography:

- athletic silhouette with realistic biomechanics;
- translucent anatomical layers;
- active muscles highlighted in vivid orange/red;
- neutral white background and charcoal/slate body tones;
- accurate equipment and joint alignment;
- no text, labels, logos, or watermarks.

For a provider-neutral system/developer instruction and quality gate, see
[`SYSTEM-INSTRUCTION.md`](SYSTEM-INSTRUCTION.md). It is designed to be reused
across image models while keeping the exercise-specific prompt variables stable.

The six review images are in `assets/`. The supplied Goblet Squat image is
kept as the reference; the other four are PhysioCoach-generated examples.

`owned-visual-prompts.json` contains one prompt for every dataset exercise. It
contains metadata and prompts only; production image generation is intentionally
deferred until the style is approved.

Regenerate the prompt manifest from the catalog metadata with:

```bash
node scripts/generate-owned-visual-prompts.mjs \
  ../physiocoach-ai-api/seed-input/exercises.json \
  docs/owned-visual-style/owned-visual-prompts.json
```
