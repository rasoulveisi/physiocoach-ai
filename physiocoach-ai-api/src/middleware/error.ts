import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { isAuthError } from '../auth/errors';

type HttpError = Error & { status?: number; auditLogId?: string };

const statusTitles: Record<number, string> = {
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

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  void next;
  const candidate: HttpError =
    error instanceof Error ? (error as HttpError) : new Error('Unexpected API error.');
  const status =
    error instanceof ZodError
      ? 400
      : isAuthError(error)
        ? error.statusCode
        : typeof candidate.status === 'number' && candidate.status >= 400 && candidate.status < 600
          ? candidate.status
          : 500;
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
      title: statusTitles[status] || 'Request Failed',
      status,
      detail: status >= 500 ? 'Unexpected API error.' : candidate.message,
      instance: req.originalUrl,
      traceId,
      auditLogId,
      ...(error instanceof ZodError ? { errors: error.issues } : {}),
    });
};
