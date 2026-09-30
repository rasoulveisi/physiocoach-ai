import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { isAuthError } from '../auth/errors';

type HttpError = Error & { status?: number; auditLogId?: string };

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

function resolveStatusCode(error: unknown, candidate: HttpError): number {
  if (error instanceof ZodError) return 400;
  if (isAuthError(error)) return error.statusCode;
  if (typeof candidate.status === 'number' && candidate.status >= 400 && candidate.status < 600) {
    return candidate.status;
  }
  return 500;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  void _next;
  const candidate: HttpError =
    error instanceof Error ? error : new Error('Unexpected API error.');
  const status = resolveStatusCode(error, candidate);
  const traceId = req.traceId || crypto.randomUUID();
  const auditLogId = candidate.auditLogId || req.auditLogId || null;

  if (status >= 500) {
    console.error('request.failed', { traceId, auditLogId, error: candidate.message });
  }

  res
    .status(status)
    .type('application/problem+json')
    .json({
      type: `https://physiocoach.otconnect.ir/problems/${status}`,
      title: STATUS_TITLES[status] || 'Request Failed',
      detail: candidate.message || 'Unexpected API error.',
      instance: req.originalUrl,
      traceId,
      auditLogId,
      ...(error instanceof ZodError ? { errors: error.issues } : {}),
    });
};
