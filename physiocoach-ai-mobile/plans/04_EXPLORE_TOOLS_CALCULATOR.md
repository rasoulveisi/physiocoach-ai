# Phase 4: Explore Marketplace & Physio Tools

## 1. Goal
Implement the community Explore Marketplace, the Strength & Load Calculator, and the Smart Warm-up / Prehab mobility generator.

---

## 2. Technical Steps

### 2.1 Explore Plans Screen (`src/screens/explore/ExplorePlansScreen.tsx`)
- Fetches community and verified clinical routines via `GET /explore/plans`.
- Search and Filter pills:
  - Split filter (Full Body, Upper/Lower, PPL).
  - Joint Safeguard chips (Knee-Friendly, Shoulder-Safe, Low Spine Shear).
- Routine Cards:
  - Header banner with movement badge.
  - Truthful ratings: `★ 5.0 (New)` or `★ X.X (Y reviews)`.
  - Clone / Saves counter.
  - Persona match tags (e.g. *"Desk Workers with Lower Back Discomfort"*).
  - 1-Click "Save to My Plans" and "Set as Active" action buttons.
- Routine Preview Modal showing full multi-day breakdown before saving.

---

### 2.2 Strength & Physio Load Calculator (`src/screens/tools/CalculatorScreen.tsx`)
- Inputs: Lift Weight, Reps Completed (1-12), Target Effort (1-10 scale).
- Estimated Max Lift (1RM) display using conservative Epley/Brzycki formula.
- Interactive Barbell Plate Loader Visualizer:
  - Visual breakdown per side (20kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg plates).
- Recommended Working Weights table for Effort 6, 7-8, 9, and 10.
- Clinical multiplier guidelines (Tendon Rehab HSR 70-85%, Joint Deload 40-50%).

---

### 2.3 Smart Warm-up & Prehab Generator (`src/components/workout/PrehabSection.tsx`)
- Generates 3-minute joint mobility sequence before lifting via `POST /workout-sessions/prehab`.
- Step-by-step mobility checklist (e.g. 90/90 Hip Flow, Band Pull-Aparts, Scapular Wall Slides).

---

## 3. Verification & Definition of Done
1. `npx tsc --noEmit` returns **0 errors**.
2. Explore routines load live from database with ratings; 1RM calculations update reactively.
3. Git commit: `feat(mobile): implement explore plans marketplace, load calculator, and prehab generator`.
