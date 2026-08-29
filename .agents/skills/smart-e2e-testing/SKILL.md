---
name: physiocoach-smart-e2e
description: >-
  Smart end-to-end integration testing skill for PhysioCoach AI.
  Guides full-stack testing combining React 19 PWA frontend workflow, Cloudflare Worker backend execution,
  live Neon PostgreSQL database validation via Hyperdrive, and OpenRouter AI audit log verification.
---

# PhysioCoach AI: Smart End-to-End Testing Skill

This skill governs how to perform **Smart End-to-End (E2E) Integration Testing** across the PhysioCoach AI stack like a real athlete or physical therapist, without using synthetic unit mocks or dummy fallbacks.

---

## E2E Architecture & Concurrent Execution

1. **Neon PostgreSQL via Hyperdrive**: Always connect to the live Neon PostgreSQL database via Cloudflare Hyperdrive connection pooling.
2. **Concurrent Full-Stack Dev Server**:
   - **Backend API Worker**: `http://localhost:8787` (`npm run dev` in `physiocoach-ai-api`)
   - **Frontend React 19 PWA**: `http://localhost:5173` (`npm run dev` in `physiocoach-ai-web`)

---

## 5-Step Smart E2E Test Workflow

### Step 1: Obtain Active Local Authentication Token
Exchange a local dev OAuth session to get a valid JWT Bearer token:
```bash
TOKEN=$(curl -sS -X POST -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"provider":"google","code":"local-dev-code","state":"local-dev-state"}' \
  "http://localhost:8787/api/v1/auth/oauth/exchange" | node -e 'console.log(JSON.parse(fs.readFileSync(0, "utf-8")).accessToken)')
```

### Step 2: Save User Profile & Onboarding Assessment
Simulate user completing profile onboarding:
```bash
curl -sS -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"age":30,"sex":"prefer_not_to_say","heightCm":175,"weightKg":75,"lifestyle":"desk_job","experienceLevel":"beginner","bodyFatEstimate":24}' \
  "http://localhost:8787/api/v1/profile"
```

### Step 3: Trigger Live AI Workout Plan Generation
Submit user assessment payload to request catalog-backed AI workout plan generation:
```bash
GEN_RES=$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"profile":{"age":30,"sex":"prefer_not_to_say","heightCm":175,"weightKg":75,"lifestyle":"desk_job","experienceLevel":"beginner","bodyFatEstimate":30},"assessment":{"goals":["muscle_gain","fat_loss"],"frequencyDays":3,"equipment":["full_gym"],"considerations":[{"code":"rounded_shoulders","severity":"mild","side":"unspecified","inferred":false}],"limitations":[],"postureFlags":[]}}' \
  "http://localhost:8787/api/v1/workout-plans/generate")
```

### Step 4: Verify Real AI Response & Traceability
Inspect returned payload:
- Ensure `HTTP 200 OK`.
- Confirm `data.source === "ai"`.
- Confirm `data.generation.fallbackUsed === false`.
- Confirm presence of `traceId` and `auditLogId`.

### Step 5: Query AI Provider Audit Logs via API (`GET /api/v1/ai-audit-logs`)
Fetch exact LLM prompt, prompt tokens, completion tokens, latency, and raw response from PostgreSQL table `ai_audit_logs`:
```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8787/api/v1/ai-audit-logs?limit=1"
```

---

## Automated Validation Suite

Run validation across both packages:
```bash
# Backend validation (linter + typecheck + vitest)
cd physiocoach-ai-api && npm run validate

# Frontend validation (typecheck + vite build)
cd physiocoach-ai-web && npm run build
```
