// Settings for a reading app. Each comment names the type its setting should have.

// The app's name, which never changes. Type: 'Reader'
export let appName = 'Reader';

// The open book's title, which changes when another book is opened. Type: string
export const bookTitle: String = 'Dune';

// The font sizes on offer, in order. The list never changes. Type: readonly [12, 14, 16, 20]
export const fontSizes = [12, 14, 16, 20];

// The display settings: fontSize can change, mode never does. Type: { mode: 'dark'; fontSize: number }
export const display = { mode: 'dark', fontSize: 14 } as const;
