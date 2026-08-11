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

export const DEFAULT_WORKOUT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const LOCAL_WORKOUT_MODEL = 'local-deterministic-v1';
export const DEFAULT_WORKOUT_TIMEOUT_MS = 180_000;
export const DEFAULT_WORKOUT_MAX_RETRIES = 0;
export const ALLOWED_WORKOUT_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'poolside/laguna-s-2.1:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'cohere/north-mini-code:free',
  'poolside/laguna-xs-2.1:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3-8b-instruct:free',
] as const;
export const DEFAULT_WORKOUT_FALLBACK_MODELS = [
  'poolside/laguna-s-2.1:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'cohere/north-mini-code:free',
  'poolside/laguna-xs-2.1:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.1-8b-instruct:free',
] as const;
export const WORKOUT_PRIMARY_ALLOWLIST = new Set<string>([
  ...ALLOWED_WORKOUT_MODELS,
  LOCAL_WORKOUT_MODEL,
]);
export const WORKOUT_MODEL_ALLOWLIST = new Set<string>(ALLOWED_WORKOUT_MODELS);
const WORKOUT_MAX_RETRIES_CAP = 0;

export const WORKOUT_PLAN_SYSTEM_PROMPT = `Act as a licensed physiotherapist and elite strength and conditioning coach designing safe, evidence-informed training plans. Return strict JSON only.
EXACT JSON SCHEMA: {"days": [{"dayNumber": 1, "name": "Day 1", "focus": "Focus", "exercises": [{"name": "Exercise Name", "masterExerciseId": "catalog_id", "sets": 3, "reps": "8-12", "restSeconds": 60, "notes": "Note"}]}]}.
Each day MUST contain 4 to 6 distinct exercises covering main and accessory movements. Top-level object may contain only "days". Do not include muscle groups, movement patterns, warnings, rationale, instructions, markdown, or prose. Do not include introductory text, or trailing markdown syntax blocks (like \`\`\`json). Output must initiate with '{' and terminate with '}'.`;

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

  return primaryModel === DEFAULT_WORKOUT_MODEL ? [...DEFAULT_WORKOUT_FALLBACK_MODELS] : [];
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
  const rawApiKey = (env.OPENROUTER_API_KEY ?? '').trim();
  if (!rawApiKey || rawApiKey === 'set-in-cloudflare-secret') {
    return createUnavailableProvider('OPENROUTER_API_KEY is not configured.');
  }
  if (!rawApiKey.startsWith(OPENROUTER_KEY_PREFIX)) {
    return createUnavailableProvider('OPENROUTER_API_KEY does not look valid.');
  }

  const timeoutMs = resolveTimeoutMs(env.OPENROUTER_TIMEOUT_MS);
  const maxRetries = resolveMaxRetries(env.OPENROUTER_MAX_RETRIES);
  const primaryModel = resolvePrimaryModel(env.WORKOUT_MODEL_PRIMARY);

  return createOpenRouterDirectProvider({
    apiKey: rawApiKey,
    baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    referer: env.OPENROUTER_REFERER ?? 'https://physiocoach.otconnect.ir',
    title: env.OPENROUTER_TITLE ?? 'PhysioCoach AI',
    defaultPrimaryModel: primaryModel,
    defaultTimeoutMs: timeoutMs,
    defaultMaxRetries: maxRetries,
  });
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

        return {
          model,
          payload,
          metadata,
        };
      } catch (error) {
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
      throw new Error(`OpenRouter request failed with ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OpenRouterChatCompletionResponse;
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('OpenRouter response did not include message content.');
    }
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

  const candidates = [
    cleaned,
    cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim(),
    cleaned.match(/(\{[\s\S]*\})/)?.[1]?.trim(),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      return JSON.parse(stripTrailingJsonCommas(candidate));
    } catch {
      // Try the next extraction candidate.
    }
  }

  throw new Error('OpenRouter response did not contain parseable JSON.');
}

function stripTrailingJsonCommas(value: string): string {
  return value.replace(/,\s*([}\]])/g, '$1');
}
