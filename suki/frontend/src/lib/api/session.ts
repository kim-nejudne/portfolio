// Session module. Exposes today's ISO (fixed at load) + shop identity.
// The rest of the app reads `session.getSession()` and never touches fixtures.

import { APP_TODAY, STORE } from './fixtures/customers';
import type { Session } from '../types';
import { delay } from './delay';

let session: Session = {
  storeName: STORE.storeName,
  barangay: STORE.barangay,
  today: APP_TODAY,
  defaultReorderPoint: STORE.defaultReorderPoint,
};

export async function getSession(): Promise<Session> {
  return delay(session);
}

export function getSessionSync(): Session {
  return session;
}

export function updateSession(partial: Partial<Session>): Session {
  session = { ...session, ...partial };
  return session;
}
