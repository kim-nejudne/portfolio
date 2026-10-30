// Lobby doodles as avatars (F27): UI by role and phase, Screen ("Chips show each player's lobby
// doodle as their avatar once they've drawn one").
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { InkOp, PlayerChipView } from '../../../../shared/types.js';
import { DoodleContext, createScreenDoodles } from '../../lib/doodles.js';
import { Avatar, LobbyChip } from './PlayerChip.js';

const chip = (hasDoodle: boolean): PlayerChipView => ({
  pid: 'mika',
  name: 'Mika',
  color: '#FF6B35',
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

function withDoodles(node: ReactNode, ops: InkOp[] | null) {
  const doodles = createScreenDoodles();
  if (ops) doodles.replace({ mika: ops });
  return renderToStaticMarkup(<DoodleContext value={doodles}>{node}</DoodleContext>);
}

describe('the avatar', () => {
  it('is the doodle once the view says hasDoodle and the Screen holds it', () => {
    const html = withDoodles(<Avatar player={chip(true)} size="2em" />, stroke);
    expect(html).toContain('<canvas');
    expect(html).toContain('data-doodle');
    expect(html).not.toContain('>M<');
  });

  it('is the initial without hasDoodle, without the doodle, or with every stroke undone', () => {
    expect(withDoodles(<Avatar player={chip(false)} />, stroke)).toContain('>M</span>');
    expect(withDoodles(<Avatar player={chip(true)} />, null)).toContain('>M</span>');
    expect(withDoodles(<Avatar player={chip(true)} />, [...stroke, ['u']])).toContain('>M</span>');
  });

  it('is always the initial on a phone (no doodles there)', () => {
    const html = renderToStaticMarkup(<Avatar player={chip(true)} />);
    expect(html).toContain('>M</span>');
    expect(html).not.toContain('<canvas');
  });

  it('shows on the lobby chip too', () => {
    const html = withDoodles(
      <ul>
        <LobbyChip player={chip(true)} />
      </ul>,
      stroke,
    );
    expect(html).toContain('data-doodle');
    expect(html).toContain('Mika');
  });
});
