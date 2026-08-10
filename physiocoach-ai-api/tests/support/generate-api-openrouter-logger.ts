/// <reference types="node" />

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { redactSecrets } from './openrouter-integration-env';

export type GenerateApiOpenRouterLogEntryType =
  | 'generate_api_request'
  | 'openrouter_request'
  | 'openrouter_response'
  | 'backend_response'
  | 'backend_error'
  | 'test_summary';

export interface GenerateApiOpenRouterCounters {
  total: number;
  passed: number;
  failed: number;
  aiParseIssues: number;
  fallbackUsage: number;
  providerFallbackUsage: number;
  appFallbackUsage: number;
  deterministicFallbackUsage: number;
}

export interface GenerateApiOpenRouterLogEntry {
  type: GenerateApiOpenRouterLogEntryType;
  timestamp: string;
  data: unknown;
}

type FetchArgs = Parameters<typeof fetch>;
type MarkedFetch = typeof fetch & {
  [OPENROUTER_FETCH_LOGGER_MARKER]?: true;
};

const OPENROUTER_HOST_PATTERN = /(^|\.)openrouter\.ai$/i;
const CHAT_COMPLETIONS_PATH_PATTERN = /\/chat\/completions\/?$/i;
const AI_PARSE_ISSUE_PATTERN =
  /parse|parsing|schema|missing required sections|missing required safety\/progression sections|structured_plan_validation/i;
const GENERIC_PROVIDER_OR_PARSE_WARNING = 'AI generation provider or parsing failed.';
const DETERMINISTIC_VALIDATION_FAILURE_WARNING =
  /^Generation failure reason:\s*(?:quality|safety|progression_rule)_validation$/i;
const OPENROUTER_FETCH_LOGGER_MARKER = Symbol.for(
  'physiocoach.generate-api-openrouter.fetch-logger',
);

export class GenerateApiOpenRouterLogger {
  readonly entries: GenerateApiOpenRouterLogEntry[] = [];
  readonly counters: GenerateApiOpenRouterCounters = {
    total: 0,
    passed: 0,
    failed: 0,
    aiParseIssues: 0,
    fallbackUsage: 0,
    providerFallbackUsage: 0,
    appFallbackUsage: 0,
    deterministicFallbackUsage: 0,
  };
  private currentPrimaryOpenRouterModel: string | undefined;
  private currentRequestUsedProviderFallback = false;
  private currentRequestUsedAppFallback = false;

  log(type: GenerateApiOpenRouterLogEntryType, data: unknown): GenerateApiOpenRouterLogEntry {
    const entry = {
      type,
      timestamp: new Date().toISOString(),
      data: redactSecrets(data),
    };
    this.entries.push(entry);
    return entry;
  }

  logGenerateApiRequest(data: unknown): GenerateApiOpenRouterLogEntry {
    this.counters.total += 1;
    this.currentPrimaryOpenRouterModel = undefined;
    this.currentRequestUsedProviderFallback = false;
    this.currentRequestUsedAppFallback = false;
    return this.log('generate_api_request', data);
  }

  logOpenRouterRequest(data: unknown): GenerateApiOpenRouterLogEntry {
    const model = getOpenRouterRequestModel(data);
    if (model) {
      if (!this.currentPrimaryOpenRouterModel) {
        this.currentPrimaryOpenRouterModel = model;
      } else if (model !== this.currentPrimaryOpenRouterModel) {
        this.markProviderFallbackUsage();
      }
    }

    return this.log('openrouter_request', data);
  }

  logOpenRouterResponse(data: unknown): GenerateApiOpenRouterLogEntry {
    return this.log('openrouter_response', data);
  }

  logBackendResponse(data: unknown): GenerateApiOpenRouterLogEntry {
    if (isBackendSuccess(data)) {
      this.counters.passed += 1;
    } else {
      this.counters.failed += 1;
    }

    this.noteBackendDiagnostics(data);

    return this.log('backend_response', data);
  }

  logBackendError(data: unknown): GenerateApiOpenRouterLogEntry {
    this.counters.failed += 1;

    this.noteBackendDiagnostics(data);

    return this.log('backend_error', data);
  }

  noteBackendDiagnostics(data: unknown): void {
    if (hasBackendFallbackSource(data)) {
      this.markAppFallbackUsage();
    }

    if (hasBackendParseIssue(data)) {
      this.counters.aiParseIssues += 1;
    }
  }

