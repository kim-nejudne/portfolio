import { useEffect, useState } from 'react';
import type { PlayerChipView } from '../../../shared/types.js';
import type { Translate } from '../lib/copy.js';
import { CONFIRM_MS, twoTap, type ArmedTarget } from '../lib/hostKeys.js';
import { useHostSender } from '../lib/hostSend.js';
import type { GameSocket } from '../lib/socket.js';

const SIZES = {
  phone: {
    list: 'gap-2 text-lg',
    name: 'text-lg',
    dot: 'size-6',
    button: 'min-h-11 min-w-11 rounded-xl px-3 py-1 text-base',
    status: 'text-base',
  },
  screen: {
    list: 'gap-[1.5vmin] text-[max(3vmin,16px)]',
    name: 'text-[max(3.2vmin,18px)]',
    dot: 'size-[max(3vmin,20px)]',
    button: 'min-h-11 min-w-11 rounded-[1.5vmin] px-[2.5vmin] py-[1vmin] text-[max(2.6vmin,16px)]',
    status: 'text-[max(2.8vmin,16px)]',
  },
} as const;

/**
 * The host's players list (Host controls), on the token Screen and the crown phone: each player
 * with **Give host crown** (`host:crown`) and **Kick** (`host:kick`, two taps: "Remove Jun?").
 * The crown and the list come from the latest snapshot; nothing is predicted.
 */
export function HostPlayerList({
  players,
  socket,
  t,
  size,
  mePid = null,
}: {
  players: PlayerChipView[];
  socket: GameSocket;
  t: Translate;
  size: keyof typeof SIZES;
  /** The crown phone's own pid: no Give crown or Kick on yourself (Leave is for that). */
  mePid?: string | null;
}) {
  const { sending, status, send } = useHostSender(socket, t);
  const [armed, setArmed] = useState<ArmedTarget | null>(null);
  const sz = SIZES[size];

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const kick = (pid: string) => {
    if (sending) return;
    const tap = twoTap(pid, armed, performance.now());
    setArmed(tap.armed);
    if (tap.confirmed) void send(`kick:${pid}`, 'host:kick', { pid });
  };
  const giveCrown = (pid: string) => {
    if (sending) return;
    setArmed(null);
    void send(`crown:${pid}`, 'host:crown', { pid });
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className={`flex flex-col ${sz.list}`}>
        {players.map((p) => {
          const self = p.pid === mePid;
          const kickArmed = armed?.target === p.pid;
          return (
            <li
              key={p.pid}
              className={`flex flex-wrap items-center justify-between gap-2 ${p.connected ? '' : 'opacity-60'}`}
            >
              <span className={`flex min-w-0 items-center gap-2 font-semibold ${sz.name}`}>
                <span
                  aria-hidden
                  style={{ background: p.color }}
                  className={`${sz.dot} shrink-0 rounded-full`}
                />
                <span className="truncate">
                  {p.crown && '👑 '}
                  {p.name}
                  {self && ` (${t('you')})`}
                </span>
              </span>
              {!self && (
                <span className="flex flex-wrap gap-2">
                  {!p.crown && (
                    <button
                      type="button"
                      onClick={() => giveCrown(p.pid)}
                      aria-disabled={sending !== null}
                      className={`${sz.button} bg-white/15 font-bold aria-disabled:opacity-60`}
                    >
                      {t('giveCrown')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => kick(p.pid)}
                    aria-disabled={sending !== null}
                    className={`${sz.button} font-bold aria-disabled:opacity-60 ${
                      kickArmed ? 'bg-[#FFD166] text-[#1D1B22]' : 'bg-white/15'
                    }`}
                  >
                    {kickArmed ? t('kickConfirm', { name: p.name }) : t('kick')}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p role="status" className={`min-h-[1.5em] text-[#FFD166] ${sz.status}`}>
        {status ?? ''}
      </p>
    </div>
  );
}
