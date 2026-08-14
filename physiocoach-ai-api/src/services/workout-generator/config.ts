import { z } from 'zod';
import type {
  AIProvider,
  AIStructuredResponse,
  GenerateStructuredRequest,
  GenerateWorkoutPlanRequest,
} from '../../types/ai';
import type {
  WorkoutPlanModelConfig,
  WorkoutPlanProviderConfig,
} from '../../types/workout-generator';

const OPENROUTER_KEY_PREFIX = 'sk-or-';
type ConfigNumericValue = string | number | undefined;

interface OpenRouterChatCompletionResponse {
  [key: string]: unknown;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  id?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export const DEFAULT_WORKOUT_MODEL = 'meta-llama/llama-3.1-8b-instruct';
export const LOCAL_WORKOUT_MODEL = 'local-deterministic-v1';
export const DEFAULT_WORKOUT_TIMEOUT_MS = 15_000;
export const DEFAULT_WORKOUT_MAX_RETRIES = 0;
export const ALLOWED_WORKOUT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.1-8b-instruct',
  'meta-llama/llama-3.3-70b-instruct',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'poolside/laguna-s-2.1:free',
  'liquid/lfm-2.5-2.6b:free',
  'nvidia/nemotron-3.5-lightning:free',
] as const;
export const DEFAULT_WORKOUT_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'meta-llama/llama-3.1-8b-instruct',
  'meta-llama/llama-3.3-70b-instruct',
  'nvidia/nemotron-3-nano-30b-a3b:free',
] as const;
export const WORKOUT_PRIMARY_ALLOWLIST = new Set<string>([...ALLOWED_WORKOUT_MODELS]);
export const WORKOUT_MODEL_ALLOWLIST = new Set<string>(ALLOWED_WORKOUT_MODELS);
const WORKOUT_MAX_RETRIES_CAP = 0;

export const WORKOUT_PLAN_SYSTEM_PROMPT = `Act as a licensed physiotherapist and elite strength and conditioning coach designing safe, evidence-informed training plans. Return strict JSON only.
EXACT JSON SCHEMA: {"days": [{"dayNumber": 1, "name": "Day 1", "focus": "Focus", "exercises": [{"name": "Exercise Name", "masterExerciseId": "catalog_id", "sets": 3, "reps": "8-12", "restSeconds": 60, "notes": "Note"}]}]}.
Each day MUST contain 4 to 6 distinct exercises covering main and accessory movements. CRITICAL: You MUST select exercise names and masterExerciseIds ONLY from the provided Approved green exercise ID map ({movement:{id:name}}). Do NOT invent or output exercises that are not in the approved map! Top-level object may contain only "days". Do not include muscle groups, movement patterns, warnings, rationale, instructions, markdown, or prose. Do not include introductory text, or trailing markdown syntax blocks (like \`\`\`json). Output must initiate with '{' and terminate with '}'.`;

function parseIntegerConfig(value: ConfigNumericValue, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function resolveTimeoutMs(timeoutMs: ConfigNumericValue): number {
  const parsed = parseIntegerConfig(timeoutMs, DEFAULT_WORKOUT_TIMEOUT_MS);
  return parsed <= 0 ? DEFAULT_WORKOUT_TIMEOUT_MS : parsed;
}

function resolveMaxRetries(maxRetries: ConfigNumericValue): number {
  const parsed = parseIntegerConfig(maxRetries, DEFAULT_WORKOUT_MAX_RETRIES);
  return Math.max(0, Math.min(parsed, WORKOUT_MAX_RETRIES_CAP));
}

function resolvePrimaryModel(primaryModelRaw: string | undefined): string {
  return primaryModelRaw && WORKOUT_PRIMARY_ALLOWLIST.has(primaryModelRaw)
    ? primaryModelRaw
    : DEFAULT_WORKOUT_MODEL;
}

function resolveFallbackModels(fallbackRaw: string | undefined, primaryModel: string): string[] {
  const explicitFallbacks = splitModelList(fallbackRaw).filter((model) =>
    WORKOUT_MODEL_ALLOWLIST.has(model),
  );
  const fallbackSet = new Set(explicitFallbacks);
  fallbackSet.delete(primaryModel);

  const fallbackModels = Array.from(fallbackSet);
  if (fallbackModels.length > 0) {
    return fallbackModels;
  }

  return DEFAULT_WORKOUT_FALLBACK_MODELS.filter((model) => model !== primaryModel);
}

function splitModelList(value: string | undefined): string[] {
  return value
    ? value
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean)
    : [];
}

