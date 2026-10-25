// BUILD and track exist at run time: the page defines them before this module runs
// (page.ts stands in for it). globals.ts tells TypeScript about them.

/** 'v2.4.1' in a release build, 'v2.4.1 (debug)' in a debug build. */
export function versionLabel(): string {
  return BUILD.debug ? `v${BUILD.version} (debug)` : `v${BUILD.version}`;
}

/** The major version: 2 for '2.4.1'. */
export function majorVersion(): number {
  return Number(BUILD.version.split('.')[0]);
}

/** Tracks that a screen opened, with the build's version, and returns the event's name. */
export function openScreen(screen: string): string {
  const event = `open:${screen}`;
  track(event, { version: BUILD.version });
  return event;
}
