# PhysioCoach AI: Master Execution Plan (Source of Truth)

**Project:** PhysioCoach AI (Full-Stack React 19 PWA + Cloudflare Workers + Drizzle ORM + Neon PostgreSQL via Hyperdrive)  
**Team Model:** 1 Solo Full-Stack Developer + AI Agent Orchestrator (Antigravity) + Sub-Agents (Hermes CLI with inner `opencode-go/glm-5.3-flash`)  
**Core Moat:** Medical-Grade Safety Audits (`traceId`, `auditLogId`), Injury-Aware Exercise & Rehab Intelligence, B2B2C Physical Therapy Retention.

---

## 1. Master Architecture & Rules

1. **Backend Layer (`physiocoach-ai-api`)**:
   - Cloudflare Workers runtime (Express 5 adapter).
   - Neon PostgreSQL via Cloudflare Hyperdrive connection pooling.
   - Drizzle ORM directly in `src/routes/` and `src/services/` (no repository abstractions, no `export *` re-exports).
   - Zero frontend AI calls; all AI reasoning goes through API routes with structured output & safety audits.
2. **Frontend Layer (`physiocoach-ai-web`)**:
   - React 19 PWA (Vite + Tailwind CSS).
   - Precision dark UI theme (`#090D15` background, `#121722` titanium cards, `#10E760` volt active states, `#F59E0B` physio amber alerts).
   - Full offline & mobile PWA capabilities.
3. **Verification Protocol**:
   - Backend: `npm run validate` in `physiocoach-ai-api` (lint + vitest + typecheck).
   - Frontend: `npm run build` in `physiocoach-ai-web` (tsc + vite build).

---

## 2. 4-Phase Master Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MASTER EXECUTION PHASES                         │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Catalog & Data Foundation (Exercises, Importer, Calculator)   │
│   ▼                                                                    │
│ PHASE 2: SEO & Traffic Multiplier (Alternatives, Sitemap, Explore)     │
│   ▼                                                                    │
│ PHASE 3: UGC Engine & Safety Gate (Plan Builder, AI Audit, Prehab)     │
│   ▼                                                                    │
│ PHASE 4: B2B2C Physio Revenue Flywheel (PT Portal, Seats, Chat/Alerts) │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: Catalog & Data Foundation
*Immediate utility, browse experience, and zero-friction user migration.*

* **Feature 1.1: Explore All Exercises (`/exercises`)** — **`DONE ✅`**
  * Multi-dimensional filtering: Body Part/Muscle, Equipment, Movement Pattern, and Joint-Safety Tags (Spine-Safe, Knee-Friendly, Shoulder-Safe).
  * Interactive Anatomical SVG Body Map selector.
  * Comprehensive Exercise Detail Modal with looping media, step-by-step form cues, clinical contraindications, and 1-click safer swap candidates.
* **Feature 1.2: 1-Click Workout Importer (`/import`)** — **`DONE ✅`**
  * Client-side CSV/JSON drag-and-drop parser supporting Lyfta, Hevy, Strong, and standard tabular exports.
  * Smart exercise name fuzzy-matching interface with manual override before saving to library.
* **Feature 1.3: Physio Load & Strength Calculator (`/tools/calculator`)** — **`DONE ✅`**
  * Interactive 1RM, RPE/RIR conversion, and safe rehab load percentages based on recovery and injury status.

---

### Phase 2: Programmatic SEO & Traffic Multiplier
*High-intent organic Google traffic acquisition and discovery.*

* **Feature 2.1: "Injury-Safe Exercise Alternatives" Programmatic Pages (`/tools/alternatives/[slug]`)** — **`DONE ✅`**
  * Dynamic SEO landing pages for high-volume search queries (e.g. `/alternatives/bench-press-shoulder-pain`, `/alternatives/back-squat-knee-pain`).
  * Structured comparison matrix: muscle activation, joint shear rating, and alternative exercise swaps.
* **Feature 2.2: Public Explore Plans Feed (`/explore`)** — **`DONE ✅`**
  * Publicly indexable feed of verified, clinical-grade workout routines filterable by split, equipment, and injury status.
* **Feature 2.3: Sitemap & Metadata Pipeline** — **`DONE ✅`**
  * Automated dynamic `sitemap.xml` builder, robots.txt, and OpenGraph preview cards for social virality.

---

### Phase 3: UGC Engine, Medical Safety Audit Gate & Prehab
*User plan creation with clinical safety verification and candidate persona matching.*

* **Feature 3.1: Interactive Plan Builder (`/plans/builder`)** — **`DONE ✅`**
  * Multi-day program creator with Day management (Add/Remove/Rename Day), exercise catalog picker drawer with search and muscle filter, exercise cards with Move Up/Down reorder and delete, interactive set configurator (type pills, reps, RIR stepper, tempo, rest), weekly volume HUD, and Save & Activate Plan CTA submitting to `POST /api/v1/workout-plans/custom` and redirecting to `/plan`.
