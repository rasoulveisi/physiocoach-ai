export interface ClientWithTransaction {
  transaction: (callback: (client: unknown) => Promise<void>) => Promise<void>;
}

export function isTransactionBeginFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('failed query: begin') || message.includes('query: begin');
}

export async function withTransactionFallback<T>(
  db: ClientWithTransaction,
  operation: (client: T) => Promise<void>,
  contextLabel: string,
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await operation(tx as T);
    });
    return;
  } catch (error) {
    if (!isTransactionBeginFailure(error)) {
      throw error;
    }

    console.error(
      `[${contextLabel}] Transaction begin failed, retrying without transaction.`,
      error instanceof Error ? error.message : String(error),
    );
  }

  await operation(db as unknown as T);
}
