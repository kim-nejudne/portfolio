import { GLOBAL_IMAGES_MAX_BYTES, ROOM_IMAGES_MAX_BYTES } from '../shared/constants.js';

/** One uploaded question image: its bytes and the media type it is served with. */
export interface RoomImage {
  type: string;
  data: Buffer;
}

/** `ok`, or which cap the upload would break: the room's 50 MB or the server-wide total. */
export type PutImageResult = 'ok' | 'room-full' | 'server-full';

/**
 * Uploaded images, in memory beside their room (Images: "The server keeps images in memory").
 * Kept apart from `RoomStore`: the reducer never sees image bytes, and snapshots stay small.
 */
export interface ImageStore {
  get(code: string, imageId: string): RoomImage | undefined;
  /** Stores or replaces one image. A replacement counts only its own size, not the old one's. */
  put(code: string, imageId: string, image: RoomImage): PutImageResult;
  /** Frees every image of a room, when the room is deleted. */
  deleteRoom(code: string): void;
  /** Bytes held across all rooms. */
  readonly totalBytes: number;
}

export class InMemoryImageStore implements ImageStore {
  private readonly rooms = new Map<string, Map<string, RoomImage>>();
  private total = 0;

  constructor(
    private readonly roomMaxBytes = ROOM_IMAGES_MAX_BYTES,
    private readonly globalMaxBytes = GLOBAL_IMAGES_MAX_BYTES,
  ) {}

  get(code: string, imageId: string): RoomImage | undefined {
    return this.rooms.get(code)?.get(imageId);
  }

  put(code: string, imageId: string, image: RoomImage): PutImageResult {
    const images = this.rooms.get(code) ?? new Map<string, RoomImage>();
    const replaced = images.get(imageId)?.data.length ?? 0;
    const growth = image.data.length - replaced;
    if (roomBytes(images) + growth > this.roomMaxBytes) return 'room-full';
    if (this.total + growth > this.globalMaxBytes) return 'server-full';

    images.set(imageId, image);
    this.rooms.set(code, images);
    this.total += growth;
    return 'ok';
  }

  deleteRoom(code: string): void {
    const images = this.rooms.get(code);
    if (!images) return;
    this.total -= roomBytes(images);
    this.rooms.delete(code);
  }

  get totalBytes(): number {
    return this.total;
  }
}

function roomBytes(images: Map<string, RoomImage>): number {
  let bytes = 0;
  for (const image of images.values()) bytes += image.data.length;
  return bytes;
}
