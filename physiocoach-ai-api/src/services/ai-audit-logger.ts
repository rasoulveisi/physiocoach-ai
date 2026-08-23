import { and, desc, eq, lte } from 'drizzle-orm';
import { createDb } from '../db/client';
import { getDb } from '../db';
import { aiAuditLogs } from '../db/schema';

type DbClient = ReturnType<typeof createDb>;

export interface AiAuditLogInput {
  id?: string;
  traceId?: string | null;
  userId?: string | null;
  task: string;
  provider: string;
  model: string;
  prompt: string;
  completion?: string | null;
  status: 'success' | 'error' | 'schema_rejected';
  errorMessage?: string | null;
  schemaIssuesJson?: string | null;
  inputHash?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs: number;
  createdAt?: string;
}

export async function logAiAuditEntry(
  db: DbClient | undefined,
  entry: AiAuditLogInput,
): Promise<string> {
  const auditId = entry.id ?? `audit_${crypto.randomUUID()}`;
  let auditDb = db;
  let ownsClient = false;

  if (!auditDb) {
    try {
      auditDb = getDb();
      ownsClient = true;
    } catch {
      console.debug('ai_audit_logger.skip', { reason: 'no_db_instance', task: entry.task, auditId });
      return auditId;
    }
  }

  const record = {
    id: auditId,
    traceId: entry.traceId ?? `trace_${crypto.randomUUID()}`,
    userId: entry.userId ?? null,
    task: entry.task,
    provider: entry.provider,
    model: entry.model,
    prompt: entry.prompt,
    completion: entry.completion ?? null,
    status: entry.status,
    errorMessage: entry.errorMessage ?? null,
    schemaIssuesJson: entry.schemaIssuesJson ?? null,
    inputHash: entry.inputHash ?? null,
    promptTokens: entry.promptTokens ?? null,
    completionTokens: entry.completionTokens ?? null,
    totalTokens: entry.totalTokens ?? null,
    latencyMs: entry.latencyMs,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  };

  try {
    await auditDb.insert(aiAuditLogs).values(record);
    console.info('ai_audit_logger.success', {
      id: record.id,
      traceId: record.traceId,
      task: record.task,
      model: record.model,
      status: record.status,
      latencyMs: record.latencyMs,
    });
  } catch (error) {
    console.warn('ai_audit_logger.error', {
      task: entry.task,
      reason: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (ownsClient) await auditDb.$client.end();
  }

  return auditId;
}

export async function deleteExpiredAuditLogs(
  db: DbClient | undefined,
  retentionDays = 7,
): Promise<number> {
  if (!db) {
    console.debug('ai_audit_logger.cleanup.skip', { reason: 'no_db_instance' });
    return 0;
  }

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await db.delete(aiAuditLogs).where(lte(aiAuditLogs.createdAt, cutoffDate));

    const changes =
      (result as unknown as { meta?: { changes?: number }; rowsAffected?: number }).meta?.changes ??
      (result as unknown as { rowsAffected?: number }).rowsAffected ??
      0;

    console.info('ai_audit_logger.cleanup.success', {
      retentionDays,
      cutoffDate,
      changes,
    });
    return changes;
  } catch (error) {
    console.warn('ai_audit_logger.cleanup.error', {
      retentionDays,
      reason: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

export async function queryAuditLogs(
  db: DbClient | undefined,
  options: {
    limit?: number;
    traceId?: string;
    task?: string;
    status?: string;
  } = {},
) {
  if (!db) return [];
  const limit = Math.min(options.limit ?? 20, 100);
  const conditions = [];
  if (options.traceId) conditions.push(eq(aiAuditLogs.traceId, options.traceId));
  if (options.task) conditions.push(eq(aiAuditLogs.task, options.task));
  if (options.status) conditions.push(eq(aiAuditLogs.status, options.status));

  return await db
    .select()
    .from(aiAuditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(aiAuditLogs.createdAt))
    .limit(limit);
}

export async function getAuditLogById(db: DbClient | undefined, id: string) {
  if (!db) return null;
  const rows = await db.select().from(aiAuditLogs).where(eq(aiAuditLogs.id, id)).limit(1);
  return rows[0] ?? null;
}
