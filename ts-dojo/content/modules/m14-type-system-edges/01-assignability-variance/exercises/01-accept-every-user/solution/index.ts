export interface User {
  id: string;
  name: string;
}

export interface Admin extends User {
  permissions: string[];
}

export function isAdmin(user: User): user is Admin {
  return 'permissions' in user;
}

// Every notifier is called with plain users and admins alike.
export type Notifier = {
  send: (user: User, message: string) => string;
};

// The parameter takes every User, so the function fits Notifier; the guard finds the admins.
export const notifier: Notifier = {
  send: (user: User, message: string) =>
    isAdmin(user)
      ? `${user.name} [${user.permissions.join(', ')}]: ${message}`
      : `${user.name}: ${message}`,
};
