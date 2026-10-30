import { useState } from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { LobbyChip } from './PlayerChip.js';

function wordsLabel(t: Translate, words: ScreenView['settings']['words']): string {
  if (words === 'en') return t('wordsEn');
  if (words === 'taglish') return t('wordsTaglish');
  return t('wordsMixed');
}

/**
 * The lobby on the Screen: where to join, the code, who's in, and, on the Screen holding the
 * token, Start. The QR (F37), How to play (F26), settings (F22) and the crown controls (F25)
 * come later.
 */
export function ScreenLobby({
  view,
  socket,
  t,
}: {
  view: ScreenView;
  socket: GameSocket;
  t: Translate;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = view.players.find((p) => p.crown);
  const connected = view.players.filter((p) => p.connected).length;
  const { settings } = view;
  const joinHost = window.location.host;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await socket.timeout(5000).emitWithAck('host:start', {});
      if (!res.ok)
        setError(res.error === 'notEnoughPlayers' ? t('needTwoPlayers') : t('startFailed'));
    } catch {
      setError(t('startFailed'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-[3vmin] px-[5vmin] py-[4vmin]">
      <h1 className="font-display text-[max(5vmin,28px)] font-bold">✏️ Sketchy</h1>

      <section className="flex flex-col gap-[1vmin]">
        <p className="text-[max(4vmin,20px)]">
          {t('joinAt')} <strong className="text-[#FF6B35]">{joinHost}</strong>
        </p>
        <p className="flex items-baseline gap-[2vmin] text-[max(4vmin,20px)]">
          {t('code')}:
          <span
            className="font-display text-[max(12vmin,56px)] leading-none font-bold tracking-[0.3em]"
            aria-label={view.code.split('').join(' ')}
          >
            {view.code}
          </span>
        </p>
        <p className="text-[max(2.5vmin,14px)] text-white/60 [@media(max-height:480px)]:hidden">
          {joinHost}/play/{view.code}
        </p>
      </section>

      <ul className="flex flex-wrap items-center gap-[1.5vmin] text-[max(3.5vh,18px)]">
        {view.players.map((p) => (
          <LobbyChip key={p.pid} player={p} />
        ))}
        <li className="text-white/50">{t('waitingForMore')}</li>
      </ul>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-[3vmin] text-[max(3vmin,16px)]">
        <div className="flex flex-col gap-[1vmin]">
          <p>
            {view.host
              ? host && t('isHosting', { name: host.name })
              : host
                ? t('waitingForHostToStart', { name: host.name })
                : t('waitingForPlayers')}
          </p>
          <p className="text-white/60">
            {t('settingsSummary', {
              seconds: settings.drawSeconds,
              cycles: settings.cycles === 1 ? t('roundOne') : t('rounds', { n: settings.cycles }),
              words: wordsLabel(t, settings.words),
            })}
          </p>
        </div>
        {view.host && (
          <div className="flex flex-col items-end gap-[1vmin]">
            <button
              type="button"
              onClick={start}
              disabled={starting || connected < 2}
              className="min-h-11 rounded-[2vmin] bg-[#FF6B35] px-[4vmin] py-[2vmin] text-[max(4.5vmin,22px)] font-bold text-[#1D1B22] disabled:opacity-40"
            >
              {t('startGame')}
            </button>
            <p className="text-white/70" role="status">
              {error ??
                (connected < 2 ? t('needTwoPlayers') : connected === 2 ? t('betterWithThree') : '')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
