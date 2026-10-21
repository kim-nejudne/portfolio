// Settings for a reading app. Each comment names the type its setting should have.

// The app's name, which never changes. Type: 'Reader'
export const appName = 'Reader';

// The open book's title, which changes when another book is opened. Type: string
export let bookTitle = 'Dune';

// The font sizes on offer, in order. The list never changes. Type: readonly [12, 14, 16, 20]
export const fontSizes = [12, 14, 16, 20] as const;

// The display settings: fontSize can change, mode never does. Type: { mode: 'dark'; fontSize: number }
export const display = { mode: 'dark' as const, fontSize: 14 };
