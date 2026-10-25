export interface User {
  id: number;
  name: string;
}

export interface Post {
  id: number;
  title: string;
}

export interface Api {
  user(id: number): Promise<User>;
  posts(userId: number): Promise<Post[]>;
  unread(userId: number): Promise<number>;
}

export interface Dashboard {
  user: User;
  posts: Post[];
  unread: number;
}

/** Settles as `promise` does, or rejects with Error('timeout') once `ms` milliseconds pass. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]);
}

/** Starts the three calls at once and resolves when all are done, within `ms`. */
export async function loadDashboard(
  api: Api,
  userId: number,
  ms: number,
): Promise<Dashboard> {
  const [user, posts, unread] = await withTimeout(
    Promise.all([api.user(userId), api.posts(userId), api.unread(userId)]),
    ms,
  );
  return { user, posts, unread };
}
