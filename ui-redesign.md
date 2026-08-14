# Precision Hardware UI Redesign for PhysioCoach AI

Redesign the PhysioCoach AI interface to feel like precision athletic hardware: professional, trustworthy, and ultra-fast for real athletes and physiotherapists on the gym floor.

## Design System & Architecture

### 1. Palette & Surface Hierarchy
- **Base Background**: Deep matte obsidian (`#090D15`)
- **Primary Surfaces & Cards**: Dark titanium surfaces (`#121722` and `#181F2E`)
- **Borders & Dividers**: Crisp, ultra-thin 1px borders (`#1F2937` or `rgba(255,255,255,0.08)`) with sharp surface contrast
- **Strict Data-Driven Accents (Zero Decorative Fluff)**:
  - **Volt Green (`#10E760`)**: Only for active logging, running timers, completed sets, and primary action triggers.
  - **Physio Amber (`#F59E0B`)**: Strictly for clinical safety warnings, biomechanical posture cues, and caution tags.
  - **Ice Cyan (`#06B6D4`)**: Strictly for joint recovery metrics, mobility telemetry, and muscle recovery status.
- **Zero Generic AI Patterns**: Purge all purple/indigo glows, gradient keywords, standard bento boxes, and over-rounded bubbly cards.

### 2. Typography & Numbers
- Text: Strong technical sans-serif (`Plus Jakarta Sans` / `Inter`).
- Data & Numbers: High-contrast tabular monospace figures (`JetBrains Mono`, `tabular-nums`) with `font-feature-settings: "tnum" 1, "zero" 1;`.
- Visual Hierarchy: Gym-floor readable digits (weights, reps, countdown timers) scaled to remain clear from 2 meters away.

### 3. Gym-Floor Usability & Thumb Zone
- Lower 40% thumb zone: Set logging controls, quick steppers (`±2.5kg`, `±1 rep`), completion checks, and timer buttons kept in immediate one-hand reach.
- Set Logging Table: Compact high-density layout with fast steppers, RPE 1–10 tactile strip, and instant volt green completion feedback.
- Rest Timer: Circular mechanical progress ring with large bold tabular countdown digits.
- Barbell Plate Calculator: Visual barbell sleeve breakdown per side (20kg bar baseline) rendering colored Olympic plate discs inside a clean bottom sheet.

### 4. Clinical Safety Edge
- Subtle clinical alert badges next to risky exercises with short, actionable biomechanical cues (joint angle limits, spinal neutrality, tempo recommendations).

---

## Proposed Changes

### Core Styles & Typography

#### [MODIFY] [index.html](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/index.html)
- Load `JetBrains Mono` for tabular figures alongside `Plus Jakarta Sans`.
- Set theme-color to `#090D15`.

#### [MODIFY] [tailwind.config.js](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/tailwind.config.js)
- Register `fontFamily.mono` for JetBrains Mono.
- Update palette tokens to strict Obsidian (`#090D15`), Titanium (`#121722`), Volt (`#10E760`), Amber (`#F59E0B`), and Cyan (`#06B6D4`).
- Remove violet/indigo gradient references and purple glows.

#### [MODIFY] [styles.css](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/styles.css)
- Update CSS custom properties for surfaces, borders, and text tokens.
- Add hardware utility classes: `.font-tabular`, `.pc-hardware-card`, `.pc-stepper-btn`, `.pc-clinical-badge`.
- Eliminate decorative purple gradients and over-rounded borders.

---

### Shared UI Components

#### [MODIFY] [exercise-safety-notes.ts](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/shared/ui/exercise-safety-notes.ts)
- Expand clinical safety and biomechanical cue dictionary (spinal mechanics, knee tracking, shoulder pack, tempo guidance).

#### [MODIFY] [metric-tile.component.ts](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/shared/ui/metric-tile.component.ts)
- Switch to dark titanium surface with crisp 1px border and tabular monospace numbers.

#### [MODIFY] [exercise-visual.component.ts](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/shared/ui/exercise-visual.component.ts)
- Update stage styling to dark titanium matte surface with crisp 1px border.

---

### Workout Session Page (Gym Floor Focus)

#### [MODIFY] [workout-session.page.html](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/features/workout-session/workout-session.page.html)
- **Mechanical Rest Timer HUD**: High-contrast circular progress ring with large tabular countdown digits (`font-mono text-3xl font-extrabold`) and thumb-friendly `+30s` / `-15s` / `Skip` / `Play/Pause` controls.
- **Active Exercise Card & Clinical Alert**: Biomechanical safety cues in Physio Amber `#F59E0B` and target metrics.
- **Compact Set Logging Table**: Dense rows with set type pills (W, 1, 2, 3, D, F), tabular weight input with `±2.5kg` steppers + plate calc trigger, tabular reps input with `±1 rep` steppers, RPE strip, and tactile Volt Green set completion button.
- **Barbell Plate Calculator Bottom Sheet**: Visual barbell sleeve diagram with loaded Olympic plates per side (20kg bar baseline) and exact disc list.
- **Pinned Bottom Zone**: Thumb-reachable action controls for seamless gym-floor logging.

#### [MODIFY] [workout-session.page.ts](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/features/workout-session/workout-session.page.ts)
- Add barbell sleeve breakdown helper with Olympic disc color mapping (20kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg) for visual plate loading diagram.
- Ensure fast steppers and plate calculator updates sync seamlessly with set drafts and session store.

---

### Dashboard & Workout Plan Pages

#### [MODIFY] [dashboard.page.html](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/features/dashboard/dashboard.page.html)
- Telemetry HUD with athlete readiness status and Volt Green action button.
- Weekly 7-day training strip with crisp completion indicators.
- Joint & Muscle Recovery grid with Ice Cyan (`#06B6D4`) progress meters.
- High-contrast tabular stats for recent sessions.

#### [MODIFY] [workout-plan.page.html](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/features/workout-plan/workout-plan.page.html)
- Dark titanium header, telemetry metric cards, and clinical caution badges in Physio Amber.

#### [MODIFY] [app-shell.component.html](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/physiocoach-ai-web/src/app/core/layout/app-shell.component.html)
- Titanium top bar and bottom navigation bar with crisp 1px borders and floating active workout pill.

---

## Verification Plan

### Automated Tests & Lint
- `npm run lint` in `physiocoach-ai-web` (ESLint clean)
- `npm test` in `physiocoach-ai-web` (All unit tests pass)
- `npm run build` in `physiocoach-ai-web` (Angular production build passes)
- `npm run validate:core`

### Manual & Visual Verification
- Verify dark titanium (`#121722`) and matte obsidian (`#090D15`) surface contrast with crisp 1px borders.
- Verify tabular monospace numbers on gym data (weights, reps, countdown timers).
- Test set logging table steppers (`±2.5kg`, `±1 rep`), RPE selector, and Volt Green completion check.
- Test barbell plate calculator bottom sheet with visual barbell sleeve graphic for standard 20kg bar baseline.
- Verify clinical alert badges in Physio Amber next to risky exercises.
