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
