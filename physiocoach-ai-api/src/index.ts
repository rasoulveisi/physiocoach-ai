import { httpServerHandler } from 'cloudflare:node';
import { createServer } from 'node:http';

import { createApp } from './app';
import type { WorkerBindings } from './env';

const app = createApp();
const server = createServer(app);
const nodeHandler = httpServerHandler(server as unknown as Parameters<typeof httpServerHandler>[0]);

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    app.locals.workerEnv = env;
    return (nodeHandler as { fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response> }).fetch(
      request,
      env,
      ctx,
    );
  },
};
