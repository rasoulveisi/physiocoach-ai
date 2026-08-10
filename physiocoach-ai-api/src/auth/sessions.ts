import { and, eq, isNull } from 'drizzle-orm';

import type { ApiDbClient } from '../routes/context';
import {
  authCredentials,
  authOauthAccounts,
  authRefreshTokenHistory,
  authSessions,
  users,
} from '../db/schema';
import type { AuthenticatedUser } from '../types/auth';
import { AuthError } from './errors';
import { hashToken } from './tokens';

export interface SessionContext {
  /** The refresh token as issued to the client. */
  refreshToken: string;
  userAgent: string | null;
  ipHash: string | null;
}

export interface CreatedSession {
  sessionId: string;
  refreshToken: string;
  absoluteExpiresAt: string;
  idleExpiresAt: string;
}

export interface ResolvedUser {
  userId: string;
  email: string;
  roles: string[];
  displayName: string | null;
}

export function toAuthenticatedUser(user: ResolvedUser): AuthenticatedUser {
  const roles = user.roles;
  const primary = roles.includes('admin') ? 'admin' : 'user';
  const result: AuthenticatedUser = {
    id: user.userId,
    email: user.email,
    role: primary,
    roles,
  };

  if (user.displayName) {
    result.displayName = user.displayName;
  }

  return result;
}

export async function getUserById(db: ApiDbClient, userId: string): Promise<ResolvedUser | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.id,
    email: row.email,
    roles: ['user'],
    displayName: row.displayName,
  };
}

export async function getUserByEmail(db: ApiDbClient, email: string): Promise<ResolvedUser | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    userId: row.id,
    email: row.email,
    roles: ['user'],
    displayName: row.displayName,
  };
}

/**
 * Creates a new session row + returns a fresh refresh token. Used on register/login/
 * OAuth callback.
 */
export async function createSession(
  db: ApiDbClient,
  userId: string,
  config: { refreshIdleDays: number; refreshAbsoluteDays: number },
  context: Pick<SessionContext, 'userAgent' | 'ipHash'>,
): Promise<CreatedSession> {
  const now = new Date();
  const { generateRefreshToken } = await import('./tokens');
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const sessionId = crypto.randomUUID();

  const absoluteExpiresAt = new Date(now.getTime() + config.refreshAbsoluteDays * 86_400_000);
  const idleExpiresAt = new Date(now.getTime() + config.refreshIdleDays * 86_400_000);

  await db.insert(authSessions).values({
    id: sessionId,
    userId,
    refreshTokenHash,
    previousRefreshTokenHash: null,
    previousRefreshRotatedAt: null,
    userAgent: context.userAgent,
    ipHash: context.ipHash,
    absoluteExpiresAt: absoluteExpiresAt.toISOString(),
    idleExpiresAt: idleExpiresAt.toISOString(),
    createdAt: now.toISOString(),
    revokedAt: null,
  });
  await recordRefreshTokenHistory(db, sessionId, refreshTokenHash, now.toISOString());

  return {
    sessionId,
    refreshToken,
    absoluteExpiresAt: absoluteExpiresAt.toISOString(),
    idleExpiresAt: idleExpiresAt.toISOString(),
  };
}

export interface RotatedSession {
  sessionId: string;
  refreshToken: string;
  userId: string;
  user: ResolvedUser;
}

/**
 * Rotates a refresh token.
 *
 * Reuse detection records every issued refresh hash for the session. If any old
 * hash is presented again while the session is still live, we revoke the session
 * as a compromise signal. The conditional update below also protects concurrent
 * refresh attempts: only the request holding the current active hash can advance
 * the session.
 */
export async function rotateSession(
  db: ApiDbClient,
  context: SessionContext,
  config: { refreshIdleDays: number; refreshAbsoluteDays: number },
): Promise<RotatedSession> {
  const presentedHash = await hashToken(context.refreshToken);
  const now = new Date();
  const nowIso = now.toISOString();

  // Find the session that currently owns this refresh token hash.
  const matches = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.refreshTokenHash, presentedHash))
    .limit(1);

  const session = matches[0];

  if (!session) {
    const historyMatches = await db
      .select({ sessionId: authRefreshTokenHistory.sessionId })
      .from(authRefreshTokenHistory)
      .where(eq(authRefreshTokenHistory.tokenHash, presentedHash))
      .limit(1);
    const historicalSessionId = historyMatches[0]?.sessionId;
    if (historicalSessionId) {
      const historicalSessions = await db
        .select()
        .from(authSessions)
        .where(and(eq(authSessions.id, historicalSessionId), isNull(authSessions.revokedAt)))
        .limit(1);
      const historicalSession = historicalSessions[0];
      if (historicalSession && !isSessionExpired(historicalSession, now)) {
        await revokeSession(db, historicalSession.id, nowIso);
      }
    }

    throw new AuthError('token_invalid', 'Refresh token is not valid.');
  }

  if (session.revokedAt !== null) {
    throw new AuthError('token_revoked', 'Session has been revoked.');
  }

  if (isSessionExpired(session, now)) {
    await revokeSession(db, session.id, nowIso);
    throw new AuthError('token_expired', 'Session expired. Please sign in again.');
  }

  // Mint the next refresh token, sliding the idle window.
  const { generateRefreshToken } = await import('./tokens');
  const nextRefresh = generateRefreshToken();
  const nextHash = await hashToken(nextRefresh);
  const nextIdle = new Date(now.getTime() + config.refreshIdleDays * 86_400_000);

  const updated = await db
    .update(authSessions)
    .set({
      refreshTokenHash: nextHash,
      previousRefreshTokenHash: presentedHash,
      previousRefreshRotatedAt: nowIso,
      idleExpiresAt: nextIdle.toISOString(),
    })
    .where(
      and(
        eq(authSessions.id, session.id),
        eq(authSessions.refreshTokenHash, presentedHash),
        isNull(authSessions.revokedAt),
      ),
    )
    .returning({ id: authSessions.id });

  if (updated.length === 0) {
    await revokeSession(db, session.id, nowIso);
    throw new AuthError('token_invalid', 'Refresh token is not valid.');
  }
  await recordRefreshTokenHistory(db, session.id, nextHash, nowIso);

  const user = await getUserById(db, session.userId);
  if (!user) {
    await revokeSession(db, session.id, nowIso);
    throw new AuthError('account_not_found', 'Account no longer exists.');
  }

  return {
    sessionId: session.id,
    refreshToken: nextRefresh,
    userId: session.userId,
    user,
  };
}

