// Admin test helpers (F80): cheap scrypt costs, so a test sign-in takes milliseconds.
import { hashAdminPassword } from '../admin.js';

/** N = 2^10: about 1 ms, 1 MB. Never used outside tests. */
export const TEST_SCRYPT = { N: 1024, r: 8, p: 1 } as const;

export const testHash = (password: string) => hashAdminPassword(password, TEST_SCRYPT);
