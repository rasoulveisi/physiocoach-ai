import type {
  AIProvider,
  AITextResponse,
  AIStructuredResponse,
  GenerateStructuredRequest,
  GenerateWorkoutPlanRequest,
} from '../types/ai';
import { z } from 'zod';

interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl?: string;
  referer?: string;
  title?: string;
  defaultPrimaryModel?: string;
  defaultFallbackModels?: string[];
  defaultTimeoutMs?: number;
  defaultMaxRetries?: number;
}

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

interface OpenRouterErrorPayload {
  error?: {
    message?: string;
    code?: string | number;
  };
  code?: number | string;
}

const INVALID_MODEL_ERROR_PATTERN = /not a valid model id/i;

type OpenRouterDiagnosticError = Error & {
  attempts?: number;
  providerModel?: string;
  providerElapsedMs?: number;
  providerTimeoutMs?: number;
  providerUsedAbortSignal?: boolean;
  providerErrorName?: string;
};

export class OpenRouterProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly referer: string;
  private readonly title: string;
  private readonly defaultPrimaryModel: string;
  private readonly defaultFallbackModels: string[];
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;

  constructor(config: OpenRouterProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    this.referer = config.referer ?? 'https://physiocoach.otconnect.ir';
    this.title = config.title ?? 'PhysioCoach AI';
    this.defaultPrimaryModel = config.defaultPrimaryModel ?? 'meta-llama/llama-3.3-70b-instruct:free';
    this.defaultFallbackModels = config.defaultFallbackModels ?? [
      'google/gemma-2-9b-it:free',
      'qwen/qwen-2.5-72b-instruct:free',
    ];
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 180_000;
    this.defaultMaxRetries = config.defaultMaxRetries ?? 0;
  }

  async generateWorkoutPlan(request: GenerateWorkoutPlanRequest): Promise<AITextResponse> {
    const result = await this.generateStructured({
      task: 'workout_plan',
      inputHash: 'legacy',
      prompt: request.prompt,
      schema: z.unknown(),
      ...(request.primaryModel ? { primaryModel: request.primaryModel } : {}),
      ...(request.fallbackModels ? { fallbackModels: request.fallbackModels } : {}),
      ...(typeof request.timeoutMs === 'number' ? { timeoutMs: request.timeoutMs } : {}),
    });

    return {
      model: result.model,
      text: JSON.stringify(result.payload),
    };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<AIStructuredResponse<T>> {
    let attempts = 0;
    const model = request.primaryModel ?? this.defaultPrimaryModel;
    let lastError: unknown;
    const maxRetries = Math.max(0, this.defaultMaxRetries);

    for (let retry = 0; retry <= maxRetries; retry += 1) {
      attempts += 1;
      try {
        console.info('openrouter.generate_structured.attempt_start', {
          task: request.task,
          attempt: attempts,
          retry,
          model,
          timeoutMs: request.timeoutMs ?? this.defaultTimeoutMs,
          appTimeoutDisabled: (request.timeoutMs ?? this.defaultTimeoutMs) === 0,
          forceFresh: Boolean(request.options?.forceFresh),
        });
        const completion = await this.generateWithModel(
          model,
          request.prompt,
          request.timeoutMs,
          request.options?.forceFresh,
          request.responseFormat,
        );
        const parsedPayload = this.parseJsonPayload(completion.text);
        const payload = request.schema.parse(parsedPayload) as T;
        console.info('openrouter.generate_structured.success', {
          task: request.task,
          attempt: attempts,
          model,
          providerRequestId: completion.metadata.id,
          hasRawResponse: completion.metadata !== undefined,
        });
        console.debug('openrouter.generate_structured.raw_response', {
          task: request.task,
          model,
          rawResponse: completion.metadata,
        });

        return {
          model,
          metadata: {
            attempts,
            ...this.extractUsage(completion.metadata),
            providerRawResponse: completion.metadata,
          },
          payload,
        };
      } catch (error) {
        console.warn('openrouter.generate_structured.attempt_error', {
          task: request.task,
          attempt: attempts,
          retry,
          model,
          ...describeErrorForLog(error),
        });

        lastError = annotateErrorAttempts(error, attempts, request.task);

        if (!this.shouldRetry(error)) {
          throw lastError;
        }

        if (retry >= maxRetries) {
          break;
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error(
      `OpenRouter structured generation failed for model ${model} after ${attempts} attempts.`,
    );
  }

  private async generateWithModel(
    model: string,
    prompt: string,
    timeoutMs?: number,
    forceFresh?: boolean,
    responseFormat?: GenerateStructuredRequest<unknown>['responseFormat'],
  ): Promise<{ text: string; metadata: OpenRouterChatCompletionResponse }> {
    const resolvedTimeoutMs = timeoutMs ?? this.defaultTimeoutMs;
    const controller = resolvedTimeoutMs > 0 ? new AbortController() : undefined;
    const timeout = controller
      ? setTimeout(() => controller.abort(), resolvedTimeoutMs)
      : undefined;
    const startedAt = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.referer,
          'X-Title': this.title,
        },
        body: JSON.stringify({
          model,
          ...(forceFresh ? { seed: Math.floor(Math.random() * 1_000_000_000) } : {}),
          messages: [
            {
              role: 'system',
              content:
                'You are a safety-first fitness assistant. Return strict JSON only, no markdown, no explanation.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          ...(model.includes('nemotron')
            ? {}
            : {
                response_format: responseFormat
                  ? { type: 'json_schema', json_schema: responseFormat }
                  : { type: 'json_object' },
              }),
          temperature: 0.2,
          max_tokens: 6000,
          stream: false,
        }),
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const parsedError = parseOpenRouterError(errorBody);
        const providerMessage = buildProviderErrorMessage(parsedError, response.status);
        const statusError = new Error(
          `OpenRouter request failed with ${response.status}: ${providerMessage}`,
        ) as Error & {
          retryable: boolean;
          tryNextModel?: boolean;
          providerStatus?: number;
          providerError?: string;
        };
        statusError.retryable = shouldRetryStatus(response.status, providerMessage);
        statusError.tryNextModel = shouldTryNextModelStatus(response.status, providerMessage);
        statusError.providerStatus = response.status;
        if (parsedError.error?.message) {
          statusError.providerError = parsedError.error.message;
        }
        if (parsedError.code !== undefined) {
          statusError.providerError = `${statusError.providerError}: ${parsedError.code}`;
        }
        throw statusError;
      }

      const data = (await response.json()) as OpenRouterChatCompletionResponse &
        OpenRouterErrorPayload;
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        if (data.error?.message) {
          throw new Error(
            `OpenRouter error: ${data.error.message} (code: ${data.error.code ?? 'unknown'})`,
          );
        }
        throw new Error('OpenRouter response did not include message content.');
      }

      return {
        text,
        metadata: data,
      };
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      annotateProviderDiagnostics(error, {
        model,
        elapsedMs,
        timeoutMs: resolvedTimeoutMs,
        usedAbortSignal: Boolean(controller),
      });

      console.warn('openrouter.fetch.error', {
        model,
        elapsedMs,
        timeoutMs: resolvedTimeoutMs,
        appTimeoutDisabled: resolvedTimeoutMs === 0,
        usedAbortSignal: Boolean(controller),
        ...describeErrorForLog(error),
      });

      throw error;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof Error && Object.hasOwn(error, 'retryable')) {
      return Boolean((error as { retryable?: boolean }).retryable);
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }

    if (error instanceof SyntaxError) {
      return false;
    }

    return true;
  }

  private shouldTryNextModel(error: unknown): boolean {
    if (error instanceof Error && Object.hasOwn(error, 'tryNextModel')) {
      return Boolean((error as { tryNextModel?: boolean }).tryNextModel);
    }

    return false;
  }

  private parseJsonPayload(text: string): unknown {
    const cleaned = text
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();

    if (!cleaned) {
      throw new Error('OpenRouter response content is empty.');
    }

    try {
      return this.unwrapIfArray(JSON.parse(cleaned));
    } catch {
      // Ignore and try repairs
    }

    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      const fenceContent = (fenceMatch[1] ?? '').trim();
      try {
        return this.unwrapIfArray(JSON.parse(fenceContent));
      } catch {
        try {
          return this.unwrapIfArray(JSON.parse(this.cleanTrailingCommas(fenceContent)));
        } catch {
          // Fall through to general extraction
        }
      }
    }

    const balancedValue = extractFirstBalancedJsonValue(cleaned);
    if (balancedValue) {
      try {
        return this.unwrapIfArray(JSON.parse(balancedValue));
      } catch {
        try {
          return this.unwrapIfArray(JSON.parse(this.cleanTrailingCommas(balancedValue)));
        } catch {
          // Fall through to general extraction
        }
      }
    }

    const objectMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (objectMatch) {
      const objStr = (objectMatch[1] ?? '').trim();
      try {
        return this.unwrapIfArray(JSON.parse(objStr));
      } catch {
        try {
          return this.unwrapIfArray(JSON.parse(this.cleanTrailingCommas(objStr)));
        } catch {
          // Ignore
        }
      }
    }

    const arrayMatch = cleaned.match(/(\[[\s\S]*\])/);
    if (arrayMatch) {
      const arrStr = (arrayMatch[1] ?? '').trim();
      try {
        return this.unwrapIfArray(JSON.parse(arrStr));
      } catch {
        try {
          return this.unwrapIfArray(JSON.parse(this.cleanTrailingCommas(arrStr)));
        } catch {
          // Ignore
        }
      }
    }

    throw new Error(
      `OpenRouter response did not contain parseable JSON (length=${cleaned.length}, startsWith=${JSON.stringify(cleaned.slice(0, 1))}, endsWith=${JSON.stringify(cleaned.slice(-1))}).`,
    );
  }

  private unwrapIfArray(val: unknown): unknown {
    if (Array.isArray(val) && val.length === 1 && val[0] && typeof val[0] === 'object') {
      return val[0];
    }
    return val;
  }

  private cleanTrailingCommas(str: string): string {
    return str.replace(/,\s*([}\]])/g, '$1');
  }

  private extractUsage(response: OpenRouterChatCompletionResponse) {
    const baseMetadata: { providerRequestId?: string } = {};
    if (response.id) {
      baseMetadata.providerRequestId = response.id;
    }

    if (!response.usage) {
      return baseMetadata;
    }

    const usage: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    } = {};

    if (typeof response.usage.prompt_tokens === 'number') {
      usage.promptTokens = response.usage.prompt_tokens;
    }
    if (typeof response.usage.completion_tokens === 'number') {
      usage.completionTokens = response.usage.completion_tokens;
    }
    if (typeof response.usage.total_tokens === 'number') {
      usage.totalTokens = response.usage.total_tokens;
    }

    if (Object.keys(usage).length === 0) {
      return baseMetadata;
    }

    return {
      ...baseMetadata,
      usage,
    };
  }
}

