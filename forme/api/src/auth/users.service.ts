import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { DATABASE, type Database } from '../db/database.module';
import { users, type UserRow } from '../db/schema';

/**
 * argon2id at parameters that cost roughly 50ms on the droplet's shared vCPUs.
 * Deliberately not the library defaults: the defaults assume a machine with
 * memory to spare, and 64MB per hash on a 1.9GB box shared with four other
 * services is how a login storm becomes an outage for everything else.
 */
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB — OWASP's minimum recommendation
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  static hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async findActiveById(id: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.disabledAt)))
      .limit(1);
    return row ?? null;
  }

  /** Matches through the same `lower(email)` expression as the unique index. */
  async findActiveByEmail(email: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(sql`lower(${users.email}) = lower(${email})`, isNull(users.disabledAt)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Verifies a password against a user that may not exist.
   *
   * When the account is missing we still run a hash comparison against a dummy
   * digest. Returning early would make "no such user" measurably faster than
   * "wrong password", which turns the sign-in form into an account enumerator.
   */
  async verify(user: UserRow | null, password: string): Promise<boolean> {
    if (!user) {
      await argon2.verify(await dummyHash(), password).catch(() => false);
      return false;
    }
    try {
      return await argon2.verify(user.passwordHash, password);
    } catch {
      return false;
    }
  }

  async listDemoAccounts(): Promise<Pick<UserRow, 'email' | 'name' | 'role'>[]> {
    return this.db
      .select({ email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.isDemo, true), isNull(users.disabledAt)));
  }
}

/**
 * A digest of a value nobody can supply, used only to burn the same CPU as a
 * genuine verification when the account does not exist.
 *
 * It is generated at first use rather than written as a literal, because a
 * hand-written digest fails argon2's parser and returns in microseconds — which
 * would reintroduce exactly the timing difference this exists to remove.
 * Computed once and reused; the value itself is never compared for real.
 */
let dummyHashPromise: Promise<string> | null = null;

function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash(randomBytes(32).toString('hex'), HASH_OPTIONS);
  return dummyHashPromise;
}