  writeSummary(): GenerateApiOpenRouterCounters {
    const summary = { ...this.counters };
    this.log('test_summary', summary);

    const outputDir = resolve(process.cwd(), 'test-results/generate-api-openrouter');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      resolve(outputDir, 'latest.jsonl'),
      `${this.entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
      'utf8',
    );
    writeFileSync(
      resolve(outputDir, 'latest-summary.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8',
    );

    return summary;
  }

  private markProviderFallbackUsage(): void {
    if (this.currentRequestUsedProviderFallback) {
      return;
    }

    this.currentRequestUsedProviderFallback = true;
    this.counters.providerFallbackUsage += 1;
  }

  private markAppFallbackUsage(): void {
    if (this.currentRequestUsedAppFallback) {
      return;
    }

    this.currentRequestUsedAppFallback = true;
    this.counters.appFallbackUsage += 1;
    this.counters.deterministicFallbackUsage += 1;
    this.counters.fallbackUsage += 1;
  }
}

export function installOpenRouterFetchLogger(logger: GenerateApiOpenRouterLogger): () => void {
  if (isOpenRouterFetchLoggerInstalled(globalThis.fetch)) {
    return () => undefined;
  }

  const originalFetch = globalThis.fetch;
  const wrappedFetch = (async (...args: FetchArgs): Promise<Response> => {
    const [input, init] = args;
    const openRouterUrl = getOpenRouterChatCompletionUrl(input, init);

    if (!openRouterUrl) {
      return originalFetch(...args);
    }

    try {
      const requestBody = await readRequestBody(input, init);
      logger.logOpenRouterRequest({
        url: openRouterUrl.toString(),
        method: init?.method ?? (input instanceof Request ? input.method : undefined),
        body: requestBody.parsed,
        rawBody: requestBody.parsed === undefined ? requestBody.text : undefined,
        messages: extractMessages(requestBody.parsed),
      });
    } catch (error) {
      logger.logOpenRouterRequest({
        url: openRouterUrl.toString(),
        bodyReadError: describeUnknownError(error),
      });
    }

    const response = await originalFetch(...args);
    try {
      const responseText = await response.clone().text();
      logger.logOpenRouterResponse({
        url: openRouterUrl.toString(),
        status: response.status,
        ok: response.ok,
        body: parseJsonOrText(responseText),
        rawBody: responseText,
      });
    } catch (error) {
      logger.logOpenRouterResponse({
        url: openRouterUrl.toString(),
        status: response.status,
        ok: response.ok,
        bodyReadError: describeUnknownError(error),
      });
    }

    return response;
  }) as MarkedFetch;
  wrappedFetch[OPENROUTER_FETCH_LOGGER_MARKER] = true;
  globalThis.fetch = wrappedFetch;

  return () => {
    if (globalThis.fetch === wrappedFetch) {
      globalThis.fetch = originalFetch;
    }
  };
}

function isOpenRouterFetchLoggerInstalled(fetchFn: typeof fetch): boolean {
  return (fetchFn as MarkedFetch)[OPENROUTER_FETCH_LOGGER_MARKER] === true;
}

function isBackendSuccess(data: unknown): boolean {
  const status = readNumericProperty(data, 'status');
  if (status !== undefined) {
    return status >= 200 && status < 400;
  }

  const ok = readBooleanProperty(data, 'ok');
  return ok ?? true;
}

function hasBackendFallbackSource(value: unknown): boolean {
  const body = readRecordProperty(value, 'body');
  const data = readRecordProperty(body, 'data');
  return data?.source === 'fallback';
}

function hasBackendResponseAiParseIssue(value: unknown): boolean {
  const body = readRecordProperty(value, 'body');
  const data = readRecordProperty(body, 'data');

  return collectWarningStrings(data)
    .concat(collectWarningStrings(body), collectWarningStrings(value))
    .some(isAiParseIssueText);
}

function hasBackendParseIssue(value: unknown): boolean {
  return hasBackendResponseAiParseIssue(value) || hasBackendErrorAiParseIssue(value);
}

function hasBackendErrorAiParseIssue(value: unknown): boolean {
  return collectErrorIssueStrings(value).some(isAiParseIssueText);
}

function getOpenRouterRequestModel(value: unknown): string | undefined {
  const body = readRecordProperty(value, 'body');
  const model = body?.model;
  return typeof model === 'string' && model.trim().length > 0 ? model : undefined;
}

function isAiParseIssueText(text: string): boolean {
  const normalized = text.trim();
  if (
    normalized === GENERIC_PROVIDER_OR_PARSE_WARNING ||
    normalized.startsWith('Provider error:') ||
    normalized.startsWith('Provider attempts before fallback:') ||
    normalized.startsWith('Provider model at failure:') ||
    normalized.startsWith('Provider elapsed before failure:') ||
    normalized.startsWith('Provider configured timeout:') ||
    normalized.startsWith('Provider app abort signal attached:') ||
    DETERMINISTIC_VALIDATION_FAILURE_WARNING.test(normalized) ||
    /^Generation failure reason:\s*provider_(?:error|auth_error)$/i.test(normalized)
  ) {
    return false;
  }

  return AI_PARSE_ISSUE_PATTERN.test(normalized);
}

function getOpenRouterChatCompletionUrl(input: RequestInfo | URL, init?: RequestInit): URL | null {
  const url = resolveFetchUrl(input);
  if (!url) {
    return null;
  }

  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'POST') {
    return null;
  }

  if (!OPENROUTER_HOST_PATTERN.test(url.hostname)) {
    return null;
  }

  return CHAT_COMPLETIONS_PATH_PATTERN.test(url.pathname) ? url : null;
}

function resolveFetchUrl(input: RequestInfo | URL): URL | null {
  try {
    if (input instanceof Request) {
      return new URL(input.url);
    }
    if (input instanceof URL) {
      return input;
    }
    return new URL(String(input));
  } catch {
    return null;
  }
}

async function readRequestBody(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ text: string | undefined; parsed: unknown }> {
  const initBody = await bodyToText(init?.body);
  if (initBody !== undefined) {
    return { text: initBody, parsed: parseJsonOrUndefined(initBody) };
  }

  if (input instanceof Request) {
    const requestBody = await input.clone().text();
    return { text: requestBody, parsed: parseJsonOrUndefined(requestBody) };
  }

  return { text: undefined, parsed: undefined };
}

async function bodyToText(body: BodyInit | null | undefined): Promise<string | undefined> {
  if (body === null || body === undefined) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof Blob) {
    return body.text();
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }

  if (ArrayBuffer.isView(body)) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof FormData) {
    return '[FormData]';
  }

  if (body instanceof ReadableStream) {
    return '[ReadableStream]';
  }

  return String(body);
}

function parseJsonOrText(text: string): unknown {
  return parseJsonOrUndefined(text) ?? text;
}

function parseJsonOrUndefined(text: string | undefined): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function extractMessages(body: unknown): unknown {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return undefined;
  }

  return body.messages;
}

function readNumericProperty(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const nested = value[key];
  return typeof nested === 'number' ? nested : undefined;
}

function readBooleanProperty(value: unknown, key: string): boolean | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const nested = value[key];
  return typeof nested === 'boolean' ? nested : undefined;
}

function readRecordProperty(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
}

function collectWarningStrings(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return collectStringsFromKnownField(value.warnings);
}

function collectErrorIssueStrings(value: unknown): string[] {
  if (!isRecord(value)) {
    return typeof value === 'string' ? [value] : [];
  }

  return [
    ...collectStringsFromKnownField(value.message),
    ...collectStringsFromKnownField(value.details),
    ...collectStringsFromKnownField(value.issues),
    ...collectStringsFromKnownField(readRecordProperty(value, 'error')?.message),
    ...collectStringsFromKnownField(readRecordProperty(value, 'error')?.details),
    ...collectStringsFromKnownField(readRecordProperty(value, 'error')?.issues),
    ...collectStringsFromKnownField(readRecordProperty(value, 'body')?.message),
    ...collectStringsFromKnownField(readRecordProperty(value, 'body')?.details),
    ...collectStringsFromKnownField(readRecordProperty(value, 'body')?.issues),
    ...collectStringsFromKnownField(
      readRecordProperty(readRecordProperty(value, 'body'), 'error')?.message,
    ),
    ...collectStringsFromKnownField(
      readRecordProperty(readRecordProperty(value, 'body'), 'error')?.details,
    ),
    ...collectStringsFromKnownField(
      readRecordProperty(readRecordProperty(value, 'body'), 'error')?.issues,
    ),
  ];
}

function collectStringsFromKnownField(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return [];
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringsFromKnownField(item, seen));
  }

  return Object.values(value).flatMap((item) => collectStringsFromKnownField(item, seen));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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
