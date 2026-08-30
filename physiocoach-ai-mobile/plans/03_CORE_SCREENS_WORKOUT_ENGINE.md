# Phase 3: Core Athlete Screens & Live Workout Engine

## 1. Goal
Build the core athlete experience: Dashboard, Interactive Multi-Day Plan Screen, and the Live Workout Session screen with native haptics and audio voice countdowns.

---

## 2. Technical Steps

### 2.1 Dashboard Screen (`src/screens/dashboard/DashboardScreen.tsx`)
- Fetches current active routine via `GET /workout-plans/active` (or `/workout-plans/current`).
- Hero Card:
  - Plan title, split badge, and current day overview.
  - Big volt green **"Start Today's Workout"** CTA button $\rightarrow$ navigates to `LiveSessionScreen`.
- Quick Stats Row:
  - Weekly Volume (Total sets completed), Streak counter, Active safeguards.
- Recent Session History card with completion timestamps.

---

### 2.2 Plan Screen (`src/screens/plan/PlanScreen.tsx`)
- Displays multi-day schedule (e.g. Day 1: Push, Day 2: Pull, Day 3: Legs).
- Day Accordion / Carousel with expandable exercise items:
  - Sets, Target Reps, RIR / Effort scale, Rest seconds, Lifting speed tempo.
  - **AI Progressive Overload Chip**:
    - Displays calculated target (e.g. `⚡ Target: 82.5 kg (+2.5 kg overload)`).
    - 1-Click "Apply Target" button pre-filling weights.
- "My Plans Library" modal switcher $\rightarrow$ lists saved routines and allows 1-click activation (`POST /workout-plans/:id/activate`).
- 5-Star interactive rating bar (`POST /workout-plans/:id/rate`).

---

### 2.3 Live Workout Session Screen (`src/screens/session/LiveSessionScreen.tsx`)
- Native Keep-Awake: Calls `activateKeepAwakeAsync()` when session is active so phone screen never sleeps.
- Set-by-Set Logging Matrix:
  - Set pills (`NORMAL`, `WARMUP`, `DROP`, `FAILURE`).
  - Weight and Reps stepper inputs.
  - Checkbox to mark set complete $\rightarrow$ triggers light haptic buzz (`expo-haptics`) and starts the Rest Timer HUD.
- Rest Timer HUD:
  - Floating bottom drawer / HUD with live countdown ring.
  - Quick adjustment buttons (`+30s`, `-15s`, `Skip`).
  - When timer hits 0:
    - Triggers double haptic pulse (`Haptics.notificationAsync`).
    - Uses Text-to-Speech (`expo-speech`) to announce: *"Rest complete. Get ready for [Exercise Name]"*.
- Joint Discomfort / Pain Rating Modal (0-10 scale) $\rightarrow$ triggers auto-deload recommendations.
- "Finish Workout" button with summary celebration modal.

---

## 3. Verification & Definition of Done
1. `npx tsc --noEmit` returns **0 errors**.
2. Live workout timer counts down, triggers voice cue and haptic vibration on physical Android phone.
3. Git commit: `feat(mobile): implement dashboard, plan schedule, and live workout engine with rest timer haptics`.
