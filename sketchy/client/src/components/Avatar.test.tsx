// Emoji avatars (F53), which replace F27's doodle avatars: every chip shows the player's emoji on a
// disc in their colour, on the Screen and the phone alike.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerChipView } from '../../../shared/types.js';
import { Avatar } from './Avatar.js';
import { LobbyChip } from './screen/PlayerChip.js';

const chip: PlayerChipView = {
  pid: 'mika',
  name: 'Mika',
  color: '#FF6B35',
  avatar: '🐙',
  connected: true,
  crown: false,
  isDrawer: false,
  guessed: false,
  turnPoints: 0,
  score: null,
  rank: null,
};

describe('the avatar', () => {
  it('is the emoji on a disc in the player’s colour, sized as asked', () => {
    const html = renderToStaticMarkup(<Avatar player={chip} size="2em" />);
    expect(html).toContain('>🐙</span>');
    expect(html).toContain('background:#FF6B35');
    expect(html).toContain('width:2em');
    expect(html).toContain('aria-hidden');
  });

  it('shows on the lobby chip beside the name', () => {
    const html = renderToStaticMarkup(
      <ul>
        <LobbyChip player={chip} />
      </ul>,
    );
    expect(html).toContain('>🐙</span>');
    expect(html).toContain('Mika');
    expect(html).not.toContain('<canvas');
  });
});
