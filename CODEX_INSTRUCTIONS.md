# CODEX WORKFLOW: PhysioCoach AI Simplicity Refactoring

Please follow this exact checklist step-by-step to refactor the **PhysioCoach AI API** (`physiocoach-ai-api`) from DDD/Clean Architecture layers into a flat, direct architecture with a resilient database-hydrated workout generator.

---

## 🛠️ Step 1: Core Database and Middleware Setup

- [ ] **1.1. Create Drizzle Schema**
  - **Path**: `src/db/schema.ts`
  - **Action**: Copy the contents of `src/infrastructure/db/schema.ts` directly into this file. Do not use re-exports. Fix internal relative imports.

- [ ] **1.2. Create Drizzle Client**
  - **Path**: `src/db/client.ts`
  - **Action**: Write the direct Drizzle client creation:
    ```typescript
    import { drizzle } from 'drizzle-orm/d1';
    import * as schema from './schema';
    
    export function createDb(database: D1Database) {
      return drizzle(database, { schema });
    }
    ```

- [ ] **1.3. Create Clerk Auth Middleware**
  - **Path**: `src/middleware/clerk-auth.ts`
  - **Action**: Move the file from `src/infrastructure/auth/clerk-auth.middleware.ts` to this path.
  - **Fix Compile Error**: Update the environment value resolver at line 290 to cast to `unknown` first:
    ```typescript
    const direct = (env as unknown as Record<string, string | undefined> | undefined)?.[name];
    ```

- [ ] **1.4. Create CORS matching logic**
  - **Path**: `src/middleware/cors.ts`
  - **Action**: Move the CORS logic from `src/infrastructure/http/cors.ts` here.

---

## 📦 Step 2: Shared Types and Calculators

- [ ] **2.1. Extract Shared Schemas**
  - Create the following files in `src/types/` and move the Zod schemas from their old domain locations:
    - [ ] `src/types/assessment.ts` (from `src/domains/assessment/assessment.ts`)
    - [ ] `src/types/profile.ts` (from `src/domains/profile/profile.ts`)
    - [ ] `src/types/settings.ts` (from `src/domains/settings/settings.ts`)
    - [ ] `src/types/workout.ts` (from `src/domains/workout/workout.schemas.ts`)

- [ ] **2.2. Extract Progress Calculator**
  - **Path**: `src/services/progress-calculator.ts`
  - **Action**: Move the calculation logic (streak, volume, compliance, plateau detection) from `src/domains/progress/progress.ts`.

- [ ] **2.3. Extract Settings Helpers**
  - **Path**: `src/services/settings-helpers.ts`
  - **Action**: Move default values and merging logic from `src/domains/settings/settings.ts`.

---

## ⚡ Step 3: Resilient Workout Generator Service

- [ ] **3.1. Implement Workout Generator Service**
  - **Path**: `src/services/workout-generator.ts`
  - **Action**: Implement from scratch to handle candidate loading, OpenRouter fetch, database-backed hydration, and deterministic fallbacks:
    ```typescript
    import { and, eq, isNotNull } from 'drizzle-orm';
    import { masterExercises, masterEquipment, exerciseEquipment } from '../db/schema';
    import { createDb } from '../db/client';
    
    // 1. Fetch D1 catalog exercises and pre-filter based on user equipment, limitations, and experience level
    export async function getFilteredCatalogCandidates(db: any, context: any) {
      const dbRows = await db
        .select({
          id: masterExercises.id,
          canonicalId: masterExercises.canonicalId,
          name: masterExercises.name,
          movementPattern: masterExercises.movementPattern,
          equipmentCanonicalId: masterEquipment.canonicalId,
          recommendedLevel: masterExercises.recommendedLevel,
          excludedLimitationsJson: masterExercises.excludedLimitationsJson,
        })
        .from(masterExercises)
        .leftJoin(exerciseEquipment, eq(exerciseEquipment.exerciseId, masterExercises.id))
        .leftJoin(masterEquipment, eq(exerciseEquipment.equipmentId, masterEquipment.id));
        
      // Aggregate and filter in-memory to keep prompt tokens small (< 1.5 KB)
      // Exclude exercises matching user limitations and unsupported levels/equipment.
      // Return a list of 15-25 candidate exercises.
    }
    
    // 2. Fetch plan from OpenRouter using a short prompt and simple system schema enforcer
    export async function generateAIWorkoutPlan(env: any, userPrompt: string) {
      const primaryModel = env.WORKOUT_MODEL_PRIMARY;
      const fallbackModel = 'openrouter/owl-alpha';
      
      const makeRequest = async (model: string) => {
        const res = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': env.OPENROUTER_REFERER,
            'X-Title': env.OPENROUTER_TITLE,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: `You are an AI physiotherapy coach. Generate a structured workout plan using ONLY the provided exercise IDs. 
    You MUST return strictly valid JSON matching this schema:
    {
      "name": "Plan Name",
      "focus": "Overall Focus",
      "days": [
        {
          "dayNumber": 1,
          "name": "Day 1",
          "focus": "Day Focus",
          "exercises": [
            {
              "id": "exercise-id",
              "sets": 3,
              "reps": "8-12",
              "restSeconds": 60,
              "notes": "Execution note"
            }
          ]
        }
      ]
    }`
              },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: "json_object" }
          })
        });
        if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
        return res.json();
      };
      
      try {
        return await makeRequest(primaryModel);
      } catch (e) {
        return await makeRequest(fallbackModel);
      }
    }
    
    // 3. Hydrate AI response using full database catalog metadata (guarantees data consistency)
    export function hydrateWorkoutPlan(aiPlan: any, candidates: any[]) {
      const candidateMap = new Map(candidates.map(c => [c.canonicalId, c]));
      for (const day of aiPlan.days) {
        for (const ex of day.exercises) {
          const match = candidateMap.get(ex.id);
          if (match) {
            ex.name = match.name;
            ex.movementPattern = match.movementPattern;
            ex.masterExerciseId = match.id;
          }
        }
      }
      return aiPlan;
    }
    
    // 4. Fallback generator: builds a personalized, static workout plan if AI request fails
    export function generateDeterministicWorkoutPlan(context: any, candidates: any[]) {
      // Build a standard Push/Pull/Legs or Full-body split programmatically using candidates
      // Return a fully completed plan matching the frontend structure.
    }
    ```

