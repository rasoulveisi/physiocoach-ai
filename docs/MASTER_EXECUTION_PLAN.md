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

* **Feature 1.1: Explore All Exercises (`/exercises`)**
  * Multi-dimensional filtering: Body Part/Muscle, Equipment, Movement Pattern, and Joint-Safety Tags (Spine-Safe, Knee-Friendly, Shoulder-Safe).
  * Interactive Anatomical SVG Body Map selector.
  * Comprehensive Exercise Detail Modal with looping media, step-by-step form cues, clinical contraindications, and 1-click safer swap candidates.
* **Feature 1.2: 1-Click Workout Importer (`/import`)**
  * Client-side CSV/JSON drag-and-drop parser supporting Lyfta, Hevy, Strong, and standard tabular exports.
  * Smart exercise name fuzzy-matching interface with manual override before saving to library.
* **Feature 1.3: Physio Load & Strength Calculator (`/tools/calculator`)**
  * Interactive 1RM, RPE/RIR conversion, and safe rehab load percentages based on recovery and injury status.

---

### Phase 2: Programmatic SEO & Traffic Multiplier
*High-intent organic Google traffic acquisition and discovery.*

* **Feature 2.1: "Injury-Safe Exercise Alternatives" Programmatic Pages (`/tools/alternatives/[slug]`)**
  * Dynamic SEO landing pages for high-volume search queries (e.g. `/alternatives/bench-press-shoulder-pain`, `/alternatives/back-squat-knee-pain`).
  * Structured comparison matrix: muscle activation, joint shear rating, and alternative exercise swaps.
* **Feature 2.2: Public Explore Plans Feed (`/explore`)**
  * Publicly indexable feed of verified, clinical-grade workout routines filterable by split, equipment, and injury status.
* **Feature 2.3: Sitemap & Metadata Pipeline**
  * Automated dynamic `sitemap.xml` builder, robots.txt, and OpenGraph preview cards for social virality.

---

### Phase 3: UGC Engine, Medical Safety Audit Gate & Prehab
*User plan creation with clinical safety verification and candidate persona matching.*

* **Feature 3.1: Interactive Plan Builder (`/plans/builder`)**
  * Drag-and-drop routine creator with set types (`NORMAL`, `WARMUP`, `DROP`, `FAILURE`), target RIR, tempo, and rest intervals.
* **Feature 3.2: AI Medical Safety Evaluation Gate (`POST /api/workout-plans/audit`)**
  * Clinical safety validator auditing Push:Pull ratio, weekly volume per muscle group, and spinal/joint shear stress.
  * Generates traceable `auditLogId` and `traceId`. Returns "PhysioCoach Certified Safe" badge or actionable fix suggestions.
* **Feature 3.3: Explore Marketplace Publishing & Persona Matching**
  * Verified plans published to `/explore` with automatic candidate tags (e.g. *"Desk Worker Posture"*, *"Knee-Friendly Hypertrophy"*).
  * 1-click "Clone/Save to My Plans" for athletes.
* **Feature 3.4: Smart Warm-up & Prehab Generator**
  * 1-click generation of 3–5 minute targeted dynamic mobility and joint activation routine tailored to that day's lifts.

---

### Phase 4: B2B2C Physio & Coach Revenue Flywheel
*Monetizing post-discharge patient care for Physical Therapists and Coaches.*

* **Feature 4.1: Post-Discharge Rehab Dashboard for PTs (`/coach`)**
  * Patient management portal to prescribe home strength routines, monitor compliance, and track pain trends after clinical discharge.
* **Feature 4.2: Bulk Client Codes / Seat Licensing**
  * B2B wholesale client license packs (5, 10, 25 seats) via Stripe Connect for PTs to bundle into their recurring services.
* **Feature 4.3: Coach-Client Async Review & Pain Alerts**
  * Async communication channel with automated high-priority alerts when a patient logs pain level > 4/10 during an active workout.

---

## 3. Multi-Agent Orchestration Protocol

When executing tasks via Hermes CLI as subagents:
* **Orchestrator**: Antigravity (Pair programming with developer, planning, diff verification, testing).
* **Executor Subagent**: Local Hermes CLI (`/Users/rasoul/.local/bin/hermes`) running default `opencode-go/glm-5.3-flash`.
* **Execution Command Pattern**:
  ```bash
  HERMES_NONINTERACTIVE=1 HERMES_ACCEPT_HOOKS=1 /Users/rasoul/.local/bin/hermes -z "<SUBTASK_PROMPT>" --accept-hooks
  ```