function createUnavailableProvider(message: string): AIProvider {
  return {
    generateWorkoutPlan: async () => {
      throw new Error(message);
    },
    generateStructured: async () => {
      throw new Error(message);
    },
  };
}

export function buildWorkoutPlanModelConfig(
  env: Partial<WorkoutPlanProviderConfig>,
): WorkoutPlanModelConfig {
  const primaryModel = resolvePrimaryModel(env.WORKOUT_MODEL_PRIMARY);
  const timeoutMs = resolveTimeoutMs(env.OPENROUTER_TIMEOUT_MS);
  const maxRetries = resolveMaxRetries(env.OPENROUTER_MAX_RETRIES);

  return {
    primaryModel,
    fallbackModels: resolveFallbackModels(env.WORKOUT_MODEL_FALLBACKS, primaryModel),
    timeoutMs,
    maxRetries,
  };
}

export function createWorkoutPlanProvider(env: Partial<WorkoutPlanProviderConfig>): AIProvider {
  const geminiApiKey = (env.GEMINI_API_KEY ?? '').trim();
  const openRouterApiKey = (env.OPENROUTER_API_KEY ?? '').trim();
  const timeoutMs = resolveTimeoutMs(env.OPENROUTER_TIMEOUT_MS);
  const maxRetries = resolveMaxRetries(env.OPENROUTER_MAX_RETRIES);
  const primaryModel = resolvePrimaryModel(env.WORKOUT_MODEL_PRIMARY);

  const googleProvider =
    geminiApiKey && geminiApiKey !== 'set-in-cloudflare-secret'
      ? createGoogleAIStudioProvider({ apiKey: geminiApiKey, defaultTimeoutMs: timeoutMs })
      : null;

  const openRouterProvider =
    openRouterApiKey &&
    openRouterApiKey !== 'set-in-cloudflare-secret' &&
    openRouterApiKey.startsWith(OPENROUTER_KEY_PREFIX)
      ? createOpenRouterDirectProvider({
          apiKey: openRouterApiKey,
          baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
          referer: env.OPENROUTER_REFERER ?? 'https://physiocoach.otconnect.ir',
          title: env.OPENROUTER_TITLE ?? 'PhysioCoach AI',
          defaultPrimaryModel: primaryModel,
          defaultTimeoutMs: timeoutMs,
          defaultMaxRetries: maxRetries,
        })
      : null;

  if (!googleProvider && !openRouterProvider) {
    return createUnavailableProvider('Neither GEMINI_API_KEY nor OPENROUTER_API_KEY is configured.');
  }

  console.info('workout_plan.provider.configuration', {
    hasGoogleProvider: Boolean(googleProvider),
    hasOpenRouterProvider: Boolean(openRouterProvider),
    primaryModel,
    timeoutMs,
    maxRetries,
  });

  const isGoogleNativeModel = (model: string) =>
    model.startsWith('gemini-') || (model.startsWith('gemma-') && !model.includes('/'));

  async function generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<AIStructuredResponse<T>> {
    const model = request.primaryModel ?? primaryModel;

    if (isGoogleNativeModel(model) && googleProvider) {
      return googleProvider.generateStructured(request);
    }

    if (openRouterProvider) {
      return openRouterProvider.generateStructured(request);
    }

    if (googleProvider) {
      return googleProvider.generateStructured(request);
    }

    throw new Error(`No provider available to handle model ${model}.`);
  }

  return {
    async generateWorkoutPlan(request: GenerateWorkoutPlanRequest) {
      const response = await generateStructured<unknown>({
        task: 'workout_plan',
        inputHash: 'legacy',
        prompt: request.prompt,
        schema: z.unknown(),
        ...(request.primaryModel ? { primaryModel: request.primaryModel } : {}),
        ...(typeof request.timeoutMs === 'number' ? { timeoutMs: request.timeoutMs } : {}),
      });

      return {
        model: response.model,
        text: JSON.stringify(response.payload),
      };
    },
    generateStructured,
  };
}

