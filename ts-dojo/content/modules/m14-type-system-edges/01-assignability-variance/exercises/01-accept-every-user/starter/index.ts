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

export const notifier: Notifier = {
  send: (admin: Admin, message: string) =>
    `${admin.name} [${admin.permissions.join(', ')}]: ${message}`,
};
