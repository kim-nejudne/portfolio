export interface User {
  id: string;
  name: string;
  role: 'member' | 'guest';
}

export interface Admin extends User {
  role: 'admin';
  permissions: string[];
}

/** Members and admins can edit; guests can't. */
export function canEdit(user: User): boolean {
  return user.role === 'admin' || user.role === 'member';
}