function createOpenRouterDirectProvider(config: {
  apiKey: string;
  baseUrl: string;
  referer: string;
  title: string;
  defaultPrimaryModel: string;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
}): AIProvider {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  async function generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<AIStructuredResponse<T>> {
    const model = request.primaryModel ?? config.defaultPrimaryModel;
    const maxRetries = Math.max(0, config.defaultMaxRetries);
    let lastError: unknown;

    for (let retry = 0; retry <= maxRetries; retry += 1) {
      try {
        console.info('workout_plan.provider.openrouter.request_start', {
          model,
          task: request.task,
          retry,
          maxRetries,
          promptLength: request.prompt.length,
          timeoutMs: request.timeoutMs ?? config.defaultTimeoutMs,
          forceFresh: Boolean(request.options?.forceFresh),
        });

        const response = await fetchOpenRouterJson({
          apiKey: config.apiKey,
          baseUrl,
          referer: config.referer,
          title: config.title,
          model,
          prompt: request.prompt,
          timeoutMs: request.timeoutMs ?? config.defaultTimeoutMs,
          ...(request.options?.forceFresh !== undefined
            ? { forceFresh: request.options.forceFresh }
            : {}),
        });
        const payload = request.schema.parse(
          parseOpenRouterJsonPayload(response.choices?.[0]?.message?.content),
        ) as T;
        const metadata: NonNullable<AIStructuredResponse<T>>['metadata'] = {
          attempts: retry + 1,
          providerRawResponse: response,
        };
        if (response.id) {
          metadata.providerRequestId = response.id;
        }
        if (response.usage) {
          metadata.usage = {
            ...(typeof response.usage.prompt_tokens === 'number'
              ? { promptTokens: response.usage.prompt_tokens }
              : {}),
            ...(typeof response.usage.completion_tokens === 'number'
              ? { completionTokens: response.usage.completion_tokens }
              : {}),
            ...(typeof response.usage.total_tokens === 'number'
              ? { totalTokens: response.usage.total_tokens }
              : {}),
          };
        }

        console.info('workout_plan.provider.openrouter.response', {
          model,
          task: request.task,
          retry,
          providerRequestId: response.id,
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens,
          payloadChars: JSON.stringify(payload).length,
        });

        return {
          model,
          payload,
          metadata,
        };
      } catch (error) {
        console.warn('workout_plan.provider.openrouter.request_failed', {
          model,
          task: request.task,
          retry,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        lastError = error;
        if (retry >= maxRetries) {
          break;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`OpenRouter request failed for model ${model}.`);
  }

  return {
    async generateWorkoutPlan(request: GenerateWorkoutPlanRequest) {
      const response = await generateStructured<unknown>({
        task: 'workout_plan',
        inputHash: 'legacy',
        prompt: request.prompt,
        schema: z.unknown(),
        ...(request.primaryModel ? { primaryModel: request.primaryModel } : {}),
        ...(typeof request.timeoutMs === 'number' ? { timeoutMs: request.timeoutMs } : {}),
      });

      return {
        model: response.model,
        text: JSON.stringify(response.payload),
      };
    },
    generateStructured,
  };
}

async function fetchOpenRouterJson(input: {
  apiKey: string;
  baseUrl: string;
  referer: string;
  title: string;
  model: string;
  prompt: string;
  timeoutMs: number;
  forceFresh?: boolean;
}): Promise<OpenRouterChatCompletionResponse> {
  const controller = input.timeoutMs > 0 ? new AbortController() : undefined;
  const timeout = controller ? setTimeout(() => controller.abort(), input.timeoutMs) : undefined;

  try {
    console.info('workout_plan.provider.openrouter.fetch_request', {
      model: input.model,
      baseUrl: input.baseUrl,
      promptLength: input.prompt.length,
      timeoutMs: input.timeoutMs,
      forceFresh: Boolean(input.forceFresh),
    });

    const response = await fetch(`${input.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': input.referer,
        'X-Title': input.title,
      },
      body: JSON.stringify({
        model: input.model,
        ...(input.forceFresh ? { seed: Math.floor(Math.random() * 1_000_000_000) } : {}),
        messages: [
          {
            role: 'system',
            content: WORKOUT_PLAN_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: input.prompt,
          },
        ],
        ...(input.model.includes('nemotron') ? {} : { response_format: { type: 'json_object' } }),
        temperature: 0.2,
        max_tokens: 6000,
        stream: false,
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn('workout_plan.provider.openrouter.http_error', {
        model: input.model,
        status: response.status,
        bodyPreview: body.slice(0, 500),
      });
      throw new Error(`OpenRouter request failed with ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OpenRouterChatCompletionResponse;
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('OpenRouter response did not include message content.');
    }

    console.info('workout_plan.provider.openrouter.fetch_response', {
      model: input.model,
      requestId: data.id,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
      contentLength: data.choices?.[0]?.message?.content?.length ?? 0,
    });

    return data;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseOpenRouterJsonPayload(text: string | undefined): unknown {
  const cleaned = (text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!cleaned) {
    throw new Error('OpenRouter response content is empty.');
  }

  const extractedObj = extractJsonObjectString(cleaned);

  const candidates = [
    cleaned,
    cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    extractedObj,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(stripTrailingJsonCommas(candidate));
      return normalizeWorkoutPlanPayload(parsed);
    } catch {
      // Try the next extraction candidate.
    }
  }

  throw new Error('OpenRouter response did not contain parseable JSON.');
}

function normalizeWorkoutPlanPayload(parsed: unknown): unknown {
  if (Array.isArray(parsed)) {
    return { days: parsed };
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.days)) {
      return { days: obj.days };
    }
    for (const key of ['workoutPlan', 'plan', 'data', 'workout_plan', 'result']) {
      const val = obj[key];
      if (Array.isArray(val)) {
        return { days: val };
      }
      if (
        typeof val === 'object' &&
        val !== null &&
        Array.isArray((val as Record<string, unknown>).days)
      ) {
        return { days: (val as Record<string, unknown>).days };
      }
    }
  }
  return parsed;
}

function extractJsonObjectString(text: string): string | null {
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < text.length; i += 1) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return text.slice(firstBrace, i + 1);
        }
      }
    }
  }

  return null;
}

