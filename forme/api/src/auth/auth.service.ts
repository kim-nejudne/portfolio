import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.module';
import { refreshTokens, type UserRow } from '../db/schema';
import type { AccessTokenPayload, CurrentUser, RefreshTokenPayload } from '../common/types';
import { UsersService } from './users.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

/** Refresh tokens are stored as a digest, never in the clear. */
function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** `15m`, `7d`, `900s` → milliseconds. */
function ttlToMs(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) throw new Error(`Unparseable TTL "${ttl}". Use a form like 15m, 24h or 7d.`);
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * factor;
}

@Injectable()
export class AuthService {
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTtl = config.get<string>('JWT_ACCESS_TTL', '15m');
    this.refreshTtl = config.get<string>('JWT_REFRESH_TTL', '7d');
  }

  async signIn(email: string, password: string): Promise<{ user: CurrentUser; tokens: IssuedTokens }> {
    const row = await this.users.findActiveByEmail(email);
    const ok = await this.users.verify(row, password);

    // One message for both failures. Distinguishing them tells an attacker
    // which addresses have accounts.
    if (!ok || !row) throw new UnauthorizedException('Email or password is incorrect.');

    const tokens = await this.issue(row);
    return { user: toCurrentUser(row), tokens };
  }

  /**
   * Rotates on every use: the presented token is revoked and a new one issued.
   * A refresh token replayed after rotation therefore fails, which is what makes
   * theft detectable rather than silent.
   */
  async refresh(presented: string): Promise<{ user: CurrentUser; tokens: IssuedTokens }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(presented);
    } catch {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Wrong token type.');

    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.id, payload.sid), isNull(refreshTokens.revokedAt)))
      .limit(1);

    if (!stored || stored.tokenHash !== digest(presented) || stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }

    const user = await this.users.findActiveById(payload.sub);
    if (!user) throw new UnauthorizedException('This account is no longer active.');

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    const tokens = await this.issue(user);
    return { user: toCurrentUser(user), tokens };
  }

  async signOut(presented: string | undefined): Promise<void> {
    if (!presented) return;
    // Revoke by digest so a malformed or expired token still clears its row.
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, digest(presented)), isNull(refreshTokens.revokedAt)));
  }

  private async issue(user: UserRow): Promise<IssuedTokens> {
    const sessionId = randomUUID();
    const accessMaxAgeMs = ttlToMs(this.accessTtl);
    const refreshMaxAgeMs = ttlToMs(this.refreshTtl);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      customerId: user.customerId,
      typ: 'access',
    };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, sid: sessionId, typ: 'refresh' };

    /**
     * Seconds, derived from the same millisecond figure the cookie maxAge uses.
     * Passing the raw "15m" string would have jsonwebtoken parse it separately
     * from `ttlToMs`, leaving the token and its cookie free to expire at
     * different times if the two parsers ever disagreed.
     */
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn: Math.floor(accessMaxAgeMs / 1000) }),
      this.jwt.signAsync(refreshPayload, { expiresIn: Math.floor(refreshMaxAgeMs / 1000) }),
    ]);

    await this.db.insert(refreshTokens).values({
      id: sessionId,
      userId: user.id,
      tokenHash: digest(refreshToken),
      expiresAt: new Date(Date.now() + refreshMaxAgeMs),
    });

    return { accessToken, refreshToken, accessMaxAgeMs, refreshMaxAgeMs };
  }

  /**
   * Housekeeping for the refresh table, run on a schedule. Without it the table
   * grows one row per sign-in forever on a database nobody is watching.
   */
  async purgeExpiredTokens(): Promise<number> {
    const cutoff = new Date(Date.now() - 86_400_000);
    const deleted = await this.db
      .delete(refreshTokens)
      .where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.revokedAt, cutoff)))
      .returning({ id: refreshTokens.id });
    return deleted.length;
  }
}

function toCurrentUser(row: UserRow): CurrentUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    customerId: row.customerId,
    isDemo: row.isDemo,
  };
}
