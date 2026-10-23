import type { Equal, Expect } from '@dojo/type-utils';
import { majorVersion, openScreen, versionLabel } from './index';

type cases = [
  Expect<Equal<typeof BUILD, { version: string; debug: boolean }>>, // BUILD is declared
  Expect<
    Equal<typeof track, (event: string, data: { version: string }) => void>
  >, // track is declared
  Expect<Equal<ReturnType<typeof versionLabel>, string>>, // versionLabel returns a string
  Expect<Equal<ReturnType<typeof majorVersion>, number>>, // majorVersion returns a number
  Expect<Equal<Parameters<typeof openScreen>, [screen: string]>>, // openScreen takes a screen
];

const tracked: Array<{ event: string; data: object }> = [];

/** Does what the page does: defines BUILD and track on globalThis. */
function page(version: string, debug: boolean): void {
  Object.assign(globalThis, {
    BUILD: { version, debug },
    track: (event: string, data: object) => {
      tracked.push({ event, data });
    },
  });
}

test('labels release and debug builds of many versions', () => {
  for (let major = 0; major <= 12; major += 3) {
    for (let minor = 0; minor <= 9; minor += 4) {
      const version = `${major}.${minor}.1`;
      page(version, false);
      expect(versionLabel()).toBe(`v${version}`);
      expect(majorVersion()).toBe(major);
      page(version, true);
      expect(versionLabel()).toBe(`v${version} (debug)`);
    }
  }
});

test('tracks each screen with the version the page defined', () => {
  tracked.length = 0;
  const screens = ['home', 'settings', 'cart'];
  screens.forEach((screen, i) => {
    page(`3.${i}.0`, false);
    expect(openScreen(screen)).toBe(`open:${screen}`);
  });
  expect(tracked).toEqual([
    { event: 'open:home', data: { version: '3.0.0' } },
    { event: 'open:settings', data: { version: '3.1.0' } },
    { event: 'open:cart', data: { version: '3.2.0' } },
  ]);
});
