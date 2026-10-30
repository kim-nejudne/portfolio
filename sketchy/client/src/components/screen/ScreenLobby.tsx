import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { joinUrl, qrPath } from '../../lib/qr.js';
import { HOW_TO_PLAY } from '../../lib/screen.js';
import type { GameSocket } from '../../lib/socket.js';
import { usePointerCoarse } from '../../lib/usePointerCoarse.js';
import { LobbyChip } from './PlayerChip.js';
import { PlayersDialog } from './PlayersDialog.js';
import { ScreenSettings, SettingsButton, settingsLine } from './ScreenSettings.js';

/**
 * The lobby on the Screen: where to join, the code, who's in, and, on the Screen holding the
 * token, Start, the settings (F22) and the crown (F25): tapping a chip offers Give host crown and
 * Kick. Beside the join details, the QR to `/play/CODE` (F37), and under them the How to play
 * strip (F26). Tablet and phone Screens say "Keep this device plugged in" (F37). Custom words
 * (F48) come later.
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
  const coarse = usePointerCoarse();

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
      {/* On a short landscape Screen (a phone on its side) the join details and the players sit
          side by side, so Start stays on screen; otherwise they stack.
          SPEC-QUESTION: the spec draws one lobby for every landscape Screen (DECISIONS 55). */}
      <div
        inert={panelOpen || chipPlayer !== undefined}
        className="flex h-full flex-col gap-[3vmin] px-[5vmin] py-[4vmin] [@media(max-height:480px)]:gap-[2vmin] [@media(max-height:480px)]:py-[2.5vmin]"
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

        <div className="flex min-h-0 flex-1 flex-col gap-[3vmin] [@media(max-height:480px)]:flex-row [@media(max-height:480px)]:gap-[4vmin]">
          <div className="flex flex-col gap-[3vmin] [@media(max-height:480px)]:w-[44%] [@media(max-height:480px)]:shrink-0 [@media(max-height:480px)]:gap-[2vmin]">
            {/* The code never gives way: on a narrow or short Screen "Code:" goes above the
                letters and the QR shrinks into what's left (DECISIONS 59). */}
            <section className="flex items-center gap-[3vmin]">
              <div className="flex flex-col gap-[1vmin]">
                <p className="text-[max(4vmin,20px)]">
                  {t('joinAt')} <strong className="text-[#FF6B35]">{joinHost}</strong>
                </p>
                <p className="flex items-baseline gap-[2vmin] text-[max(4vmin,20px)] max-sm:flex-col max-sm:gap-0 [@media(max-height:480px)]:flex-col [@media(max-height:480px)]:gap-0">
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
                {coarse && <PluggedInNote t={t} />}
              </div>
              <JoinQr
                url={joinUrl(window.location.origin, view.code)}
                label={t('scanToJoin', { code: view.code })}
              />
            </section>

            <HowToPlay t={t} />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-[3vmin] [@media(max-height:480px)]:gap-[2vmin]">
            <ul className="flex flex-wrap items-center gap-[1.5vmin] text-[max(3.5vh,18px)] [@media(max-height:480px)]:text-[16px]">
              {view.players.map((p) => (
                <LobbyChip
                  key={p.pid}
                  player={p}
                  {...(view.host ? { onSelect: () => setChipPid(p.pid) } : {})}
                />
              ))}
              <li className="text-white/50">{t('waitingForMore')}</li>
            </ul>

            <div className="mt-auto flex flex-wrap items-end justify-between gap-[3vmin] text-[max(3vmin,16px)] [@media(max-height:480px)]:gap-[2vmin]">
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

/** Three steps, read from across the room: the whole rule, with typing (not saying) taught. */
export function HowToPlay({ t }: { t: Translate }) {
  return (
    <section aria-labelledby="how-to-play" className="shrink-0">
      <h2 id="how-to-play" className="sr-only">
        {t('howToPlay')}
      </h2>
      <ol className="flex flex-wrap gap-x-[4vmin] gap-y-[1vmin] text-[max(3.5vmin,18px)]">
        {HOW_TO_PLAY.map((step) => (
          <li key={step.key} className="flex items-center gap-[1.5vmin]">
            <span
              aria-hidden="true"
              className="grid size-[1.6em] shrink-0 place-items-center rounded-full bg-white/10"
            >
              {step.icon}
            </span>
            {t(step.key)}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * The join QR, dark on white with its quiet zone, as large as the lobby can spare: phones scan it
 * from the sofa. Its address is this Screen's own origin, so a Screen opened on the LAN address
 * (`npm run lan`) gives phones a QR they can reach.
 */
export function JoinQr({ url, label }: { url: string; label: string }) {
  const { size, d } = useMemo(() => qrPath(url), [url]);
  return (
    <svg
      role="img"
      aria-label={label}
      data-url={url}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="aspect-square w-[max(24vmin,104px)] min-w-16 shrink rounded-[1vmin] bg-white"
    >
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Tablet and phone Screens only: a Screen that sleeps or dies mid-game stops the room's drawing. */
export function PluggedInNote({ t }: { t: Translate }) {
  return <p className="text-[max(2.5vmin,14px)] text-[#FFD166]">{t('keepPluggedIn')}</p>;
}
