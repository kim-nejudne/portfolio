// "Add your own words" (F48): the panel the token Screen and the crown phone open in the lobby.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { translator } from '../lib/copy.js';
import type { GameSocket } from '../lib/socket.js';
import { CustomWordsPanel } from './CustomWords.js';

const t = translator('en');
const socket = {} as GameSocket;
const panel = (count: number, onScreen: boolean) =>
  renderToStaticMarkup(
    <CustomWordsPanel count={count} socket={socket} t={t} onClose={() => {}} onScreen={onScreen} />,
  );

describe('CustomWordsPanel', () => {
  it('is a dialog with the box, the rules, Add and the count', () => {
    const html = panel(12, false);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Add your own words');
    expect(html).toContain('One per line, or separate them with commas. Up to 100 words.');
    expect(html).toContain('<textarea');
    expect(html).toContain('Add words');
    expect(html).toContain('Our words: 12');
    expect(html).toContain('Clear all');
  });

  it('has nothing to clear with no words in', () => {
    expect(panel(0, false)).not.toContain('Clear all');
  });

  it('warns on the Screen that everyone can read it, and not on the phone', () => {
    expect(panel(0, true)).toContain('Everyone can see this screen');
    expect(panel(0, false)).not.toContain('Everyone can see this screen');
  });
});
