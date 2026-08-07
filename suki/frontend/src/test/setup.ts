/**
 * A real IndexedDB for the test process.
 *
 * `fake-indexeddb` is a full implementation of the IndexedDB spec backed by
 * memory, not a stub — transactions, key ranges and all. Dexie runs against it
 * unmodified, which is the only way a durability test means anything: mocking
 * Dexie would test that the queue calls `put`, when the claim being made is
 * that a sale is still there after the app is killed.
 */
import 'fake-indexeddb/auto';

// Node has had crypto.randomUUID on globalThis since 19, but the queue depends
// on it existing, so fail loudly here rather than at a confusing call site.
if (typeof globalThis.crypto?.randomUUID !== 'function') {
  throw new Error('crypto.randomUUID is unavailable; the operation log needs it.');
}
