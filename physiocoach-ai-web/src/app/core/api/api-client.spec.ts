import '@angular/compiler';
import { describe, expect, it } from 'vitest';

import { normalizeApiRequestBody } from './api-client';

describe('normalizeApiRequestBody', () => {
  it('uses an empty object when the request body is undefined', () => {
    expect(normalizeApiRequestBody(undefined)).toEqual({});
  });

  it('preserves defined request bodies', () => {
    const body = { assessment: { frequencyDays: 3 } };

    expect(normalizeApiRequestBody(body)).toBe(body);
  });
});
