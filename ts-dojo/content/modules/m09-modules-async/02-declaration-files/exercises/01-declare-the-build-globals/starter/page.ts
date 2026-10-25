// Stands in for the page: it defines the two globals, then calls into index.ts.
// This file is right as it is: leave it alone.
import { openScreen, versionLabel } from './index';

Object.assign(globalThis, {
  BUILD: { version: '2.4.1', debug: true },
  track: (event: string, data: object) => console.log('track', event, data),
});

console.log(versionLabel());
console.log(openScreen('settings'));
