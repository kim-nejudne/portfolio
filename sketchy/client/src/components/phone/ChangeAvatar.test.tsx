// Change avatar (F54): the dialog the phone lobby opens, and what it shows for each answer.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Ack, Avatar } from '../../../../shared/types.js';
import { translator } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { ChangeAvatarDialog, chooseAvatar, sendAvatar } from './ChangeAvatar.js';

const t = translator('en');

/** A socket stand-in: what `player:avatar` was sent with, and the ack (or a timeout) it gets. */
function fakeSocket(answer: Ack | 'timeout', connected = true) {
  const sent: unknown[] = [];
  const socket = {
    connected,
    timeout: () => ({
      emitWithAck: (event: string, payload: unknown) => {
        sent.push([event, payload]);
        return answer === 'timeout'
          ? Promise.reject(new Error('timeout'))
          : Promise.resolve(answer);
      },
    }),
  } as unknown as GameSocket;
  return { socket, sent };
}

describe('ChangeAvatarDialog', () => {
  const dialog = (avatar: Avatar) =>
    renderToStaticMarkup(
      <ChangeAvatarDialog
        avatar={avatar}
        socket={fakeSocket({ ok: true }).socket}
        t={t}
        onSaved={() => {}}
        onClose={() => {}}
      />,
    );

  it('is a dialog with the 24 avatars, the player’s own picked, and Done', () => {
    const html = dialog('🐙');
    expect(html).toContain('role="dialog"');
    expect(html).toMatch(/<h2 id="change-avatar-title"[^>]*>Change avatar<\/h2>/);
    expect(html.match(/aria-label="Avatar /g)).toHaveLength(24);
    expect([...html.matchAll(/aria-pressed="true"[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual([
      '🐙',
    ]);
    expect(html).toMatch(/<button[^>]*>Done<\/button>/);
  });
});

describe('sendAvatar', () => {
  it('sends player:avatar and shows nothing once the server took it', async () => {
    const { socket, sent } = fakeSocket({ ok: true });
    expect(await sendAvatar(socket, '🐸')).toBeNull();
    expect(sent).toEqual([['player:avatar', { avatar: '🐸' }]]);
  });

  it('says to slow down over the rate limit', async () => {
    expect(await sendAvatar(fakeSocket({ ok: false, error: 'rateLimited' }).socket, '🐸')).toBe(
      'tooFast',
    );
  });

  it('says it failed for any other refusal, no answer, or offline (sending nothing)', async () => {
    expect(await sendAvatar(fakeSocket({ ok: false, error: 'wrongPhase' }).socket, '🐸')).toBe(
      'avatarFailed',
    );
    expect(await sendAvatar(fakeSocket('timeout').socket, '🐸')).toBe('avatarFailed');
    const offline = fakeSocket({ ok: true }, false);
    expect(await sendAvatar(offline.socket, '🐸')).toBe('avatarFailed');
    expect(offline.sent).toEqual([]);
  });

  it('has the failure message in both languages', () => {
    expect(translator('en')('avatarFailed')).toBe('Could not change your avatar. Try again.');
    expect(translator('taglish')('avatarFailed')).toBe(
      'Hindi napalitan ang avatar mo. Subukan ulit.',
    );
  });
});

describe('chooseAvatar', () => {
  it('hands the new avatar to onSaved only once the server took it, then closes', async () => {
    const saved: Avatar[] = [];
    expect(
      await chooseAvatar(fakeSocket({ ok: true }).socket, '🐙', '🐸', (a) => saved.push(a)),
    ).toBeNull();
    expect(saved).toEqual(['🐸']);
  });

  it('keeps the dialog open with the message and saves nothing on a refusal', async () => {
    const saved: Avatar[] = [];
    const refused = fakeSocket({ ok: false, error: 'wrongPhase' }).socket;
    expect(await chooseAvatar(refused, '🐙', '🐸', (a) => saved.push(a))).toBe('avatarFailed');
    expect(saved).toEqual([]);
  });

  it('closes on the current avatar without sending anything', async () => {
    const { socket, sent } = fakeSocket({ ok: true });
    const saved: Avatar[] = [];
    expect(await chooseAvatar(socket, '🐙', '🐙', (a) => saved.push(a))).toBeNull();
    expect(sent).toEqual([]);
    expect(saved).toEqual([]);
  });
});