function extractFirstBalancedJsonValue(text: string): string | null {
  const start = [...text].findIndex((character) => character === '{' || character === '[');
  if (start < 0) return null;

  const opening = text[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function annotateErrorAttempts(error: unknown, attempts: number, task: string): Error {
  if (error instanceof Error) {
    (error as OpenRouterDiagnosticError).attempts = attempts;
    return error;
  }

  const wrappedError = new Error(
    `OpenRouter structured generation failed for task ${task}.`,
  ) as OpenRouterDiagnosticError;
  wrappedError.attempts = attempts;
  return wrappedError;
}

function annotateProviderDiagnostics(
  error: unknown,
  details: {
    model: string;
    elapsedMs: number;
    timeoutMs: number;
    usedAbortSignal: boolean;
  },
) {
  if (!(error instanceof Error)) {
    return;
  }

  const diagnosticError = error as OpenRouterDiagnosticError;
  diagnosticError.providerModel = details.model;
  diagnosticError.providerElapsedMs = details.elapsedMs;
  diagnosticError.providerTimeoutMs = details.timeoutMs;
  diagnosticError.providerUsedAbortSignal = details.usedAbortSignal;
  diagnosticError.providerErrorName = error.name;
}

function describeErrorForLog(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorName: typeof error,
      errorMessage: 'Non-Error exception',
    };
  }

  const diagnosticError = error as OpenRouterDiagnosticError & { attempts?: number };
  return {
    errorName: error.name,
    errorMessage: error.message,
    attempts: diagnosticError.attempts,
    providerModel: diagnosticError.providerModel,
    providerElapsedMs: diagnosticError.providerElapsedMs,
    providerTimeoutMs: diagnosticError.providerTimeoutMs,
    providerUsedAbortSignal: diagnosticError.providerUsedAbortSignal,
    providerErrorName: diagnosticError.providerErrorName,
  };
}

