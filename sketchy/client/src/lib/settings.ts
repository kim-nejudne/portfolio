// Settings helpers for the host's settings panel. Presentation only: the server validates and
// applies `host:settings`; the panel renders whatever the next snapshot carries.

import { PRESETS, type PresetId } from '../../../shared/constants.js';
import type { RoomSettings } from '../../../shared/types.js';

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

/** The preset whose values the settings match, or null once any of them is changed by hand. */
export function presetOf(settings: RoomSettings): PresetId | null {
  return (
    PRESET_IDS.find((id) =>
      Object.entries(PRESETS[id].settings).every(
        ([key, value]) => settings[key as keyof RoomSettings] === value,
      ),
    ) ?? null
  );
}

const CATEGORY_PICK_KEY = 'sketchy:categories';
/** As `settings.categories` allows it (shared/constants.ts), so a stored pick never fails `POST /api/rooms`. */
const ID_MAX = 40;
const IDS_MAX = 100;

/**
 * The host's last category pick on this device (Host controls, Categories), or null when there is
 * none, it is empty, or it can't be read (blocked site data): a new room then gets the defaults.
 * The server drops ids that no longer exist when it applies it to a new room.
 */
export function loadCategoryPick(): string[] | null {
  try {
    const raw = globalThis.localStorage?.getItem(CATEGORY_PICK_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= ID_MAX)
      .slice(0, IDS_MAX);
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

/** Remembers the host's pick for the next room this device hosts. Fails quietly. */
export function saveCategoryPick(ids: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(CATEGORY_PICK_KEY, JSON.stringify(ids.slice(0, IDS_MAX)));
  } catch {
    // Private mode or blocked storage: the next room starts with the defaults.
  }
}

/** The pick after a tap on category `id`: added at the end, or taken out. */
export function toggleCategory(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id];
}