---

## 🔀 Step 4: Flat Hono Routes Setup

Create route files flatly in `src/routes/` and execute database queries using Drizzle directly in route handlers:

- [ ] **4.1. `src/routes/admin.ts`**
  - Group admin routes here. Inline `hasAdminRole` directly.

- [ ] **4.2. `src/routes/assessments.ts`**
  - Implement GET `/assessments/latest` and POST `/assessments` directly querying the Drizzle database.

- [ ] **4.3. `src/routes/body-measurements.ts`**
  - Inline queries from `body-measurement.repository.ts` directly into the Hono endpoint handlers.

- [ ] **4.4. `src/routes/exercise-catalog.ts`**
  - Query `masterExercises` and `exerciseMedia` directly.

- [ ] **4.5. `src/routes/health.ts`**
  - Health check and OpenAPI Swagger UI handler.
  - **Fix Compile Errors**:
    - Instantiate the OpenAPI document properly:
      ```typescript
      const { createOpenApiDocument } = await import('../shared/openapi');
      const openApiDocument = createOpenApiDocument();
      return c.json(openApiDocument);
      ```
    - Resolve the missing variables from Hono context:
      ```typescript
      const appEnv = c.env.APP_ENV;
      const localAuthBypassValue = c.env.LOCAL_AUTH_BYPASS_TOKEN;
      ```

- [ ] **4.6. `src/routes/profiles.ts`**
  - Inline `getLatestProfileForUser` and `upsertUserAndProfile` Drizzle queries directly.

- [ ] **4.7. `src/routes/progress.ts`**
  - Inline queries and pass rows to `src/services/progress-calculator.ts` to compute metrics.

- [ ] **4.8. `src/routes/settings.ts`**
  - Inline Drizzle queries from `settings.repository.ts` and merge configurations.

- [ ] **4.9. `src/routes/workout-sessions.ts`**
  - Inline workout session database logging and completions.

- [ ] **4.10. `src/routes/workout-plans.ts`**
  - Integrates asynchronous plan generation (using `c.executionCtx.waitUntil`) and job polling. Call the services in `src/services/workout-generator.ts` to fetch, generate, hydrate, or fallback.

---

## 🏁 Step 5: Application Entry and Cleanup

- [ ] **5.1. Update Hono Routing (`src/app.ts`)**
  - Import new routes from `src/routes/` and middlewares from `src/middleware/`.
  - Register routers flatly.

- [ ] **5.2. Update Worker Handler (`src/index.ts`)**
  - Align imports with the new flat directory structure.

- [ ] **5.3. Clean Obsolete Folders**
  - Once compilation succeeds, delete the nested directories:
    - `src/application/`
    - `src/domains/`
    - `src/infrastructure/`

---

## 🔍 Step 6: Compilation and Verification

- [ ] **6.1. Build Backend**: Run `pnpm build` in `physiocoach-ai-api`. Confirm zero compilation errors.
- [ ] **6.2. Validate Backend**: Run `pnpm validate` in `physiocoach-ai-api` to run tests and linter.
- [ ] **6.3. Generate Frontend API**: Run `pnpm generate:api` in `physiocoach-ai-web` to sync types.
- [ ] **6.4. Build Frontend**: Run `pnpm build` in `physiocoach-ai-web`. Confirm clean frontend type matching.
