import { Hono } from 'hono';

import type { WorkerBindings } from '../env';

export function createHealthRoutes() {
  const route = new Hono<{ Bindings: WorkerBindings }>();

  route.get('/openapi.json', async (c) => {
    const { createOpenApiDocument } = await import('../shared/openapi');
    const openApiDocument = createOpenApiDocument();

    return c.json(openApiDocument);
  });

  route.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'physiocoach-ai-api',
      version: '0.1.0',
    }),
  );

  route.get('/docs', (c) => {
    const openApiUrl = '/api/v1/openapi.json';
    const docsTokenKey = 'physiocoach-api-docs-token';
    const appEnv = c.env.APP_ENV;

    const html = `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>PhysioCoach AI API Docs</title>
          <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
          <style>
            body {
              margin: 0;
              font-family: Arial, Helvetica, sans-serif;
            }
            #swagger-ui {
              max-width: 1400px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
          <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
          <script>
            function getDocsToken() {
              try {
                return localStorage.getItem(${JSON.stringify(docsTokenKey)});
              } catch (_error) {
                return null;
              }
            }

            function saveDocsToken(nextToken) {
              const token = typeof nextToken === 'string' ? nextToken.replace(/^bearer\\s+/i, '').trim() : '';
              if (!token) {
                return;
              }

              try {
                localStorage.setItem(${JSON.stringify(docsTokenKey)}, token);
              } catch (_error) {}
            }

            window.onload = function () {
              const targetUrl = ${JSON.stringify(openApiUrl)};

              if (${JSON.stringify(appEnv)} === 'dev' && !localStorage.getItem('physiocoach-dev-swagger-token')) {
                const token = window.prompt('Enter the dev Swagger token:');
                if (token) {
                  localStorage.setItem('physiocoach-dev-swagger-token', token.trim());
                }
              }

              SwaggerUIBundle({
                url: targetUrl,
                dom_id: '#swagger-ui',
                presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                layout: 'StandaloneLayout',
                requestInterceptor: (request) => {
                  const queryUserId = new URLSearchParams(window.location.search).get('userId');
                  const storedUserId = localStorage.getItem('docsLocalUserId');
                  const localUserId = queryUserId || storedUserId || '00000000-0000-4000-8000-000000000001';

                  if (queryUserId && !storedUserId) {
                    try {
                      localStorage.setItem('docsLocalUserId', queryUserId);
                    } catch (_error) {}
                  }

                  if (${JSON.stringify(appEnv)} === 'local' || ${JSON.stringify(appEnv)} === 'dev') {
                    request.headers['x-dev-swagger'] = '1';
                    request.headers['x-dev-user-id'] = localUserId;
                    const devSwaggerToken = localStorage.getItem('physiocoach-dev-swagger-token');
                    if (${JSON.stringify(appEnv)} === 'dev' && devSwaggerToken) {
                      request.headers['x-dev-swagger-token'] = devSwaggerToken;
                      request.headers['x-dev-user-role'] = localStorage.getItem('docsLocalUserRole') || 'admin';
                    }
                  }

                  return request;
                },
          });
        };
          </script>
        </body>
      </html>`;

    return c.body(html, 200, {
      'content-type': 'text/html; charset=utf-8',
    });
  });

  return route;
}
