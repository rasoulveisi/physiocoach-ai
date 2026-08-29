import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

const mockEnv = {
  APP_ENV: 'local',
  CORS_ORIGIN: '*',
} as const;

const prodMockEnv = {
  APP_ENV: 'production',
  CORS_ORIGIN: '*',
} as const;

describe('E2E: Sitemap & Robots.txt SEO Pipeline', () => {
  it('serves dynamic sitemap.xml at root and /api/v1 with standard XML tags and core URLs', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/sitemap.xml',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('xml');

    const xml = await response.text();

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    // Static core URLs
    expect(xml).toContain('<loc>https://physiocoach.ai/</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/explore</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/exercises</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/calculator</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/assessment</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/auth</loc>');

    // Programmatic alternatives URLs
    expect(xml).toContain('<loc>https://physiocoach.ai/tools/alternatives/bench-press-shoulder-pain</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/tools/alternatives/back-squat-knee-pain</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/tools/alternatives/deadlift-lower-back-pain</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/tools/alternatives/overhead-press-shoulder-impingement</loc>');

    // Standard sitemap fields
    expect(xml).toContain('<lastmod>');
    expect(xml).toContain('<changefreq>');
    expect(xml).toContain('<priority>');
  });

  it('serves sitemap.xml at /api/v1/sitemap.xml as well', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/api/v1/sitemap.xml',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('xml');
    const xml = await response.text();
    expect(xml).toContain('<loc>https://physiocoach.ai/</loc>');
    expect(xml).toContain('<loc>https://physiocoach.ai/explore</loc>');
  });

  it('serves robots.txt at root and /api/v1 with allow/disallow directives and sitemap reference', async () => {
    const app = createApp();

    const response = await app.fetch(
      '/robots.txt',
      {
        method: 'GET',
      },
      mockEnv,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');

    const txt = await response.text();

    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Allow: /explore');
    expect(txt).toContain('Allow: /exercises');
    expect(txt).toContain('Allow: /tools/*');
    expect(txt).toContain('Disallow: /session');
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Disallow: /settings');
    expect(txt).toContain('Sitemap: https://physiocoach.ai/sitemap.xml');
  });

  it('allows unauthenticated access to /sitemap.xml and /robots.txt in production mode', async () => {
    const app = createApp();

    const sitemapRes = await app.fetch(
      '/sitemap.xml',
      {
        method: 'GET',
      },
      prodMockEnv,
    );
    expect(sitemapRes.status).toBe(200);

    const robotsRes = await app.fetch(
      '/robots.txt',
      {
        method: 'GET',
      },
      prodMockEnv,
    );
    expect(robotsRes.status).toBe(200);
  });
});
