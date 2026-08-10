import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterProvider } from '../src/services/openrouter-provider';

describe('OpenRouterProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not attach an abort signal when request timeout is disabled', async () => {
    let capturedSignal: RequestInit['signal'];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedSignal = init?.signal;

        return Response.json({
          choices: [
            {
              message: {
                content: '{"ok":true}',
              },
            },
          ],
        });
      }),
    );

    const provider = new OpenRouterProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.test/api/v1',
    });

    const response = await provider.generateStructured({
      task: 'workout_plan',
      inputHash: 'abc',
      prompt: 'Build a safe plan',
      schema: z.object({ ok: z.literal(true) }),
      primaryModel: 'test/primary',
      fallbackModels: [],
      timeoutMs: 0,
    });

    expect(response.payload.ok).toBe(true);
    expect(capturedSignal).toBeUndefined();
  });

  it('sends the caller-provided strict JSON schema to OpenRouter', async () => {
    let capturedBody: Record<string, unknown> = {};

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

        return Response.json({
          choices: [
            {
              message: {
                content: '{"ok":true}',
              },
            },
          ],
        });
      }),
    );

    const provider = new OpenRouterProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.test/api/v1',
    });

    const response = await provider.generateStructured({
      task: 'workout_plan',
      inputHash: 'abc',
      prompt: 'Build a safe plan',
      schema: z.object({ ok: z.literal(true) }),
      responseFormat: {
        name: 'workout_plan',
        strict: true,
        schema: {
          type: 'object',
          properties: { ok: { const: true } },
          required: ['ok'],
          additionalProperties: false,
        },
      },
      primaryModel: 'test/primary',
      fallbackModels: [],
      timeoutMs: 1000,
    });

    expect(response.payload.ok).toBe(true);
    expect(capturedBody?.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'workout_plan',
        strict: true,
        schema: {
          type: 'object',
          properties: { ok: { const: true } },
          required: ['ok'],
          additionalProperties: false,
        },
      },
    });
  });

  it('extracts the first balanced JSON object when the model appends extra text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: '{"ok":true}\n{"extra":"commentary"}' } }],
        }),
      ),
    );

    const provider = new OpenRouterProvider({
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.test/api/v1',
    });

    const response = await provider.generateStructured({
      task: 'workout_plan',
      inputHash: 'abc',
      prompt: 'Return JSON',
      schema: z.object({ ok: z.literal(true) }),
      primaryModel: 'test/primary',
      timeoutMs: 1000,
    });

    expect(response.payload).toEqual({ ok: true });
  });
});