* **Feature 3.2: AI Medical Safety Evaluation Gate (`POST /api/workout-plans/audit`)** — **`DONE ✅`**
  * Clinical safety validator auditing Push:Pull ratio, weekly volume per muscle group, and spinal/joint shear stress.
  * Generates traceable `auditLogId` and `traceId`. Returns "PhysioCoach Certified Safe" badge or actionable fix suggestions.
  * Backend: deterministic rule-based safety audit engine in `src/services/plan-audit.ts`, endpoint at `POST /api/v1/workout-plans/audit`, audit logs persisted to `ai_audit_logs`. 8 E2E tests in `tests/e2e/plan-audit.test.ts`.
  * Frontend: `SafetyAuditModal.tsx` with animated scan HUD, score ring, traceability IDs, expandable check cards, and context-aware CTA wired into `PlanBuilderPage.tsx` via "Run Safety Audit" button.
* **Feature 3.3: Explore Marketplace Publishing & Persona Matching** — **`DONE ✅`**
  * Verified plans published to `/explore` with automatic candidate persona matching (e.g. *"Desk Workers with Lower Back Discomfort"*, *"Knee-Friendly Hypertrophy"*, *"Shoulder-Safe Strength"*, *"Minimal Equipment Longevity"*, *"Post-Rehab Foundation"*).
  * Backend: deterministic persona evaluator in `src/services/persona-matching.ts`, publishing endpoint at `POST /api/v1/workout-plans/:id/publish` updating plan metadata and status, integrated `GET /api/v1/explore/plans` and `GET /api/v1/explore/plans/:id` database loader with persona mapping. 100% test coverage in `tests/e2e/plan-publish.test.ts`.
  * Frontend: `SafetyAuditModal.tsx` and `PlanBuilderPage.tsx` with 1-click "Publish to Community Explore Hub" upon passing audit (score >= 80), live candidate persona badge rendering, published confirmation with direct route link to `/explore?plan=...`, and vivid candidate persona tags rendered on `ExplorePlansPage.tsx` routine cards.
* **Feature 3.4: Smart Warm-up & Prehab Generator** — **`DONE ✅`**
  * 1-click generation of 3–5 minute targeted dynamic mobility and joint activation routine tailored to that day's lifts and user limitations.
  * Backend: clinical joint mobility and muscle activation rule engine in `physiocoach-ai-api/src/services/prehab-generator.ts`, endpoint `POST /api/v1/workout-sessions/prehab` in `src/routes/workout-sessions.ts`. Comprehensive E2E tests in `tests/e2e/prehab-generator.test.ts`.
  * Frontend: `PrehabWarmupSection.tsx` collapsible card integrated above lifting sets in `SessionPage.tsx` with "Generate 3-Min Mobility Routine" CTA, target joint capsule chips, step-by-step checklist with inline countdown timer and reps tracking, completion toggles, and "JOINTS PRIMED" celebration badge.

---

### Phase 4: B2B2C Physio & Coach Revenue Flywheel
*(Fully implemented in codebase, schema, tests, and documentation; currently gated/hidden in consumer UI for initial release).*

* **Feature 4.1: Post-Discharge Rehab Dashboard for PTs (`/coach`)** — **`DONE ✅`**
  * Patient management portal to prescribe home strength routines, monitor compliance, and track pain trends after clinical discharge.
  * Backend:
    * Drizzle schema additions: `coachProfiles`, `coachClients`, and `coachAssignedPlans` in `physiocoach-ai-api/src/db/schema.ts` with auto-generated migration (`src/db/migrations/0001_cute_xorn.sql`).
    * Express 5 router `coachRouter` in `src/routes/coach.ts` mounted at `/coach` and `/api/v1/coach`.
    * Endpoints: `GET /coach/clients` (with roster, filters, compliance metrics, and clinic stats), `POST /coach/clients` (patient intake/enrollment), `POST /coach/clients/assign-plan` (clinical routine prescription), `GET /coach/clients/:id/adherence` (detailed weekly compliance, RPE progression, and pain alerts).
    * E2E test suite in `physiocoach-ai-api/tests/e2e/coach-dashboard.test.ts` (100% pass).
  * Frontend:
    * `CoachDashboardPage.tsx` with Clinic Macro Telemetry HUD (Total Patients, Adherence Rate %, Pain Alerts, Graduated Patients), responsive Patient Roster Table & Filter (search, status tabs, diagnosis chips, compliance progress rings, last session telemetry), "Add Patient" Modal with quick diagnosis selector, "Assign Rehab Plan" Modal with template selector & clinical therapist directives, and interactive Patient Detail Drawer with 4-week compliance history and logged RPE/pain trends.
    * Route registered at `/coach` in `src/router.tsx` and "PT Portal" link with `UserCheck` icon integrated into `Navbar.tsx`.
