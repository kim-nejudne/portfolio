export interface User {
  id: number;
  name: string;
  banned: boolean;
}

export const users: readonly User[] = [
  { id: 1, name: 'Ada', banned: false },
  { id: 2, name: 'Grace', banned: false },
  { id: 3, name: 'Mallory', banned: true },
  { id: 4, name: 'Linus', banned: false },
  { id: 5, name: 'Eve', banned: true },
];

export async function findUser(id: number): User | undefined {
  return users.find((user) => user.id === id);
}

export async function isBanned(id: number): Promise<boolean> {
  const user = await findUser(id);
  return user?.banned ?? false;
}

export async function greet(id: number): Promise<string> {
  if (isBanned(id)) {
    return 'Access denied';
  }
  const user = await findUser(id);
  return user ? `Hello, ${user.name}` : 'Who are you?';
}
