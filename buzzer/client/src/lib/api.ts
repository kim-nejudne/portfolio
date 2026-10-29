import type {
  ConfigResponse,
  CreateRoomBody,
  CreateRoomResponse,
  HttpErrorBody,
  NewGameBody,
  PairingResponse,
  PairResponse,
  RoomExistsResponse,
} from '../../../shared/types.js';

/** What a 409 from `PUT /api/rooms/:code/set` means: another device already started the next game. */
export const NEW_GAME_TAKEN_MESSAGE = 'A new game has already been set up.';

/** `replaceSet` refused with 409, so the caller can close its picker instead of offering a retry. */
export class NewGameTakenError extends Error {
  constructor() {
    super(NEW_GAME_TAKEN_MESSAGE);
    this.name = 'NewGameTakenError';
  }
}

/** `GET /api/rooms/:code/exists`. Throws a readable Error when the server cannot answer. */
export async function roomExists(code: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${encodeURIComponent(code)}/exists`);
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = (await response.json().catch(() => null)) as
    RoomExistsResponse | HttpErrorBody | null;
  if (!response.ok || data === null || !('exists' in data) || typeof data.exists !== 'boolean') {
    throw new Error(
      data && 'error' in data ? data.error : `Could not check the room (${response.status}).`,
    );
  }
  return data.exists;
}

/** `GET /api/config`. Null when the server cannot answer: the Screen then uses its own origin. */
export async function fetchConfig(): Promise<ConfigResponse | null> {
  try {
    const response = await fetch('/api/config');
    const data = (await response.json()) as ConfigResponse;
    return response.ok && (typeof data.joinOrigin === 'string' || data.joinOrigin === null)
      ? data
      : null;
  } catch {
    return null;
  }
}

/** `GET /api/rooms/:code/images/:imageId`, the URL of a question's image. */
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

/**
 * `POST /api/rooms/:code/images/:imageId` with the room's hostToken. Sends the blob as is, with its
 * own type. Throws an Error carrying the server's message when the image is not stored.
 */
export async function uploadImage(
  code: string,
  hostToken: string,
  imageId: string,
  blob: Blob,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(imageUrl(code, imageId), {
      method: 'POST',
      headers: { authorization: `Bearer ${hostToken}`, 'content-type': blob.type },
      body: blob,
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (response.ok) return;
  const data = (await response.json().catch(() => null)) as HttpErrorBody | null;
  throw new Error(data?.error ?? `Could not upload an image (${response.status}).`);
}

/**
 * `PUT /api/rooms/:code/set` with the room's hostToken: the next game's set, in FINAL only
 * (DECISIONS F49). Throws `NewGameTakenError` on 409, else an Error carrying the server's message.
 */
export async function replaceSet(
  code: string,
  hostToken: string,
  body: NewGameBody,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${encodeURIComponent(code)}/set`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${hostToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  if (response.ok) return;
  if (response.status === 409) throw new NewGameTakenError();
  const data = (await response.json().catch(() => null)) as HttpErrorBody | null;
  throw new Error(data?.error ?? `Could not start a new game (${response.status}).`);
}

/** `POST /api/rooms/:code/pairing` with the room's hostToken: a fresh 6-digit pairing PIN (F70). */
export async function createPairingPin(code: string, hostToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${encodeURIComponent(code)}/pairing`, {
      method: 'POST',
      headers: { authorization: `Bearer ${hostToken}` },
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = (await response.json().catch(() => null)) as PairingResponse | HttpErrorBody | null;
  if (!response.ok || data === null || !('pin' in data) || typeof data.pin !== 'string') {
    throw new Error(
      data && 'error' in data ? data.error : `Could not make a PIN (${response.status}).`,
    );
  }
  return data.pin;
}

/**
 * `POST /api/rooms/:code/pair`: trades a pairing PIN for the room's hostToken (F70). Throws an Error
 * carrying the server's message (wrong or expired PIN, too many tries) when it is refused.
 */
export async function pairWithPin(code: string, pin: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`/api/rooms/${encodeURIComponent(code)}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = (await response.json().catch(() => null)) as PairResponse | HttpErrorBody | null;
  if (!response.ok || data === null || !('hostToken' in data)) {
    throw new Error(data && 'error' in data ? data.error : `Could not pair (${response.status}).`);
  }
  return data.hostToken;
}
