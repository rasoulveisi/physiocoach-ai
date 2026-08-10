import { describe, expect, it } from 'vitest';
import { GenerateApiOpenRouterLogger } from './generate-api-openrouter-logger';

describe('GenerateApiOpenRouterLogger', () => {
  it('counts provider fallback model usage once per generate request', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.logGenerateApiRequest({ fixtureName: 'fixture-a' });
    logger.logOpenRouterRequest({ body: { model: 'primary/model' } });
    logger.logOpenRouterRequest({ body: { model: 'fallback/model' } });
    logger.logOpenRouterRequest({ body: { model: 'fallback/model' } });

    expect(logger.counters.providerFallbackUsage).toBe(1);
    expect(logger.counters.appFallbackUsage).toBe(0);
    expect(logger.counters.fallbackUsage).toBe(0);
  });

  it('counts deterministic app fallback separately from provider fallback', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.logGenerateApiRequest({ fixtureName: 'fixture-a' });
    logger.logOpenRouterRequest({ body: { model: 'primary/model' } });
    logger.noteBackendDiagnostics({
      body: {
        data: {
          source: 'fallback',
          warnings: ['Provider error: AbortError: This operation was aborted'],
        },
      },
    });

    expect(logger.counters.providerFallbackUsage).toBe(0);
    expect(logger.counters.appFallbackUsage).toBe(1);
    expect(logger.counters.deterministicFallbackUsage).toBe(1);
    expect(logger.counters.fallbackUsage).toBe(1);
  });

  it('does not count ordinary response text as an AI parse issue', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.noteBackendDiagnostics({
      body: {
        data: {
          source: 'ai',
          plan: {
            summary: 'Safety-first full-body plan generated from structured sections.',
            warnings: ['Educational fitness recommendations only. Not medical advice.'],
          },
        },
      },
    });

    expect(logger.counters.aiParseIssues).toBe(0);
  });

  it('counts schema-related parser warnings as AI parse issues', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.noteBackendDiagnostics({
      body: {
        data: {
          source: 'fallback',
          warnings: ['AI payload parse failed: schema contract mismatch'],
        },
      },
    });

    expect(logger.counters.aiParseIssues).toBe(1);
  });

  it.each([
    'Generation failure reason: safety_validation',
    'Generation failure reason: quality_validation',
    'Generation failure reason: progression_rule_validation',
  ])('does not count deterministic %s fallback as an AI parse issue', (warning) => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.logGenerateApiRequest({ fixtureName: 'fixture-a' });
    logger.noteBackendDiagnostics({
      body: {
        data: {
          source: 'fallback',
          warnings: [warning],
        },
      },
    });

    expect(logger.counters.appFallbackUsage).toBe(1);
    expect(logger.counters.deterministicFallbackUsage).toBe(1);
    expect(logger.counters.fallbackUsage).toBe(1);
    expect(logger.counters.aiParseIssues).toBe(0);
  });

  it('counts structured validation as an AI parse issue', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.logGenerateApiRequest({ fixtureName: 'fixture-a' });
    logger.noteBackendDiagnostics({
      body: {
        data: {
          source: 'fallback',
          warnings: ['Generation failure reason: structured_plan_validation'],
        },
      },
    });

    expect(logger.counters.appFallbackUsage).toBe(1);
    expect(logger.counters.aiParseIssues).toBe(1);
  });

  it('counts parse issues from backend_error message/details/issues fields', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.logBackendError({
      fixtureName: 'fixture-a',
      body: {
        error: {
          message: 'AI generation failed after provider attempts.',
          issues: ['Could not parse AI payload: schema contract mismatch'],
        },
      },
    });

    expect(logger.counters.failed).toBe(1);
    expect(logger.counters.aiParseIssues).toBe(1);
  });

  it('preserves response_format while redacting secrets', () => {
    const logger = new GenerateApiOpenRouterLogger();

    logger.logOpenRouterRequest({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      body: {
        model: 'test/model',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'workout_plan',
            strict: true,
            schema: {
              type: 'object',
              properties: {},
            },
          },
        },
        authorization: 'sk-or-example-key',
      },
    });

    const entry = logger.entries.at(-1) as {
      data?: {
        body?: {
          response_format?: {
            type: string;
            json_schema?: {
              name: string;
              strict: boolean;
            };
          };
          authorization?: string;
        };
      };
    };

    expect(entry.data?.body?.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'workout_plan',
        strict: true,
      },
    });
    expect(entry.data?.body?.authorization).toBe('[REDACTED]');
  });
});
