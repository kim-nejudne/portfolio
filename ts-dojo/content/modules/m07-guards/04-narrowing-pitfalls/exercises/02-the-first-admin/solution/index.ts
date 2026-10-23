export type Member = {
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  active: boolean;
};

/** The name of the first active admin in the list, or 'nobody' when there is none. */
export function firstAdmin(members: readonly Member[]): string {
  const admin = members.find(
    (member) => member.role === 'admin' && member.active,
  );
  if (admin === undefined) {
    return 'nobody';
  }
  return admin.name;
}
