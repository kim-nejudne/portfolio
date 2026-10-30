// Fullscreen for the Screen's "Tap to start" (Creating and joining a room: "requests fullscreen
// (where supported)"). Ported from Buzzr (buzzer/client/src/lib/fullscreen.ts). The browser may
// refuse it (outside a user gesture, or not allowed here), and iPhone Safari has no
// `requestFullscreen` at all; there is nothing more to do then.

/** The part of `document` this needs (a fake in tests). */
export interface FullscreenDocument {
  readonly fullscreenElement: Element | null;
  readonly documentElement: { requestFullscreen?: () => Promise<void> };
}

/** Asks for fullscreen unless already there. Call it inside the tap's handler. */
export function enterFullscreen(doc: FullscreenDocument = document): void {
  if (doc.fullscreenElement) return;
  try {
    doc.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    // Some browsers throw instead of rejecting.
  }
}
