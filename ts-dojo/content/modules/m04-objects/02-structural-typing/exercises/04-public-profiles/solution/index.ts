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
  switch (account.kind) {
    case 'person':
      return { kind: 'person', id: account.id, name: account.name };
    case 'bot':
      return {
        kind: 'bot',
        id: account.id,
        name: account.name,
        owner: account.owner,
      };
  }
}
