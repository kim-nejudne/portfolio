import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import type { GameSocket } from '../../lib/socket.js';
import { LobbyChip } from './PlayerChip.js';
import { PlayersDialog } from './PlayersDialog.js';
import { ScreenSettings, SettingsButton, settingsLine } from './ScreenSettings.js';

/**
 * The lobby on the Screen: where to join, the code, who's in, and, on the Screen holding the
 * token, Start, the settings (F22) and the crown (F25): tapping a chip offers Give host crown and
 * Kick. The QR (F37), How to play (F26) and custom words (F48) come later.
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

  // The settings panel covers the lobby; the lobby behind it is inert, and closing the panel puts
  // focus back on its button.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  useEffect(() => {
    if (wasOpen.current && !settingsOpen) settingsButton.current?.focus();
    wasOpen.current = settingsOpen;
  }, [settingsOpen]);
  const panelOpen = settingsOpen && view.host !== null;

  // A tapped chip's dialog, for as long as that player is still here.
  const [chipPid, setChipPid] = useState<string | null>(null);
  const closeChip = useCallback(() => setChipPid(null), []);
  const chipPlayer = view.host ? view.players.find((p) => p.pid === chipPid) : undefined;

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
    <div className="relative h-full">
      <div
        inert={panelOpen || chipPlayer !== undefined}
        className="flex h-full flex-col gap-[3vmin] px-[5vmin] py-[4vmin]"
      >
        <div className="flex items-start justify-between gap-[3vmin]">
          <h1 className="font-display text-[max(5vmin,28px)] font-bold">✏️ Sketchy</h1>
          {view.host && (
            <SettingsButton
              ref={settingsButton}
              open={panelOpen}
              onOpen={() => setSettingsOpen(true)}
              t={t}
            />
          )}
        </div>

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
            <LobbyChip
              key={p.pid}
              player={p}
              {...(view.host ? { onSelect: () => setChipPid(p.pid) } : {})}
            />
          ))}
          <li className="text-white/50">{t('waitingForMore')}</li>
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-[3vmin] text-[max(3vmin,16px)]">
          <div className="flex flex-col gap-[1vmin]">
            <p>
              {view.host
                ? host && t('isHostingTapToChange', { name: host.name })
                : host
                  ? t('waitingForHostToStart', { name: host.name })
                  : t('waitingForPlayers')}
            </p>
            <p className="text-white/60">{settingsLine(t, settings)}</p>
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
                  (connected < 2
                    ? t('needTwoPlayers')
                    : connected === 2
                      ? t('betterWithThree')
                      : '')}
              </p>
            </div>
          )}
        </div>
      </div>
      {panelOpen && (
        <ScreenSettings settings={settings} socket={socket} t={t} onClose={closeSettings} />
      )}
      {chipPlayer && !panelOpen && (
        <PlayersDialog
          players={[chipPlayer]}
          title={chipPlayer.name}
          socket={socket}
          t={t}
          onClose={closeChip}
        />
      )}
    </div>
  );
}
