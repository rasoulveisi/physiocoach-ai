import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CORS_ORIGIN,
  isCorsOriginAllowed,
  resolveCorsOrigins,
} from '../src/middleware/cors';

describe('cors origins', () => {
  it('adds localhost loopback and protocol variants', () => {
    const allowed = resolveCorsOrigins('http://localhost:4200');

    expect(allowed).toEqual(
      expect.arrayContaining(['http://localhost:4200', 'http://127.0.0.1:4200']),
    );
  });

  it('matches wildcard subdomain patterns', () => {
    expect(
      isCorsOriginAllowed(
        'https://deploy-preview-2--physiocoach.otconnect.ir',
        'https://*.physiocoach.otconnect.ir',
      ),
    ).toBe(true);
  });

  it('does not match root host for wildcard subdomain pattern', () => {
    expect(
      isCorsOriginAllowed('https://physiocoach.otconnect.ir', 'https://*.physiocoach.otconnect.ir'),
    ).toBe(false);
  });

  it('allows configured production and development frontend domains', () => {
    const configuredOrigin =
      'https://physiocoach.otconnect.ir,https://dev.physiocoach-ai-web.pages.dev';

    expect(isCorsOriginAllowed('https://physiocoach.otconnect.ir', configuredOrigin)).toBe(true);
    expect(isCorsOriginAllowed('https://dev.physiocoach-ai-web.pages.dev', configuredOrigin)).toBe(
      true,
    );
  });

  it('allows the Capacitor Android hostname from default origins', () => {
    expect(isCorsOriginAllowed('https://physiocoach.otconnect.ir', DEFAULT_CORS_ORIGIN)).toBe(true);
    expect(
      isCorsOriginAllowed('https://dev.physiocoach-ai-web.pages.dev', DEFAULT_CORS_ORIGIN),
    ).toBe(true);
  });

  it('does not mirror configured production HTTPS origins to HTTP', () => {
    expect(
      isCorsOriginAllowed('http://physiocoach.otconnect.ir', 'https://physiocoach.otconnect.ir'),
    ).toBe(false);
    expect(isCorsOriginAllowed('http://foo.otconnect.ir', 'https://*.otconnect.ir')).toBe(false);
  });

  it('allows configured localhost origin on dev API', () => {
    expect(
      isCorsOriginAllowed(
        'http://localhost:4200',
        'https://dev.physiocoach-ai-web.pages.dev,http://localhost:4200,https://localhost:4200,http://127.0.0.1:4200,https://127.0.0.1:4200',
      ),
    ).toBe(true);
  });

  it('rejects non-matching origins', () => {
    expect(
      isCorsOriginAllowed('https://evil.example.com', 'https://*.physiocoach.otconnect.ir'),
    ).toBe(false);
    expect(isCorsOriginAllowed(null, 'https://physiocoach.otconnect.ir')).toBe(false);
  });
});
