// The §7 settings object a page re-renders on (F10): read once, then replaced on every write,
// this tab's or another's (`subscribeSettings`). `useSyncExternalStore` needs the same object
// until something changes, so the snapshot is cached and swapped by the listener.
import { useSyncExternalStore } from 'react';
import {
  browserStorage,
  readSettings,
  subscribeSettings,
  type Settings,
} from './settings';

let snapshot: Settings | null = null;

function subscribe(onChange: () => void): () => void {
  return subscribeSettings((settings) => {
    snapshot = settings;
    onChange();
  });
}

function getSnapshot(): Settings {
  snapshot ??= readSettings(browserStorage());
  return snapshot;
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
