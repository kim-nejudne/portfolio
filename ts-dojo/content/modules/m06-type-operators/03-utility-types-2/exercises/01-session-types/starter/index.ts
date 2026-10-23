export function createToken(userId: number, scope: 'read' | 'write') {
  return { userId, scope, value: `${scope}-${userId}` };
}

/** What createToken returns. */
export type Token = ReturnType<createToken>;

export class Session {
  token: Token;
  ttlMinutes: number;
  constructor(token: Token, ttlMinutes = 30) {
    this.token = token;
    this.ttlMinutes = ttlMinutes;
  }
  canWrite(): boolean {
    return this.token.scope === 'write';
  }
}

/** The arguments that new Session(...) takes, as a tuple. */
export type SessionArgs = ConstructorParameters<Session>;

/** One session for each argument list. */
export function openAll(list: SessionArgs[]): Session[] {
  return list.map((args) => new Session(...args));
}
