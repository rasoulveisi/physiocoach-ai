const DEFAULT_LOCAL_HOSTS = ['localhost', '127.0.0.1'];

export const DEFAULT_CORS_ORIGIN = [
  'http://localhost:4200',
  'http://localhost:4300',
  'http://localhost:8787',
  'https://localhost:4200',
  'https://localhost:4300',
  'https://localhost:8787',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4300',
  'http://127.0.0.1:8787',
  'https://127.0.0.1:4200',
  'https://127.0.0.1:4300',
  'https://127.0.0.1:8787',
  'https://physiocoach.otconnect.ir',
  'https://dev.physiocoach-ai-web.pages.dev',
].join(',');

export function resolveCorsOrigins(configuredOrigin: string): string[] {
  const origins = configuredOrigin
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (origins.length === 0) return [];

  const normalized = new Set<string>();

  for (const origin of origins) {
    normalized.add(origin);

    if (origin.includes('*')) continue;

    const localPeer = localLoopbackPair(origin);
    if (localPeer) normalized.add(localPeer);

    const protocolPair = protocolSwapPair(origin);
    if (protocolPair) normalized.add(protocolPair);
  }

  return [...normalized];
}

export function isCorsOriginAllowed(
  requestOrigin: string | null,
  configuredOrigin: string,
): boolean {
  if (!requestOrigin) return false;

  const normalized = requestOrigin.replace(/\/+$/, '');
  const parsed = safeParseUrl(normalized);
  if (parsed && DEFAULT_LOCAL_HOSTS.includes(parsed.hostname)) {
    return true;
  }

  const allowedOrigins = resolveCorsOrigins(configuredOrigin);
  return allowedOrigins.some((allowed) => {
    if (normalized === allowed) return true;
    if (allowed.includes('*')) return matchesWildcardOrigin(normalized, allowed);
    return false;
  });
}

function matchesWildcardOrigin(requestOrigin: string, wildcardOrigin: string): boolean {
  const [scheme, hostPattern] = wildcardOrigin.split('://', 2);
  if (!scheme || !hostPattern?.startsWith('*.')) return false;

  const parsed = safeParseUrl(requestOrigin);
  if (!parsed || parsed.protocol !== `${scheme.toLowerCase()}:`) return false;

  const host = parsed.hostname.toLowerCase();
  const suffix = hostPattern.slice(2).toLowerCase();

  return host.endsWith(suffix) && host !== suffix;
}

function localLoopbackPair(origin: string): string | null {
  const parsed = safeParseUrl(origin);
  if (!parsed) return null;

  if (parsed.hostname === 'localhost') {
    parsed.hostname = '127.0.0.1';
    return parsed.origin;
  }
  if (parsed.hostname === '127.0.0.1') {
    parsed.hostname = 'localhost';
    return parsed.origin;
  }
  return null;
}

function protocolSwapPair(origin: string): string | null {
  const parsed = safeParseUrl(origin);
  if (!parsed || !DEFAULT_LOCAL_HOSTS.includes(parsed.hostname)) return null;

  parsed.protocol = parsed.protocol === 'https:' ? 'http:' : 'https:';
  return parsed.origin;
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
