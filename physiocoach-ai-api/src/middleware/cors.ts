const DEFAULT_LOCAL_HOSTS = ['localhost', '127.0.0.1'];
export const DEFAULT_CORS_ORIGIN =
  'http://localhost:4200,http://localhost:8787,https://localhost:4200,https://localhost:8787,http://127.0.0.1:4200,http://127.0.0.1:8787,https://127.0.0.1:4200,https://127.0.0.1:8787,https://physiocoach.otconnect.ir,https://dev.physiocoach-ai-web.pages.dev';

export function resolveCorsOrigins(configuredOrigin: string): string[] {
  const origins = configuredOrigin
    .split(',')
    .map((value) => value.trim())
    .map((value) => value.replace(/\/$/, ''))
    .filter(Boolean);

  if (origins.length === 0) {
    return [];
  }

  const normalized = new Set<string>();

  for (const origin of origins) {
    normalized.add(origin);

    if (containsWildcard(origin)) {
      continue;
    }

    const localPeer = localLoopbackPair(origin);
    if (localPeer) {
      normalized.add(localPeer);
    }

    const protocolPair = protocolSwapPair(origin);
    if (protocolPair) {
      normalized.add(protocolPair);
    }
  }

  return [...normalized];
}

export function isCorsOriginAllowed(
  requestOrigin: string | null,
  configuredOrigin: string,
): boolean {
  if (!requestOrigin) {
    return false;
  }

  const normalizedRequestOrigin = requestOrigin.replace(/\/$/, '');
  const allowedOrigins = resolveCorsOrigins(configuredOrigin);

  return allowedOrigins.some((allowedOrigin) =>
    isOriginMatch(normalizedRequestOrigin, allowedOrigin),
  );
}

function isOriginMatch(requestOrigin: string, allowedOrigin: string): boolean {
  if (requestOrigin === allowedOrigin) {
    return true;
  }

  if (containsWildcard(allowedOrigin)) {
    return matchesWildcardOrigin(requestOrigin, allowedOrigin);
  }

  return false;
}

function matchesWildcardOrigin(requestOrigin: string, wildcardOrigin: string): boolean {
  const wildcardPosition = wildcardOrigin.indexOf('*');
  if (wildcardPosition === -1) {
    return false;
  }

  if (!wildcardHostPattern(wildcardOrigin)) {
    return false;
  }

  const parsedOrigin = safeParseUrl(requestOrigin);
  if (!parsedOrigin) {
    return false;
  }

  const wildcardMatch = wildcardHostPattern(wildcardOrigin);
  if (!wildcardMatch) {
    return false;
  }

  const [wildcardScheme, wildcardHostSuffix] = wildcardMatch;
  if (parsedOrigin.protocol !== `${wildcardScheme}:`) {
    return false;
  }

  const host = parsedOrigin.hostname.toLowerCase();
  const suffix = wildcardHostSuffix.toLowerCase();

  // *.example.com should match deploy-branch.example.com but not example.com.
  return host.endsWith(suffix) && host !== suffix;
}

function wildcardHostPattern(wildcardOrigin: string): [string, string] | null {
  const [scheme, host] = wildcardOrigin.split('://', 2);
  if (!scheme || !host) {
    return null;
  }

  if (!host.startsWith('*.')) {
    return null;
  }

  return [scheme.toLowerCase(), host.substring(2)];
}

function localLoopbackPair(origin: string): string | null {
  const parsed = safeParseUrl(origin);
  if (!parsed) {
    return null;
  }

  if (parsed.hostname === 'localhost') {
    parsed.hostname = '127.0.0.1';
    return parsed.toString().replace(/\/$/, '');
  }

  if (parsed.hostname === '127.0.0.1') {
    parsed.hostname = 'localhost';
    return parsed.toString().replace(/\/$/, '');
  }

  return null;
}

function protocolSwapPair(origin: string): string | null {
  const parsed = safeParseUrl(origin);
  if (!parsed) {
    return null;
  }

  if (!DEFAULT_LOCAL_HOSTS.includes(parsed.hostname)) {
    return null;
  }

  if (parsed.protocol === 'https:') {
    parsed.protocol = 'http:';
    return parsed.toString().replace(/\/$/, '');
  }

  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
    return parsed.toString().replace(/\/$/, '');
  }

  return null;
}

function containsWildcard(origin: string): boolean {
  return origin.includes('*');
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
