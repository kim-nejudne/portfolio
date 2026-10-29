import { vi } from 'vitest';

// Stand-ins for the share sheet and the download link, which jsdom lacks (F78).

type ShareNavigator = Navigator & { canShare?: unknown; share?: unknown };

/** A share sheet that accepts files, recording what it was given. Undo with `unstubShare`. */
export function stubShare(): ShareData[] {
  const shared: ShareData[] = [];
  const nav = navigator as ShareNavigator;
  nav.canShare = (data: ShareData) => Boolean(data.files?.length);
  nav.share = async (data: ShareData) => {
    shared.push(data);
  };
  return shared;
}

export function unstubShare(): void {
  const nav = navigator as ShareNavigator;
  Reflect.deleteProperty(nav, 'canShare');
  Reflect.deleteProperty(nav, 'share');
}

/** Records each download the page starts, by the link's file name. Undo with `vi.restoreAllMocks`. */
export function stubDownload(): string[] {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:card');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const downloads: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  return downloads;
}
