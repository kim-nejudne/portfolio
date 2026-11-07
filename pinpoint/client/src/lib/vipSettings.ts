// The VIP's last lobby settings, kept on their device and applied to the next room they lead
// (spec: VIP controls). Storage can be unavailable or hold junk, so reads are guarded field by field.

import {
  DIFFICULTY_CHOICES,
  MODES,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  WORLD_ID,
} from '#shared/constants.js';
import type { CategorySummary, GameSettings } from '#shared/types.js';

const KEY = 'pinpoint:vipSettings';

export function saveVipSettings(settings: GameSettings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Without storage the next room starts from the defaults.
  }
}

/** The remembered fields that are still valid values; anything else is dropped. */
export function loadVipSettings(): Partial<GameSettings> {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') as Record<
      string,
      unknown
    >;
    const out: Partial<GameSettings> = {};
    const pick = <K extends keyof GameSettings>(k: K, options: readonly unknown[]) => {
      if (options.includes(raw[k])) out[k] = raw[k] as GameSettings[K];
    };
    if (typeof raw.categoryId === 'string') out.categoryId = raw.categoryId;
    pick('mode', MODES);
    pick('difficulty', DIFFICULTY_CHOICES);
    pick('rounds', ROUND_OPTIONS);
    pick('timerSeconds', TIMER_OPTIONS);
    return out;
  } catch {
    return {};
  }
}

/** World (id `world`, the slug of its name) when it exists, else the first by name (spec: VIP controls). */
export function defaultCategory(categories: CategorySummary[]): CategorySummary | undefined {
  return (
    categories.find((c) => c.id === WORLD_ID) ??
    [...categories].sort((a, b) => a.name.localeCompare(b.name))[0]
  );
}

/**
 * What a fresh room led by this device should get: the remembered settings, with the remembered
 * category only while it is still live, else the default category.
 */
export function initialSettings(categories: CategorySummary[]): Partial<GameSettings> {
  const remembered = loadVipSettings();
  const live = categories.some((c) => c.id === remembered.categoryId);
  const categoryId = live ? remembered.categoryId : defaultCategory(categories)?.id;
  return { ...remembered, ...(categoryId ? { categoryId } : {}) };
}
