// The browser may refuse fullscreen (outside a user gesture), and iPhone Safari has no
// `requestFullscreen` at all. There is nothing more to do then. (As Buzzr.)
export function enterFullscreen(): void {
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {});
}
