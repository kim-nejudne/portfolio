import { describe, expect, it } from 'vitest';
import type { Ack } from '../../../shared/types.js';
import { hostRefusalCopy, sendHost } from './hostSend.js';
import type { GameSocket } from './socket.js';

/** A connected socket whose every host action is answered with `res`. */
const answering = (res: Ack, connected = true) =>
  ({
    connected,
    timeout: () => ({ emitWithAck: () => Promise.resolve(res) }),
  }) as unknown as GameSocket;

describe('hostRefusalCopy', () => {
  it('names the refusals a host can act on', () => {
    expect(hostRefusalCopy('notAvailable')).toBe('notYet');
    expect(hostRefusalCopy('notEnoughPlayers')).toBe('needTwoPlayers');
  });

  it('says "Too fast" over the host action limit (F44)', () => {
    expect(hostRefusalCopy('rateLimited')).toBe('tooFast');
  });

  it('leaves the rest to the next snapshot', () => {
    expect(hostRefusalCopy('wrongPhase')).toBeNull();
    expect(hostRefusalCopy('notHost')).toBeNull();
  });
});

describe('sendHost', () => {
  it('resolves with the refusal’s message, or null when it went through', async () => {
    const skip = (res: Ack) => sendHost(answering(res), 'host:skip', {});
    expect(await skip({ ok: true })).toBeNull();
    expect(await skip({ ok: false, error: 'rateLimited' })).toBe('tooFast');
    expect(await skip({ ok: false, error: 'wrongPhase' })).toBeNull();
  });

  it('sends nothing offline', async () => {
    expect(await sendHost(answering({ ok: true }, false), 'host:skip', {})).toBe(
      'hostActionFailed',
    );
  });
});
