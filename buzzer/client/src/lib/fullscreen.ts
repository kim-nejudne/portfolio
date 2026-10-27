// The browser may refuse fullscreen, for example outside a user gesture, and iPhone Safari has no
// `requestFullscreen` at all. There is nothing more to do then.

export function enterFullscreen(): void {
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {});
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else enterFullscreen();
}
