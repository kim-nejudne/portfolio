// HTTP calls from the landing page. Ported from Buzzr (buzzer/client/src/lib/api.ts), trimmed to
// Sketchy's two endpoints. No zod here: the client bundle stays small (F39), and the server is
// the one that validates.

import type {
  CreateRoomBody,
  CreateRoomResponse,
  HttpErrorBody,
  RoomExistsResponse,
} from '../../../shared/types.js';

const UNREACHABLE = 'Could not reach the server. Check your connection and try again.';

/** `POST /api/rooms`. Throws an Error carrying the server's message when no room is created. */
export async function createRoom(body: CreateRoomBody = {}): Promise<CreateRoomResponse> {
  let response: Response;
  try {
    response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  const data = (await response.json().catch(() => null)) as
    CreateRoomResponse | HttpErrorBody | null;
  if (!response.ok || data === null || !('code' in data) || !('hostToken' in data)) {
    throw new Error(
      data && 'error' in data ? data.error : `Could not start a game (${response.status}).`,
    );
  }
  return data;
}

/** `GET /api/rooms/:code/exists`. Throws a readable Error when the server cannot answer. */
export async function roomExists(code: string): Promise<RoomExistsResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${encodeURIComponent(code)}/exists`);
  } catch {
    throw new Error(UNREACHABLE);
  }
  const data = (await response.json().catch(() => null)) as
    RoomExistsResponse | HttpErrorBody | null;
  if (!response.ok || data === null || !('exists' in data) || typeof data.exists !== 'boolean') {
    throw new Error(
      data && 'error' in data ? data.error : `Could not check the code (${response.status}).`,
    );
  }
  return data;
}
