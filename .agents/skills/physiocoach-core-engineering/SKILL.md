---
name: physiocoach-core-engineering
description: >-
  Core engineering, medical safety, and design system skill for PhysioCoach AI.
  Governs Cloudflare Workers + Express 5 API development, Drizzle ORM queries,
  medical-grade safety audits, and React 19 PWA precision hardware UI standards.
---

# PhysioCoach AI: Core Engineering & Medical Safety Skill

This skill defines the technical standards, architectural patterns, medical safety requirements, and design tokens for the entire PhysioCoach AI platform.

---

## 1. Full-Stack Architecture Standards

### Backend: Cloudflare Workers + Express 5 (`physiocoach-ai-api`)
* **Runtime**: Cloudflare Workers with Node compatibility (`wrangler dev --config ./wrangler.jsonc --remote --port 8787`).
* **Database**: Neon PostgreSQL accessed exclusively via Cloudflare Hyperdrive connection pooling.
* **Direct & Flat Queries**: Execute database queries using Drizzle ORM directly within `src/routes/` and `src/services/`.
  * **Rule**: No repository pattern abstractions.
  * **Rule**: No barrel files or `export * from './...'` re-exports. Import directly from implementation files.
* **Zero Frontend AI Calls**: The frontend never calls AI providers directly. All AI workout generation, safety audits, and reasoning flow through backend endpoints.

### Frontend: React 19 PWA (`physiocoach-ai-web`)
* **Framework**: React 19 + TypeScript + Vite + Tailwind CSS.
* **Routing**: React Router v6 (`src/router.tsx`).
* **State & Sync**: Direct React Context (`AuthContext`, etc.) and lightweight custom stores.
* **PWA & Offline**: Service worker caching and responsive gym-floor UI.

---

## 2. Medical Safety & Zero-Fallback Standard

* **Zero Synthetic Fallbacks**: Never return hardcoded or placeholder synthetic workout plans. If generation fails or constraints are violated, return a traceable HTTP `409 Conflict` or `500 Internal Error` with `traceId` and `auditLogId`.
* **Deterministic Exercise Safety Rules**:
  * Safety rules are conservative and monotonic (`recommended < caution < avoid`).
  * AI reasoning cannot weaken or bypass deterministic catalog restrictions (e.g. spine load, knee shear, shoulder impingement).
* **Auditability & Traceability**:
  * Every AI generation must persist full prompt, tokens, latency, and response into the PostgreSQL `ai_audit_logs` table.
  * Return `traceId` and `auditLogId` in API responses for clinical trust and debugging.

---

## 3. Precision Hardware Design System

* **Palette & Surfaces**:
  * **Base Background**: Matte Obsidian (`#090D15`)
  * **Surfaces & Cards**: Dark Titanium (`#121722` and `#181F2E`) with crisp 1px borders (`#1F2937` or `rgba(255,255,255,0.08)`)
  * **Volt Green (`#10E760`)**: Strictly for active tracking, running timers, completed sets, and primary action triggers.
  * **Physio Amber (`#F59E0B`)**: Strictly for clinical safety warnings, biomechanical posture cues, and contraindication flags.
  * **Ice Cyan (`#06B6D4`)**: Strictly for joint recovery metrics, mobility telemetry, and muscle recovery status.
* **Gym-Floor Usability**:
  * Lower 40% thumb zone for set logging and timer controls.
  * High-contrast tabular monospace figures (`font-mono tabular-nums`) readable from 2 meters away.
  * Fast steppers (`±2.5kg`, `±1 rep`), RPE strips, and circular rest timer rings.

---

## 4. Verification Quality Gates

Before finalizing any change:
* **Backend**: `npm run validate` in `physiocoach-ai-api` (runs lint + vitest + tsc typecheck).
* **Frontend**: `npm run build` in `physiocoach-ai-web` (runs tsc + vite production build).
