let ctx: AudioContext | undefined;

/**
 * Unlocks audio: browsers only start an AudioContext from a user gesture, so call this inside the
 * Click to start handler. Does nothing where Web Audio is missing.
 * shortcut: a bare AudioContext, until the sounds feature (F56) replaces it with Howler's unlock.
 */
export function unlockAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}
