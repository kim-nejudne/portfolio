import { useEffect, useState } from 'react';
import { INK_FLUSH_MS, PING_INTERVAL_MS } from '../../../../shared/constants.js';
import type { Ack, ClientAckData, PlayerChipView } from '../../../../shared/types.js';
import type { ClockOffset, DelayStats, DelayWindow } from '../../lib/clock.js';
import type { GameSocket } from '../../lib/socket.js';

/** The drawer waits half a flush on average before a point leaves the phone. */
const FLUSH_WAIT_MS = INK_FLUSH_MS / 2;
const REFRESH_MS = 1_000;
const RTT_ACK_TIMEOUT_MS = 5_000;

const ms = (v: number | undefined) => (v === undefined ? '–' : `${Math.round(v)} ms`);
const plus = (v: number | undefined, d: number) => (v === undefined ? undefined : v + d);

/** What the `?debug=1` overlay shows: the ink delay over the last batches and each player's RTT. */
export function DebugReadout({
  stats,
  offset,
  rtt,
  players,
}: {
  stats: DelayStats;
  offset: number | undefined;
  rtt: Record<string, number>;
  players: PlayerChipView[];
}) {
  return (
    <aside
      aria-label="Debug: ink delay"
      className="pointer-events-none absolute top-[2vmin] left-[2vmin] z-20 max-h-[45vh] max-w-[45vw] overflow-hidden rounded-lg bg-black/80 px-[1.5vmin] py-[1vmin] font-mono text-[max(2.2vmin,13px)] leading-snug text-white"
    >
      <p className="text-[max(3.2vmin,16px)] font-bold">
        p50 {ms(stats.p50)} · p95 {ms(stats.p95)}
      </p>
      <p>ink send → paint, last {stats.count} batches</p>
      <p>
        + {FLUSH_WAIT_MS} ms avg flush wait: p50 {ms(plus(stats.p50, FLUSH_WAIT_MS))} · p95{' '}
        {ms(plus(stats.p95, FLUSH_WAIT_MS))}
      </p>
      <p className="text-white/60">
        {offset === undefined
          ? 'clock offset: waiting for the server'
          : `clock offset: ${Math.round(offset)} ms`}
      </p>
      <ul className="flex flex-wrap gap-x-[1.5vmin]">
        {players.map((p) => (
          <li key={p.pid}>
            RTT {p.name}: {ms(rtt[p.pid])}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * The Screen's `?debug=1` overlay (spec "Test plan" → Ink delay measurement). Refreshes the delay
 * stats every second and asks the server for every player's RTT every PING_INTERVAL_MS.
 */
export function DebugOverlay({
  socket,
  clock,
  delays,
  players,
}: {
  socket: GameSocket;
  clock: ClockOffset;
  delays: DelayWindow;
  players: PlayerChipView[];
}) {
  const [stats, setStats] = useState(() => delays.stats());
  const [offset, setOffset] = useState(() => clock.offset());
  const [rtt, setRtt] = useState<Record<string, number>>({});

  useEffect(() => {
    const refresh = setInterval(() => {
      setStats(delays.stats());
      setOffset(clock.offset());
    }, REFRESH_MS);
    // One request at a time, so a late answer never overwrites a newer one.
    let asking = false;
    const askRtt = () => {
      if (asking || !socket.connected || document.hidden) return;
      asking = true;
      socket
        .timeout(RTT_ACK_TIMEOUT_MS)
        .emitWithAck('debug:rtt', {})
        .then((res) => {
          const answer = res as Ack<ClientAckData['debug:rtt']>;
          if (answer.ok) setRtt(answer.rtt);
        })
        .catch(() => {})
        .finally(() => {
          asking = false;
        });
    };
    askRtt();
    const poll = setInterval(askRtt, PING_INTERVAL_MS);
    return () => {
      clearInterval(refresh);
      clearInterval(poll);
    };
  }, [socket, clock, delays]);

  return <DebugReadout stats={stats} offset={offset} rtt={rtt} players={players} />;
}
