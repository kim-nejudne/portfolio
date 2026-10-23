export type Song = { title: string; artist: string };
export type Episode = { title: string; show: string; number: number };

export function isSong(item: Song | Episode): item is Song {
  return 'artist' in item;
}

export function credit(item: Song | Episode): string {
  if (isSong(item)) {
    return `${item.title} by ${item.artist}`;
  }
  return `${item.show} #${item.number}: ${item.title}`;
}