export async function revokeSession(
  db: ApiDbClient,
  sessionId: string,
  nowIso?: string,
): Promise<void> {
  const revokedAt = nowIso ?? new Date().toISOString();
  await db
    .update(authSessions)
    .set({ revokedAt })
    .where(and(eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)));
}

export async function isSessionActive(
  db: ApiDbClient,
  sessionId: string,
  userId: string,
  now?: Date,
): Promise<boolean> {
  const rows = await db.select().from(authSessions).where(eq(authSessions.id, sessionId)).limit(1);
  const session = rows[0];
  if (!session || session.revokedAt !== null || session.userId !== userId) {
    return false;
  }

  const checkedAt = now ?? new Date();
  if (isSessionExpired(session, checkedAt)) {
    await revokeSession(db, session.id, checkedAt.toISOString());
    return false;
  }

  return true;
}

/**
 * Revokes every live session for a user. Used on logout-all and security events.
 */
export async function revokeAllSessions(db: ApiDbClient, userId: string): Promise<void> {
  const revokedAt = new Date().toISOString();
  await db
    .update(authSessions)
    .set({ revokedAt })
    .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}

async function recordRefreshTokenHistory(
  db: ApiDbClient,
  sessionId: string,
  tokenHash: string,
  createdAt: string,
): Promise<void> {
  await db.insert(authRefreshTokenHistory).values({
    id: crypto.randomUUID(),
    sessionId,
    tokenHash,
    createdAt,
  });
}

export async function getCredentialHashForUser(
  db: ApiDbClient,
  userId: string,
): Promise<string | null> {
  const rows = await db
    .select({ passwordHash: authCredentials.passwordHash })
    .from(authCredentials)
    .where(eq(authCredentials.userId, userId))
    .limit(1);
  return rows[0]?.passwordHash ?? null;
}

export async function findOauthAccount(
  db: ApiDbClient,
  provider: string,
  providerUserId: string,
): Promise<{ userId: string; email: string | null } | null> {
  const rows = await db
    .select({ userId: authOauthAccounts.userId, email: authOauthAccounts.email })
    .from(authOauthAccounts)
    .where(
      and(
        eq(authOauthAccounts.provider, provider),
        eq(authOauthAccounts.providerUserId, providerUserId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return { userId: row.userId, email: row.email };
}

export interface OAuthUserProfile {
  provider: 'google';
  providerUserId: string;
  email: string;
  displayName: string | null;
}

export async function upsertOAuthUser(
  db: ApiDbClient,
  profile: OAuthUserProfile,
  nowIso = new Date().toISOString(),
): Promise<ResolvedUser> {
  const existing = await findOauthAccount(db, profile.provider, profile.providerUserId);
  if (existing) {
    const user = await getUserById(db, existing.userId);
    if (!user) {
      throw new AuthError('account_not_found', 'Linked account no longer exists.');
    }
    return user;
  }

  const emailUser = await getUserByEmail(db, profile.email);
  const userId = emailUser?.userId ?? crypto.randomUUID();

  if (!emailUser) {
    await db.insert(users).values({
      id: userId,
      email: profile.email,
      displayName: profile.displayName,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  await db.insert(authOauthAccounts).values({
    id: crypto.randomUUID(),
    userId,
    provider: profile.provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return {
    userId,
    email: profile.email,
    roles: ['user'],
    displayName: emailUser?.displayName ?? profile.displayName,
  };
}

function isSessionExpired(
  session: { absoluteExpiresAt: string; idleExpiresAt: string },
  now: Date,
): boolean {
  const absoluteExpiry = new Date(session.absoluteExpiresAt);
  const idleExpiry = new Date(session.idleExpiresAt);
  return absoluteExpiry.getTime() <= now.getTime() || idleExpiry.getTime() <= now.getTime();
}
