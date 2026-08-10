const textEncoder = new TextEncoder();

type JsonPrimitive = string | number | boolean | null;
type NormalizedJson = JsonPrimitive | NormalizedJson[] | { [key: string]: NormalizedJson };

function normalizeForHash(value: unknown): NormalizedJson {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    const normalizedItems = value.map((item) =>
      item === undefined ? null : normalizeForHash(item),
    );
    const isAllPrimitive = normalizedItems.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean' ||
        item === null,
    );

    if (isAllPrimitive) {
      return [...normalizedItems].sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      );
    }

    return normalizedItems;
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeForHash(nestedValue)]),
    );
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return null;
}

export async function createInputHash(input: unknown): Promise<string> {
  const normalizedInput = JSON.stringify(normalizeForHash(input));
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(normalizedInput));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
