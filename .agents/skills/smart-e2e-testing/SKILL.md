---
name: physiocoach-smart-e2e
description: >-
  Smart end-to-end integration testing skill for PhysioCoach AI.
  Guides full-stack testing combining Angular frontend workflow, Cloudflare Worker backend execution,
  real production D1 database validation, and OpenRouter AI audit log verification.
---

# PhysioCoach AI: Smart End-to-End Testing Skill

This skill governs how to perform **Smart End-to-End (E2E) Integration Testing** across the PhysioCoach AI stack like a real user, without using synthetic unit mocks or dummy fallbacks.

---

## E2E Architecture & Concurrent Execution

1. **Single Production Database**: Always connect to the live production Cloudflare D1 database (`physiocoach_prod`).
2. **Concurrent Monorepo Launcher**: Run both local backend Worker (connected to production D1) and Angular PWA concurrently:
   ```bash
   npm start # or npm run dev (in project root)
   ```
   - **Backend API**: `http://localhost:8787` (`npx wrangler dev --config ./wrangler.toml --remote`)
   - **Frontend App**: `http://localhost:4300` (`ng serve --port 4300`)

---

## 5-Step Smart E2E Test Workflow

### Step 1: Obtain Active Local Authentication Token
Exchange a local dev OAuth session to get a valid JWT Bearer token:
```bash
TOKEN=$(curl -sS -X POST -H "Origin: http://localhost:4300" \
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

### Step 5: Query AI Provider Audit Logs via API (`GET /api/v1/ai-audit-logs`)
Fetch exact LLM prompt, prompt tokens, completion tokens, latency, and raw response from D1 table `ai_audit_logs`:
```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8787/api/v1/ai-audit-logs?limit=1"
```

---

## Automated Vitest Behavior Suite

Run the full automated E2E behavior suite:
```bash
npm test # in physiocoach-ai-api
```
Includes:
- `tests/e2e/workout-plan-generation-workflow.test.ts`
- `tests/e2e/assessment-and-profile.test.ts`
- `tests/e2e/medical-error-traceability.test.ts`
- `tests/e2e/exercise-media-mapping.test.ts`
- `tests/e2e/ai-audit-logs.test.ts`
