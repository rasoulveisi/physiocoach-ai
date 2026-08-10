import { describe, expect, it } from 'vitest';
import { isGitCommitSha } from '../scripts/import-exercises-dataset.mjs';

describe('import exercises dataset CLI', () => {
  it('accepts short and full Git commit SHAs only', () => {
    expect(isGitCommitSha('abc1234')).toBe(true);
    expect(isGitCommitSha('0123456789abcdef0123456789abcdef01234567')).toBe(true);
    expect(isGitCommitSha('not-a-sha')).toBe(false);
    expect(isGitCommitSha('abc123')).toBe(false);
  });
});