function parseOpenRouterError(errorText: string): OpenRouterErrorPayload {
  try {
    return JSON.parse(errorText) as OpenRouterErrorPayload;
  } catch {
    return { error: { message: errorText || 'Unknown OpenRouter error.' } };
  }
}

function buildProviderErrorMessage(parsed: OpenRouterErrorPayload, status: number): string {
  const nestedMessage = parsed.error?.message;
  const nestedCode = parsed.error?.code;
  if (nestedMessage && nestedCode !== undefined) {
    return `${nestedMessage} (code:${nestedCode})`;
  }
  if (nestedMessage) {
    return nestedMessage;
  }
  if (parsed.code !== undefined) {
    return `provider_code=${parsed.code}`;
  }
  return `status ${status} (unparseable error body)`;
}

function shouldRetryStatus(status: number, providerMessage = ''): boolean {
  if (status === 400 && INVALID_MODEL_ERROR_PATTERN.test(providerMessage)) {
    return false;
  }
  if (status === 429) {
    return false;
  }
  if (status >= 500) {
    return true;
  }
  if (status === 408 || status === 503 || status === 504) {
    return true;
  }
  return false;
}

function shouldTryNextModelStatus(status: number, providerMessage = ''): boolean {
  return status === 429 || (status === 400 && INVALID_MODEL_ERROR_PATTERN.test(providerMessage));
}
