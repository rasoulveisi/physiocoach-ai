import { httpServerHandler } from 'cloudflare:node';
import { createServer } from 'node:http';

import { createApp } from './app';

const app = createApp();
const server = createServer(app);

export default httpServerHandler(server as unknown as Parameters<typeof httpServerHandler>[0]);
