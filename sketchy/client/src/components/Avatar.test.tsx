// Emoji avatars (F53), which replace F27's doodle avatars: every chip shows the player's emoji on a
// disc in their colour, on the Screen and the phone alike, and never draws a doodle.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InkOp, PlayerChipView } from '../../../shared/types.js';
import { DoodleContext, createScreenDoodles } from '../lib/doodles.js';
import { Avatar } from './Avatar.js';
import { LobbyChip } from './screen/PlayerChip.js';

const chip = (hasDoodle: boolean): PlayerChipView => ({
  pid: 'mika',
  name: 'Mika',
  color: '#FF6B35',
  avatar: '🐙',
  connected: true,
  crown: false,
  isDrawer: false,
  hasDoodle,
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
});

const stroke: InkOp[] = [
  ['b', 1, 0, 1, 100, 100],
  ['p', 1, 40, 40],
  ['e', 1],
];

/** As on a Screen: the doodle store holds Mika's lobby doodle. */
function onScreen(node: ReactNode) {
  const doodles = createScreenDoodles();
  doodles.replace({ mika: stroke });
  return renderToStaticMarkup(<DoodleContext value={doodles}>{node}</DoodleContext>);
}

describe('the avatar', () => {
  it('is the emoji on a disc in the player’s colour, sized as asked', () => {
    const html = renderToStaticMarkup(<Avatar player={chip(false)} size="2em" />);
    expect(html).toContain('>🐙</span>');
    expect(html).toContain('background:#FF6B35');
    expect(html).toContain('width:2em');
    expect(html).toContain('aria-hidden');
  });

  it('is the emoji even when the Screen holds a lobby doodle: no doodle avatars any more', () => {
    const html = onScreen(<Avatar player={chip(true)} />);
    expect(html).toContain('>🐙</span>');
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain('>M</span>');
  });

  it('shows on the lobby chip beside the name', () => {
    const html = onScreen(
      <ul>
        <LobbyChip player={chip(true)} />
      </ul>,
    );
    expect(html).toContain('>🐙</span>');
    expect(html).toContain('Mika');
    expect(html).not.toContain('<canvas');
  });
});
