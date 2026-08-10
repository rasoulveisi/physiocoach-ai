import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { frontendGeneratePayloads } from './fixtures/frontend-generate-payloads';
import {
  GenerateApiOpenRouterLogger,
  installOpenRouterFetchLogger,
} from './support/generate-api-openrouter-logger';
import { loadOpenRouterIntegrationEnv } from './support/openrouter-integration-env';

type GeneratePlanResponseBody = {
  data?: unknown;
  error?: { code?: string; message?: string };
};

const logger = new GenerateApiOpenRouterLogger();
let restoreFetch: (() => void) | undefined;

const shouldRunOpenRouterIntegration =
  process.env.RUN_OPENROUTER_INTEGRATION === '1' ||
  process.env.RUN_OPENROUTER_INTEGRATION === 'true' ||
  process.env.npm_lifecycle_event === 'test:generate:openrouter';

describe.skipIf(!shouldRunOpenRouterIntegration)('Generate API OpenRouter integration', () => {
  const env = loadOpenRouterIntegrationEnv();
  const app = createApp();

  beforeAll(() => {
    restoreFetch = installOpenRouterFetchLogger(logger);
  });

  afterAll(() => {
    restoreFetch?.();
    const summary = logger.writeSummary();

    console.info(
      [
        `Generate API integration tests total: ${summary.total}`,
        `passed: ${summary.passed}`,
        `failed: ${summary.failed}`,
        `AI parse issue count: ${summary.aiParseIssues}`,
        `fallback usage count: ${summary.fallbackUsage}`,
        `provider fallback usage count: ${summary.providerFallbackUsage}`,
        `app fallback usage count: ${summary.appFallbackUsage}`,
        `deterministic fallback usage count: ${summary.deterministicFallbackUsage}`,
      ].join(' | '),
    );
  });

  it.each(frontendGeneratePayloads)(
    'generates a safe plan with real OpenRouter for frontend payload: $name',
    async ({ name, payload, source }) => {
      const openRouterRequestCount = logger.entries.filter(
        (entry) => entry.type === 'openrouter_request',
      ).length;

      logger.logGenerateApiRequest({
        fixtureName: name,
        source,
        payload,
      });

      let response: Response;
      let body: GeneratePlanResponseBody;

      try {
        response = await app.request(
          '/api/v1/workout-plans/generate',
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              origin: 'http://localhost:4200',
            },
            body: JSON.stringify(payload),
          },
          env,
        );
        body = (await response.json()) as GeneratePlanResponseBody;
      } catch (error) {
        logger.logBackendError({
          fixtureName: name,
          stage: 'request_or_response_json',
          error: describeUnknownError(error),
        });
        throw error;
      }

      const newOpenRouterRequests = logger.entries
        .filter((entry) => entry.type === 'openrouter_request')
        .slice(openRouterRequestCount)
        .map((entry) => entry.data)
        .filter(
          (data): data is { body?: unknown } =>
            typeof data === 'object' && data !== null && 'body' in data,
        );

      expect(newOpenRouterRequests).toHaveLength(0);

      if (response.ok) {
        logger.log('backend_response', {
          fixtureName: name,
          status: response.status,
          ok: response.ok,
          body,
        });
        logger.noteBackendDiagnostics({ body });
      } else {
        logger.logBackendError({
          fixtureName: name,
          status: response.status,
          ok: response.ok,
          body,
        });
      }

      try {
        expect(response.status).toBe(409);
        expect(body.data).toBeUndefined();
        expect((body as { error?: { code?: string; message?: string } }).error).toMatchObject({
          code: 'conflict',
          message: 'Workout plan generation requires DB persistence.',
        });
        logger.counters.passed += 1;
      } catch (error) {
        logger.counters.failed += 1;
        throw error;
      }
    },
    210_000,
  );
});

function describeUnknownError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
