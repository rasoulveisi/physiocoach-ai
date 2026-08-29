import { createExpressRouter } from './express-adapter';
import { getApiRouteContext } from './context';
import { masterExercises } from '../db/schema';

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string | undefined;
  changefreq?: ('always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never') | undefined;
  priority?: string | number | undefined;
}

export const BASE_SITE_URL = 'https://physiocoach.ai';

export const CORE_STATIC_ROUTES: SitemapUrlEntry[] = [
  { loc: `${BASE_SITE_URL}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${BASE_SITE_URL}/explore`, changefreq: 'daily', priority: '0.9' },
  { loc: `${BASE_SITE_URL}/exercises`, changefreq: 'daily', priority: '0.9' },
  { loc: `${BASE_SITE_URL}/calculator`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${BASE_SITE_URL}/assessment`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${BASE_SITE_URL}/auth`, changefreq: 'monthly', priority: '0.7' },
];

export const CURATED_ALTERNATIVE_SLUGS: string[] = [
  'bench-press-shoulder-pain',
  'bench-press-shoulder-impingement',
  'back-squat-knee-pain',
  'deadlift-lower-back-pain',
  'overhead-press-shoulder-impingement',
  'barbell-row-lower-back-pain',
  'barbell-lunge-knee-pain',
  'dips-shoulder-pain',
  'skull-crushers-elbow-pain',
  'romanian-deadlift-lower-back-pain',
  'leg-press-knee-pain',
  'lateral-raise-shoulder-pain',
  'pull-up-shoulder-impingement',
  'bicep-curl-elbow-pain',
  'front-squat-wrist-pain',
  'incline-bench-press-shoulder-pain',
  'bulgarian-split-squat-knee-pain',
];

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export function buildSitemapXml(entries: SitemapUrlEntry[]): string {
  const urlBlocks = entries
    .map((entry) => {
      const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];
      if (entry.lastmod) {
        parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
      }
      if (entry.changefreq) {
        parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      }
      if (entry.priority !== undefined) {
        const p = typeof entry.priority === 'number' ? entry.priority.toFixed(1) : entry.priority;
        parts.push(`    <priority>${p}</priority>`);
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlBlocks}\n</urlset>`;
}

export function buildRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /explore',
    'Allow: /exercises',
    'Allow: /calculator',
    'Allow: /tools/',
    'Allow: /tools/*',
    'Allow: /alternatives/',
    'Allow: /alternatives/*',
    'Disallow: /session',
    'Disallow: /session/*',
    'Disallow: /admin',
    'Disallow: /admin/*',
    'Disallow: /settings',
    'Disallow: /settings/*',
    'Disallow: /dashboard',
    'Disallow: /dashboard/*',
    'Disallow: /onboarding',
    'Disallow: /onboarding/*',
    'Disallow: /plan',
    'Disallow: /plan/*',
    '',
    `Sitemap: ${BASE_SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

export async function resolveSitemapEntries(
  db: ReturnType<typeof getApiRouteContext>['db'],
): Promise<SitemapUrlEntry[]> {
  const todayIso = new Date().toISOString().split('T')[0];
  const urlMap = new Map<string, SitemapUrlEntry>();

  // 1. Core static routes
  for (const route of CORE_STATIC_ROUTES) {
    urlMap.set(route.loc, {
      ...route,
      lastmod: route.lastmod || todayIso,
    });
  }

  // 2. Curated programmatic alternative routes
  for (const slug of CURATED_ALTERNATIVE_SLUGS) {
    const loc = `${BASE_SITE_URL}/tools/alternatives/${slug}`;
    urlMap.set(loc, {
      loc,
      lastmod: todayIso,
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  // 3. Database master_exercises programmatic routes
  if (db) {
    try {
      const rows = await db
        .select({
          canonicalId: masterExercises.canonicalId,
          name: masterExercises.name,
          bodyPart: masterExercises.bodyPart,
          updatedAt: masterExercises.updatedAt,
          createdAt: masterExercises.createdAt,
        })
        .from(masterExercises)
        .limit(500);

      for (const row of rows) {
        const slugBase = (row.canonicalId || row.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        if (!slugBase) continue;

        const conditions: string[] = [];
        const bp = (row.bodyPart || '').toLowerCase();
        if (bp.includes('chest') || bp.includes('shoulder')) {
          conditions.push('shoulder-pain', 'shoulder-impingement');
        } else if (bp.includes('leg')) {
          conditions.push('knee-pain');
        } else if (bp.includes('back') || bp.includes('waist')) {
          conditions.push('lower-back-pain');
        } else if (bp.includes('arm')) {
          conditions.push('elbow-pain');
        } else {
          conditions.push('lower-back-pain');
        }

        const rawDate = row.updatedAt || row.createdAt;
        const modDate = rawDate ? rawDate.split('T')[0] : todayIso;

        for (const cond of conditions) {
          const fullSlug = `${slugBase}-${cond}`;
          const loc = `${BASE_SITE_URL}/tools/alternatives/${fullSlug}`;
          if (!urlMap.has(loc)) {
            urlMap.set(loc, {
              loc,
              lastmod: modDate,
              changefreq: 'weekly',
              priority: '0.8',
            });
          }
        }
      }
    } catch {
      // Graceful fallback to static + curated routes on DB error
    }
  }

  return Array.from(urlMap.values());
}

export function createSitemapRoutes() {
  const route = createExpressRouter();

  route.get('/sitemap.xml', async (c) => {
    const { db } = getApiRouteContext(c);
    const entries = await resolveSitemapEntries(db);
    const xml = buildSitemapXml(entries);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  });

  route.get('/robots.txt', async () => {
    const content = buildRobotsTxt();

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  });

  return route;
}

export const sitemapRouter = createSitemapRoutes();
