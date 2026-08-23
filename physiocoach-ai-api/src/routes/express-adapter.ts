import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response as ExpressResponse,
} from 'express';

import type { WorkerBindings } from '../env';
import { getDb } from '../db';

export interface ExpressRouteContext {
  env: WorkerBindings;
  req: {
    header(name: string): string | undefined;
    query(name: string): string | undefined;
    param(name: string): string;
    // Express JSON middleware has already parsed this value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json(): Promise<any>;
    url: string;
  };
  get(key: string): unknown;
  header(name: string, value: string): void;
  json(body: unknown, status?: number): globalThis.Response;
  redirect(url: string, status?: number): globalThis.Response;
  closeDb?(): Promise<void>;
}

type RouteHandler = (context: ExpressRouteContext) => globalThis.Response | Promise<globalThis.Response>;
type RouteMethod = (path: string, handler: RouteHandler) => ExpressRouter;

export interface ExpressRouter extends RequestHandler {
  get: RouteMethod;
  post: RouteMethod;
  patch: RouteMethod;
  delete: RouteMethod;
}

export function createExpressRouter(): ExpressRouter {
  const router = Router() as unknown as ExpressRouter;

  for (const method of ['get', 'post', 'patch', 'delete'] as const) {
    const register = Router.prototype[method].bind(router) as (
      path: string,
      handler: (req: Request, res: ExpressResponse, next: NextFunction) => Promise<void>,
    ) => ExpressRouter;

    Object.defineProperty(router, method, { value: ((path: string, handler: RouteHandler) =>
      register(path, async (req, res, next) => {
        const context = createRouteContext(req, res);
        try {
          const response = await handler(context);
          await sendWebResponse(res, response);
        } catch (error) {
          next(error);
        } finally {
          await context.closeDb?.();
        }
      })) as RouteMethod });
  }

  return router;
}

function createRouteContext(req: Request, res: ExpressResponse): ExpressRouteContext {
  const bindings = (req.app.locals.workerEnv ?? process.env) as unknown as WorkerBindings;
  let db: ReturnType<typeof getDb> | undefined;

  return {
    env: bindings,
    req: {
      header: (name) => req.header(name),
      query: (name) => {
        const value = req.query[name];
        return typeof value === 'string' ? value : undefined;
      },
      param: (name) => {
        const value = req.params[name];
        return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
      },
      json: async () => req.body,
      url: req.originalUrl,
    },
    get: (key) => {
      if (key === 'requestId') return req.traceId;
      if (key === 'authUser') return req.user;
      if (key === 'authSessionId') return req.authSessionId;
      if (key === 'db') {
        db ??= getDb(bindings);
        return db;
      }
      return undefined;
    },
    header: (name, value) => res.setHeader(name, value),
    json: (body, status = 200) => Response.json(body, { status }),
    redirect: (url, status = 302) => new Response(null, { status, headers: { location: url } }),
    closeDb: async () => {
      if (db) await db.$client.end();
    },
  };
}

async function sendWebResponse(res: ExpressResponse, response: globalThis.Response): Promise<void> {
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.status(response.status);

  if (!response.body) {
    res.end();
    return;
  }

  res.send(Buffer.from(await response.arrayBuffer()));
}
