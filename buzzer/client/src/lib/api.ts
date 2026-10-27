import type {
  CreateRoomBody,
  CreateRoomResponse,
  HttpErrorBody,
  RoomExistsResponse,
} from '../../../shared/types.js';

/** `GET /api/rooms/:code/exists`. Throws a readable Error when the server cannot answer. */
export async function roomExists(code: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${encodeURIComponent(code)}/exists`);
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = (await response.json().catch(() => null)) as RoomExistsResponse | null;
  if (!response.ok || data === null || typeof data.exists !== 'boolean') {
    throw new Error(`Could not check the room (${response.status}).`);
  }
  return data.exists;
}

/** `GET /api/rooms/:code/images/:imageId`, the URL of a question's image. The server route comes with F30. */
export function imageUrl(code: string, imageId: string): string {
  return `/api/rooms/${encodeURIComponent(code)}/images/${encodeURIComponent(imageId)}`;
}

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
