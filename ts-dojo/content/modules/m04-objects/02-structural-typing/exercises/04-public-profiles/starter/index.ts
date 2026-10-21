export type Account =
  | {
      kind: 'person';
      id: number;
      name: string;
      email: string;
      passwordHash: string;
    }
  | { kind: 'bot'; id: number; name: string; owner: string; apiToken: string };

export type Profile =
  | { kind: 'person'; id: number; name: string }
  | { kind: 'bot'; id: number; name: string; owner: string };

/** What other users may see: only the properties Profile lists for the account's kind. */
export function toProfile(account: Account): Profile {
  throw new Error(`not implemented for ${account.kind}`);
}
