export type Member = {
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  active: boolean;
};

/** The name of the first active admin in the list, or 'nobody' when there is none. */
export function firstAdmin(members: readonly Member[]): string {
  let admin: Member | undefined = undefined;
  members.forEach((member) => {
    if (admin === undefined && member.role === 'admin' && member.active) {
      admin = member;
    }
  });
  if (admin === undefined) {
    return 'nobody';
  }
  return admin.name;
}