* **Feature 4.2: Bulk Client Codes & Seat Licensing** — **`DONE ✅`**
  * B2B wholesale client license packs (5, 10, 25 seats) via Stripe Connect for PTs to bundle into their recurring services.
  * Backend:
    * Drizzle schema additions: `coachSeatLicenses` and `coachClientInvites` in `physiocoach-ai-api/src/db/schema.ts` with auto-generated migration (`src/db/migrations/0002_glossy_thena.sql`).
    * Express 5 router endpoints in `src/routes/coach.ts`:
      * `GET /coach/seats`: returns seat usage, active tier, capacity meter, master clinic invite code, and invite roster with demo fallback.
      * `POST /coach/seats/checkout`: initiates wholesale seat tier purchase (Starter 5 Seats $49/mo, Pro 10 Seats $89/mo, Clinic 25 Seats $199/mo) and provisions license.
      * `POST /coach/invites/generate`: validates capacity and generates trackable patient activation invite link (`https://physiocoach.ai/invite/TOKEN`).
      * `POST /coach/invites/redeem`: redeems token, marks invite redeemed, and links patient into PT coach roster.
      * `POST /coach/invites/revoke`: revokes unredeemed patient invite tokens.
    * E2E test suite in `physiocoach-ai-api/tests/e2e/coach-seats.test.ts` (100% pass, 5 tests).
  * Frontend:
    * `CoachDashboardPage.tsx` with "Seat Licensing & Wholesaling" management HUD, interactive Seat Capacity Meter (used vs total, available seats, wholesale margin), "Upgrade / Add Seats" Modal with 3 wholesale tiers (Starter 5 Seats $49/mo, Pro 10 Seats $89/mo, Clinic 25 Seats $199/mo), "Generate Patient Invite" Modal with 1-click copyable link and SMS/email share template, Tabbed view for Active Patients Roster vs Seat Invites & Codes, and full invite management table with status pills, copy link, and revoke actions.
* **Feature 4.3: Coach-Client Async Review & Pain Alerts** — **`DONE ✅`**
  * Async communication channel with automated high-priority alerts when a patient logs pain level > 4/10 during an active workout.
  * Backend:
    * Drizzle schema additions: `coachMessages` and `coachPainAlerts` in `physiocoach-ai-api/src/db/schema.ts` with auto-generated migration (`src/db/migrations/0003_slim_magus.sql`).
    * Express 5 router endpoints in `src/routes/coach.ts`:
      * `GET /coach/messages/:clientId`: Returns message thread history, unread counter, and marks messages read.
      * `POST /coach/messages`: Creates async therapist-patient message and auto-triggers active pain alerts if `painScore > 4`.
      * `GET /coach/alerts`: Lists active and historical pain alerts with severity, status filtering, and total active count.
      * `POST /coach/alerts/:id/resolve`: Resolves pain alert, saves therapist clinical note, and optionally appends a clinical directive response to the patient chat thread.
    * Integration in `src/routes/workout-sessions.ts`:
      * `POST /workout-sessions/pain-alert` and `POST /workout-sessions/:sessionId/pain-alert` routes.
      * Auto-triggers high-priority pain alerts during workout completion when `painScore > 4`.
    * E2E test suite in `physiocoach-ai-api/tests/e2e/coach-messaging-alerts.test.ts` (100% pass, 5 tests).
  * Frontend:
    * `CoachDashboardPage.tsx`:
      * High-Priority Red Alert Banner at the top of the dashboard with flashing radar badge, patient flare details, pain score rating pill (`X/10`), joint region, and 1-click "Review & Triage Alert" CTA button.
      * "Pain Alert Review & Triage" Modal displaying joint region, 0-10 visual pain scale gradient meter, exercise context, 5 quick 1-click clinical directive presets (*"Apply Tendon Deload Protocol"*, *"Switch to Isometric Hold"*, *"Rest 48h & Active Recovery"*, *"Reduce Load 30% & Cap RPE 6"*, *"Progress to Isotonic Phase"*), custom directive textarea, and "Resolve & Transmit Directive" action.
      * "Async Messaging Drawer" with two-way chat bubble thread, distinct patient vs therapist bubble styling, pain alert indicator pills, quick directive response template bar, and optimistic message delivery.
      * "Chat" actions integrated into patient roster table rows and patient telemetry drawer.
    * `SessionPage.tsx`:
      * Integrated Joint Discomfort & Pain Rating slider (0–10 scale) alongside session RPE.
      * Automatic High-Priority Pain Spike warning (> 4/10) with joint region selector chips (*"Patellar Knee"*, *"Lower Back"*, *"Shoulder"*, etc.) and optional notes.
      * Automated pain alert transmission to coach upon session finish or high pain rating, with notification in the workout complete celebration modal.


---

## 3. Multi-Agent Orchestration Protocol

When executing tasks via Hermes CLI as subagents:
* **Orchestrator**: Antigravity (Pair programming with developer, planning, diff verification, testing).
* **Executor Subagent**: Local Hermes CLI (`/Users/rasoul/.local/bin/hermes`) running default `opencode-go/glm-5.3-flash`.
* **Execution Command Pattern**:
  ```bash
  HERMES_NONINTERACTIVE=1 HERMES_ACCEPT_HOOKS=1 /Users/rasoul/.local/bin/hermes -z "<SUBTASK_PROMPT>" --accept-hooks
  ```
