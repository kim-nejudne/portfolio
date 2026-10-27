import type { CreateRoomBody, CreateRoomResponse, HttpErrorBody } from '../../../shared/types.js';

/** `POST /api/rooms`. Throws an Error carrying the server's message when the room is not created. */
export async function createRoom(body: CreateRoomBody): Promise<CreateRoomResponse> {
  let response: Response;
  try {
    response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = (await response.json().catch(() => null)) as
    CreateRoomResponse | HttpErrorBody | null;
  if (!response.ok || data === null || !('code' in data)) {
    throw new Error(
      data && 'error' in data ? data.error : `Could not create a room (${response.status}).`,
    );
  }
  return data;
}
