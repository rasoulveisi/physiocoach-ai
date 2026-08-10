/**
 * Password hashing for Workers, using the Web Crypto API (PBKDF2-SHA256).
 *
 * Storage format: `pbkdf2$<iterations>$<b64-salt>$<b64-hash>`
 *
 * Constant-time comparison is provided by `crypto.subtle.verify`, which runs the
 * HMAC/DSA-style comparison internally. For the raw derived-key compare we use a
 * timing-safe equality check over fixed-length buffers.
 */

const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ALGO = 'PBKDF2';
const HASH_ALGO = 'SHA-256';
const FORMAT_PREFIX = 'pbkdf2';

const encoder = new TextEncoder();

export interface PasswordHashParts {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
}

export function isStrongPassword(password: string): boolean {
  // Minimum policy: >= 8 chars, at least one letter and one number.
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return false;
  }
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, ITERATIONS);
  return `${FORMAT_PREFIX}$${ITERATIONS}$${base64Encode(salt)}$${base64Encode(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) {
    return false;
  }

  const candidate = await deriveBits(password, parsed.salt, parsed.iterations);
  return timingSafeEqual(candidate, parsed.hash);
}

function parseStoredHash(stored: string): PasswordHashParts | null {
  const segments = stored.split('$');
  if (segments.length !== 4 || segments[0] !== FORMAT_PREFIX) {
    return null;
  }

  const iterations = Number(segments[1]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000) {
    return null;
  }

  const salt = base64Decode(segments[2]!);
  const hash = base64Decode(segments[3]!);
  if (!salt || !hash || hash.length !== HASH_BYTES) {
    return null;
  }

  return { iterations, salt, hash };
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    ALGO,
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: ALGO, hash: HASH_ALGO, salt: salt as BufferSource, iterations },
    keyMaterial,
    HASH_BYTES * 8,
  );

  return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }

  return diff === 0;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
