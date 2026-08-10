import { describe, expect, it } from 'vitest';
import { isDateInRange, toDateDay } from '../src/services/progress-calculator';

describe('progress domain compatibility exports', () => {
  it('re-exports toDateDay', () => {
    expect(toDateDay('2026-06-20T10:00:00.000Z')).toBe('2026-06-20');
  });

  it('re-exports isDateInRange', () => {
    expect(
      isDateInRange(
        '2026-06-20T10:00:00.000Z',
        '2026-06-19T00:00:00.000Z',
        '2026-06-21T23:59:59.999Z',
      ),
    ).toBe(true);
  });
});
