import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../../shared/constants.js';
import { roomCodeSchema } from '../../../shared/schemas.js';

/**
 * Cleans what the player typed or pasted into the join input: upper case,
 * only letters from the room-code alphabet, at most ROOM_CODE_LENGTH of them.
 */
export function normalizeRoomCode(raw: string): string {
  let code = '';
  for (const char of raw.toUpperCase()) {
    if (!ROOM_CODE_ALPHABET.includes(char)) continue;
    code += char;
    if (code.length === ROOM_CODE_LENGTH) break;
  }
  return code;
}

/** True when the code is ready to submit. Uses the same schema the server checks. */
export function isCompleteRoomCode(code: string): boolean {
  return roomCodeSchema.safeParse(code).success;
}
