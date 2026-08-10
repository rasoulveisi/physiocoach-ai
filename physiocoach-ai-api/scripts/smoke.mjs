/* global fetch, AbortController, setTimeout, clearTimeout, URL */
import process from 'node:process';

const args = new Map(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const targetArg = args.get('target') || args.get('env') || 'all';
const token =
  process.env.AUTH_ACCESS_TOKEN ||
  process.env.PHYSIOCOACH_ACCESS_TOKEN ||
  process.env.API_SMOKE_TOKEN ||
  '';
const timeoutMs = Number.parseInt(process.env.API_SMOKE_TIMEOUT_MS || '12000', 10);

const activeCatalogId = process.env.API_SMOKE_ACTIVE_CATALOG_ID?.trim() || '';

const envTargets = {
  dev: {
    name: 'dev',
    baseUrl: 'https://physiocoach-ai-api-dev.otconnect.ir/api/v1',
    webOrigin: 'https://dev.physiocoach-ai-web.pages.dev',
  },
  prod: {
    name: 'prod',
    baseUrl: 'https://physiocoach-ai-api.otconnect.ir/api/v1',
    webOrigin: 'https://physiocoach.otconnect.ir',
  },
};

const targets = targetArg === 'all' ? Object.values(envTargets) : [envTargets[targetArg]];

if (!targets[0]) {
  console.error(`Unknown target "${targetArg}". Use: dev | prod | all.`);
  process.exit(1);
}

let failed = false;
let expectedChecks = 0;
let passed = 0;

async function request(url, { method = 'GET', headers = {}, body, signal } = {}) {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal,
    redirect: 'manual',
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { response, text, json };
}

function buildHeaders(authToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

function summary(name, ok, details) {
  console[ok ? 'log' : 'error'](`${ok ? '✅' : '❌'} [${name}] ${ok ? 'PASS' : 'FAIL'} ${details}`);
}

/** Validate the catalog coverage contract used by the admin smoke endpoint. */
export function validateCatalogHealth(health) {
  if (!health || typeof health !== 'object') return false;

  const sourceRecordCount = health.sourceRecordCount;
  const publishedExerciseCount = health.publishedExerciseCount;
  const coverageComplete = health.coverageComplete;
  const unresolvedConflicts = health.unresolvedConflicts;

  return (
    typeof health.activeCatalogId === 'string' &&
    health.activeCatalogId.length > 0 &&
    sourceRecordCount === 1324 &&
    typeof publishedExerciseCount === 'number' &&
    publishedExerciseCount > 0 &&
    coverageComplete === true &&
    unresolvedConflicts === 0
  );
}

/** Validate the coverage result returned by GET /admin/catalogs/:id/coverage. */
export function validateCatalogCoverage(coverage, catalogId) {
  if (!coverage || typeof coverage !== 'object') return false;
  return (
    coverage.catalogVersionId === catalogId &&
    coverage.status === 'active' &&
    coverage.ready === true &&
    Array.isArray(coverage.blockers) &&
    coverage.blockers.length === 0 &&
    coverage.coverage?.totalExercises > 0 &&
    coverage.coverage?.totalExercises === coverage.coverage?.approvedExercises &&
    coverage.coverage?.totalExercises === coverage.coverage?.completeExercises &&
    coverage.coverage?.activeConsiderations > 0
  );
}

/** Check that the published consideration catalog contains the required safety options. */
export function validateRequiredConsiderations(considerations) {
  if (!Array.isArray(considerations)) return false;
  const codes = new Set(considerations.map((consideration) => consideration?.code));
  return ['knee_pain', 'lower_back_pain', 'high_impact_intolerance'].every((code) =>
    codes.has(code),
  );
}

/** A severe-knee safety fixture must never expose a red/avoid exercise to the plan. */
export function validateSevereKneePlan(plan, redExerciseIds) {
  const generatedPlan = plan?.data;
  const exercises = Array.isArray(generatedPlan?.plan?.days)
    ? generatedPlan.plan.days.flatMap((day) => (Array.isArray(day?.exercises) ? day.exercises : []))
    : [];
  if (!Array.isArray(redExerciseIds) || redExerciseIds.length === 0) return false;
  if (!redExerciseIds.every((id) => typeof id === 'string' && id.trim())) return false;
  const redIds = new Set(redExerciseIds);
  return (
    typeof generatedPlan?.id === 'string' &&
    generatedPlan.id.trim() &&
    exercises.length > 0 &&
    exercises.every(
      (exercise) =>
        typeof exercise?.masterExerciseId === 'string' &&
        exercise.masterExerciseId.trim() &&
        !redIds.has(exercise.masterExerciseId),
    )
  );
}

const severeKneeProfile = {
  age: 35,
  sex: 'prefer_not_to_say',
  heightCm: 170,
  weightKg: 70,
  lifestyle: 'desk_job',
  experienceLevel: 'beginner',
};

async function withTimeout(callback) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function toYMD(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function runTarget(target) {
  const { name, baseUrl, webOrigin } = target;
  const authToken = token.trim();

  try {
    const healthUrl = `${baseUrl}/health`;
    expectedChecks += 1;
    const healthResult = await withTimeout((signal) =>
      request(healthUrl, {
        method: 'GET',
        signal,
      }),
    );
    const healthOk = healthResult.response.status === 200 && healthResult.json?.ok === true;
    summary(name, healthOk, `GET ${healthUrl} -> ${healthResult.response.status}`);
    if (!healthOk) throw new Error('health check failed');
    passed += 1;

    const preflightUrl = `${baseUrl}/workout-plans/current`;
    expectedChecks += 1;
    const preflightResult = await withTimeout((signal) =>
      request(preflightUrl, {
        method: 'OPTIONS',
        headers: {
          Origin: webOrigin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
        signal,
      }),
    );
    const preflightOk =
      preflightResult.response.status === 204 || preflightResult.response.status === 200;
    summary(
      name,
      preflightOk,
      `OPTIONS ${preflightUrl} -> ${preflightResult.response.status} (CORS preflight path)`,
    );
    if (!preflightOk) throw new Error('preflight check failed');
    passed += 1;

    if (!authToken) {
      summary(name, true, 'skip auth-bound checks because token was not provided');
      return;
    }

    const headers = buildHeaders(authToken);
    if (!activeCatalogId) {
      throw new Error(
        'API_SMOKE_ACTIVE_CATALOG_ID is required for authenticated catalog coverage checks',
      );
    }

    expectedChecks += 1;
    const catalogCoverageUrl = `${baseUrl}/admin/catalogs/${encodeURIComponent(activeCatalogId)}/coverage`;
    const catalogCoverageResult = await withTimeout((signal) =>
      request(catalogCoverageUrl, { method: 'GET', headers, signal }),
    );
    const catalogCoverageOk =
      catalogCoverageResult.response.status === 200 &&
      validateCatalogCoverage(catalogCoverageResult.json?.data, activeCatalogId) &&
      validateCatalogHealth({
        activeCatalogId,
        sourceRecordCount: catalogCoverageResult.json?.data?.sourceRecordCount,
        publishedExerciseCount: catalogCoverageResult.json?.data?.coverage?.totalExercises,
        coverageComplete:
          catalogCoverageResult.json?.data?.coverage?.completeExercises ===
          catalogCoverageResult.json?.data?.coverage?.totalExercises,
        unresolvedConflicts: catalogCoverageResult.json?.data?.blockers?.filter(
          (blocker) => blocker?.code === 'unresolved_safety_conflicts',
        ).length,
      });
    summary(
      name,
      catalogCoverageOk,
      `GET ${catalogCoverageUrl} -> ${catalogCoverageResult.response.status} (ready coverage)`,
    );
    if (!catalogCoverageOk) throw new Error('active catalog coverage check failed');
    passed += 1;

    expectedChecks += 1;
    const considerationsUrl = `${baseUrl}/considerations`;
    const considerationsResult = await withTimeout((signal) =>
      request(considerationsUrl, { method: 'GET', headers, signal }),
    );
    const considerationsOk =
      considerationsResult.response.status === 200 &&
      validateRequiredConsiderations(considerationsResult.json?.data);
    summary(
      name,
      considerationsOk,
      `GET ${considerationsUrl} -> ${considerationsResult.response.status} (required active considerations)`,
    );
    if (!considerationsOk) throw new Error('required active considerations are missing');
    passed += 1;

    expectedChecks += 1;
    const redExercisesUrl = `${baseUrl}/admin/catalogs/${encodeURIComponent(activeCatalogId)}/red-exercises?consideration=knee_pain&severity=severe`;
    const redExercisesResult = await withTimeout((signal) =>
      request(redExercisesUrl, { method: 'GET', headers, signal }),
    );
    const redExerciseIds = redExercisesResult.json?.data?.exerciseIds;
    const redExercisesOk =
      redExercisesResult.response.status === 200 && Array.isArray(redExerciseIds);
    summary(
      name,
      redExercisesOk,
      `GET ${redExercisesUrl} -> ${redExercisesResult.response.status}`,
    );
    if (!redExercisesOk) throw new Error('severe-knee red exercise lookup failed');
    passed += 1;

    expectedChecks += 1;
    const severeKneePlanResult = await withTimeout((signal) =>
      request(`${baseUrl}/workout-plans/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          profile: severeKneeProfile,
          assessment: {
            goals: ['mobility'],
            frequencyDays: 2,
            equipment: ['dumbbells_only'],
            considerations: [
              { code: 'knee_pain', severity: 'severe', side: 'bilateral', inferred: false },
            ],
          },
        }),
        signal,
      }),
    );
    const severeKneePlanOk =
      severeKneePlanResult.response.status === 200 &&
      validateSevereKneePlan(severeKneePlanResult.json, redExerciseIds);
    summary(
      name,
      severeKneePlanOk,
      `POST ${baseUrl}/workout-plans/generate (severe knee) -> ${severeKneePlanResult.response.status}`,
    );
    if (!severeKneePlanOk) throw new Error('severe-knee plan contains a red exercise');
    passed += 1;

    expectedChecks += 1;
    const currentPlanResult = await withTimeout((signal) =>
      request(`${baseUrl}/workout-plans/current`, {
        method: 'GET',
        headers,
        signal,
      }),
    );
    const hasPlan = currentPlanResult.response.status === 200 && currentPlanResult.json?.data;
    summary(
      name,
      currentPlanResult.response.status === 200 || currentPlanResult.response.status === 404,
      `GET ${baseUrl}/workout-plans/current -> ${currentPlanResult.response.status}`,
    );
    if (currentPlanResult.response.status === 200 && !hasPlan) {
      summary(name, false, 'current plan response missing data payload');
      throw new Error('malformed current plan response');
    }
    if (!hasPlan) {
      summary(name, true, `No existing plan yet for ${name}; skip session smoke path.`);
      return;
    }

    const plan = currentPlanResult.json.data;
    const planId = plan.id;
    const dayIndex = 0;
    const scheduledDate = toYMD(new Date());
    const idempotencyKey = `${planId}:${dayIndex}:${scheduledDate}`;
    const createPayload = JSON.stringify({
      workoutPlanId: planId,
      dayIndex,
      scheduledDate,
    });

    const createSessionHeaders = {
      ...headers,
      'Idempotency-Key': idempotencyKey,
    };

    const sessionUrl = `${baseUrl}/workout-sessions`;

    expectedChecks += 1;
    const createSession1 = await withTimeout((signal) =>
      request(sessionUrl, {
        method: 'POST',
        headers: createSessionHeaders,
        body: createPayload,
        signal,
      }),
    );
    const session1Ok = createSession1.response.status === 200 && createSession1.json?.data?.id;
    summary(name, session1Ok, `POST ${sessionUrl} (create) -> ${createSession1.response.status}`);
    if (!session1Ok) throw new Error('workout session create failed');
    passed += 1;

    const sessionId = createSession1.json.data.id;

    expectedChecks += 1;
    const createSession2 = await withTimeout((signal) =>
      request(sessionUrl, {
        method: 'POST',
        headers: createSessionHeaders,
        body: createPayload,
        signal,
      }),
    );
    const session2Ok =
      createSession2.response.status === 200 && createSession2.json?.data?.id === sessionId;
    summary(
      name,
      session2Ok,
      `POST ${sessionUrl} (idempotent replay) -> ${createSession2.response.status}`,
    );
    if (!session2Ok) throw new Error('idempotent session create mismatch');
    passed += 1;
  } catch (error) {
    failed = true;
    summary(name, false, error.message);
  }
}

export async function main() {
  for (const target of targets) {
    await runTarget(target);
  }

  console.log(`Smoke completed: ${passed}/${expectedChecks} checks`);
  if (targetArg !== 'dev' && targetArg !== 'prod') {
    console.log('Tip: run target=dev or target=prod for single-environment smoke checks.');
  }
  if (!token.trim()) {
    console.log(
      'Tip: set AUTH_ACCESS_TOKEN and API_SMOKE_ACTIVE_CATALOG_ID to run auth-bound catalog checks.',
    );
  }

  if (failed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  await main();
}