function stripTrailingJsonCommas(value: string): string {
  return value.replace(/,\s*([}\]])/g, '$1');
}

function createGoogleAIStudioProvider(config: {
  apiKey: string;
  defaultTimeoutMs: number;
}): AIProvider {
  async function generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<AIStructuredResponse<T>> {
    const model = request.primaryModel ?? 'gemini-3.5-flash-lite';
    const timeoutMs = request.timeoutMs ?? config.defaultTimeoutMs;
    const controller = timeoutMs > 0 ? new AbortController() : undefined;
    const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

    try {
      console.info('workout_plan.provider.google.request_start', {
        model,
        task: request.task,
        promptLength: request.prompt.length,
        timeoutMs,
      });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('workout_plan.provider.google.http_error', {
          model,
          status: response.status,
          bodyPreview: errorText.slice(0, 500),
        });
        throw new Error(`Google AI Studio error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!contentText) {
        throw new Error('Google AI Studio response contained no text content.');
      }

      const parsedJson = parseOpenRouterJsonPayload(contentText);
      const payload = request.schema.parse(parsedJson) as T;

      console.info('workout_plan.provider.google.response', {
        model,
        task: request.task,
        promptTokens: data.usageMetadata?.promptTokenCount,
        completionTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount,
        contentLength: contentText.length,
        payloadChars: JSON.stringify(payload).length,
      });

      return {
        model,
        payload,
        metadata: {
          attempts: 1,
          ...(data.usageMetadata
            ? {
                usage: {
                  ...(typeof data.usageMetadata.promptTokenCount === 'number'
                    ? { promptTokens: data.usageMetadata.promptTokenCount }
                    : {}),
                  ...(typeof data.usageMetadata.candidatesTokenCount === 'number'
                    ? { completionTokens: data.usageMetadata.candidatesTokenCount }
                    : {}),
                  ...(typeof data.usageMetadata.totalTokenCount === 'number'
                    ? { totalTokens: data.usageMetadata.totalTokenCount }
                    : {}),
                },
              }
            : {}),
        },
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return {
    async generateWorkoutPlan(request: GenerateWorkoutPlanRequest) {
      const response = await generateStructured<unknown>({
        task: 'workout_plan',
        inputHash: 'legacy',
        prompt: request.prompt,
        schema: z.unknown(),
        ...(request.primaryModel ? { primaryModel: request.primaryModel } : {}),
        ...(typeof request.timeoutMs === 'number' ? { timeoutMs: request.timeoutMs } : {}),
      });

      return {
        model: response.model,
        text: JSON.stringify(response.payload),
      };
    },
    generateStructured,
  };
}
