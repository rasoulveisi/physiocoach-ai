import type { ExpressRouteContext } from '../../routes/express-adapter';

export type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 501 | 503;

export type ErrorCode =
  | 'internal_server_error'
  | 'invalid_request'
  | 'auth_persistence_unavailable'
  | 'rate_limited'
  | 'forbidden'
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'profile_not_found'
  | 'workout_plan_generation_failed'
  | 'invalid_session_data'
  | 'invalid_workout_plan_record';

interface ErrorResponsePayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

const AUTH_CONTEXT_ERROR_MESSAGE = 'Missing or invalid authenticated user context.';

function withRequestId(c: ExpressRouteContext, payload: ErrorResponsePayload): ErrorResponsePayload {
  const precomputedRequestId = (c as { get?: (key: string) => unknown }).get?.('requestId');
  if (typeof precomputedRequestId === 'string' && precomputedRequestId.length > 0) {
    return {
      ...payload,
      requestId: precomputedRequestId,
    };
  }

  const headerRequestId = c.req.header('x-request-id');
  if (typeof headerRequestId === 'string' && headerRequestId.length > 0) {
    return {
      ...payload,
      requestId: headerRequestId,
    };
  }

  const traceparent = c.req.header('traceparent');
  if (typeof traceparent === 'string') {
    const traceSegment = traceparent.split('-')[2];
    if (typeof traceSegment === 'string' && traceSegment.length > 0) {
      return {
        ...payload,
        requestId: traceSegment,
      };
    }
  }

  const requestId = crypto.randomUUID();
  return {
    ...payload,
    requestId,
  };
}

export function createApiError(
  c: ExpressRouteContext,
  code: ErrorCode,
  message: string,
  options: {
    status?: ErrorStatusCode;
    details?: unknown;
  } = {},
) {
  const status: ErrorStatusCode = options.status ?? errorStatusByCode(code);

  const payload: { error: ErrorResponsePayload } = {
    error: withRequestId(c, {
      code,
      message,
      ...(options.details === undefined ? {} : { details: options.details }),
    }),
  };

  return c.json(payload, status);
}

function errorStatusByCode(code: ErrorCode): ErrorStatusCode {
  switch (code) {
    case 'invalid_request':
      return 400;
    case 'auth_persistence_unavailable':
      return 503;
    case 'rate_limited':
      return 429;
    case 'profile_not_found':
    case 'workout_plan_generation_failed':
      return 409;
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'internal_server_error':
    default:
      return 500;
  }
}

export function internalServerError(
  c: ExpressRouteContext,
  message = 'Unexpected API error.',
  details?: unknown,
) {
  return createApiError(c, 'internal_server_error', message, { details });
}

export function invalidRequest(c: ExpressRouteContext, message: string, details?: unknown) {
  return createApiError(c, 'invalid_request', message, { details });
}

export function notFound(c: ExpressRouteContext, message: string) {
  return createApiError(c, 'not_found', message);
}

export function unauthorized(c: ExpressRouteContext, message: string) {
  return createApiError(c, 'unauthorized', message);
}

export function forbidden(c: ExpressRouteContext, message: string) {
  return createApiError(c, 'forbidden', message);
}

export function handleRouteError(
  c: ExpressRouteContext,
  error: unknown,
  fallbackMessage = 'Unexpected API error.',
) {
  if (error instanceof Error && error.message === AUTH_CONTEXT_ERROR_MESSAGE) {
    return unauthorized(c, AUTH_CONTEXT_ERROR_MESSAGE);
  }

  console.error('route.unhandled_error', {
    message: error instanceof Error ? error.message : 'Unknown error',
    name: error instanceof Error ? error.name : undefined,
    stack: error instanceof Error ? error.stack : undefined,
  });

  return internalServerError(
    c,
    fallbackMessage,
    error instanceof Error ? { message: error.message, stack: error.stack } : undefined,
  );
}

export function wrapRoute(
  c: ExpressRouteContext,
  operation: () => Promise<Response>,
  fallbackMessage = 'Unexpected API error.',
) {
  return operation().catch((error) => handleRouteError(c, error, fallbackMessage));
}
