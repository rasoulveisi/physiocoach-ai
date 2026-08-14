import { describe, expect, it } from 'vitest';
import { logAiAuditEntry, deleteExpiredAuditLogs } from '../src/services/ai-audit-logger';

describe('ai-audit-logger', () => {
  it('handles log entry when db is undefined without throwing', async () => {
    const auditId = await logAiAuditEntry(undefined, {
      task: 'workout_plan',
      provider: 'openrouter',
      model: 'test-model',
      prompt: 'test prompt',
      status: 'success',
      latencyMs: 100,
    });
    expect(auditId).toBeDefined();
    expect(typeof auditId).toBe('string');
  });

  it('handles cleanup when db is undefined without throwing', async () => {
    const deletedCount = await deleteExpiredAuditLogs(undefined, 7);
    expect(deletedCount).toBe(0);
  });
});
