import type { z } from 'zod';

import { invalidRequest } from '../shared/errors/api';
import type { ExpressRouteContext } from './express-adapter';

type ParseResult<T> =
  | {
      success: true;
      data: T;
      raw: unknown;
    }
  | {
      success: false;
      response: Response;
    };

export async function parseJsonPayload<TSchema extends z.ZodTypeAny>(
  c: ExpressRouteContext,
  schema: TSchema,
): Promise<ParseResult<z.output<TSchema>>> {
  const payload = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      success: false,
      response: invalidRequest(c, 'Request payload failed validation.', {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    };
  }

  return {
    success: true,
    data: parsed.data,
    raw: payload,
  };
}
