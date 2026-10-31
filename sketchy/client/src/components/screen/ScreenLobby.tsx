import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { joinUrl, qrPath } from '../../lib/qr.js';
import { HOW_TO_PLAY, type ScreenLayout } from '../../lib/screen.js';
import type { GameSocket } from '../../lib/socket.js';
import { usePointerCoarse } from '../../lib/usePointerCoarse.js';
import { CustomWordsButton, CustomWordsPanel } from '../CustomWords.js';
import { sketchButtonClass } from '../sketch/SketchButton.js';
import { Tape } from '../sketch/Tape.js';
import { PlayersDialog } from './PlayersDialog.js';
import { ScreenDesk } from './ScreenDesk.js';
import { ScreenSettings, SettingsButton, settingsLine } from './ScreenSettings.js';

/** The Screen's small hand-bordered buttons beside "Who's here" (Settings, Add your own words). */
export const SMALL_GHOST = `${sketchButtonClass('ghost')} min-h-11! px-[2vmin]! text-[max(2.8vmin,16px)]! shadow-[0.28vmin_0.42vmin_0_var(--color-ink)]!`;

/**
 * The lobby on the Screen, a spread of the notebook (F62): the left page has the logo, where to
 * join, the code with the taped QR to `/play/CODE` (F37) and How to play (F26); tablet and phone
 * Screens also say "Keep this device plugged in" (F37). The right page has "Who's here" (the
 * players are the index tabs beside it) and, on the Screen holding the token, Settings (F22), "Add
 * your own words" (F48) and Start; tapping a tab offers Give host crown and Kick (F25).
 */
export function ScreenLobby({
  view,
  socket,
  t,
  layout = 'landscape',
}: {
  view: ScreenView;
  socket: GameSocket;
  t: Translate;
  layout?: ScreenLayout;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = view.players.find((p) => p.crown);
  const connected = view.players.filter((p) => p.connected).length;
  const { settings } = view;
  const joinHost = window.location.host;
  const coarse = usePointerCoarse();

  // The settings panel covers the lobby; the lobby behind it is inert, and closing the panel puts
  // focus back on its button. (The closers list their setters, which never change, so the React
  // Compiler can keep their memoization now that the pages are built before the desk.)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), [setSettingsOpen]);
  useEffect(() => {
    if (wasOpen.current && !settingsOpen) settingsButton.current?.focus();
    wasOpen.current = settingsOpen;
  }, [settingsOpen]);
  const panelOpen = settingsOpen && view.host !== null;

  // "Add your own words" likewise covers the lobby, and gives focus back to its button.
  const [wordsOpen, setWordsOpen] = useState(false);
  const wordsButton = useRef<HTMLButtonElement>(null);
  const wordsWasOpen = useRef(false);
  const closeWords = useCallback(() => setWordsOpen(false), [setWordsOpen]);
  useEffect(() => {
    if (wordsWasOpen.current && !wordsOpen) wordsButton.current?.focus();
    wordsWasOpen.current = wordsOpen;
  }, [wordsOpen]);
  const wordsPanelOpen = wordsOpen && view.host !== null && !panelOpen;

  // A tapped tab's dialog, for as long as that player is still here.
  const [chipPid, setChipPid] = useState<string | null>(null);
  const closeChip = useCallback(() => setChipPid(null), [setChipPid]);
  const chipPlayer = view.host ? view.players.find((p) => p.pid === chipPid) : undefined;

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await socket.timeout(5000).emitWithAck('host:start', {});
      if (!res.ok)
        setError(
          t(
            res.error === 'notEnoughPlayers'
              ? 'needTwoPlayers'
              : res.error === 'rateLimited'
                ? 'tooFast'
                : 'startFailed',
          ),
        );
    } catch {
      setError(t('startFailed'));
    } finally {
      setStarting(false);
    }
  };

  const hostingLine = view.host
    ? host && t('isHostingTapToChange', { name: host.name })
    : host
      ? t('waitingForHostToStart', { name: host.name })
      : t('waitingForPlayers');

  // The left page: the logo, where to join, the code with the taped QR, and How to play.
  const left = (
    <div className="flex h-full min-h-0 flex-col items-start gap-[2vmin]">
      <h1 className="relative text-[max(8.9vmin,32px)] leading-none font-normal">
        Sketchy
        {/* The pen scribble under the logo: decoration, so only it tilts. */}
        <span
          aria-hidden
          className="absolute right-[1.4vmin] -bottom-[0.8vmin] left-0 h-[1.4vmin] -rotate-[1.5deg] rounded-b-[60%_100%_40%_100%] border-b-[length:max(2px,0.56vmin)] border-pen"
        />
      </h1>
      <p className="text-[max(3.6vmin,16px)] leading-tight">
        {t('joinAt')} {joinHost}
      </p>
      {/* The code never gives way: where the page is too narrow for both, the QR goes under it. */}
      <section className="flex max-w-full flex-wrap items-center gap-x-[3.9vmin] gap-y-[2vmin]">
        <p className="sr-only">
          {t('code')}: {view.code}
        </p>
        <CodeCells code={view.code} />
        <div className="relative shrink-0">
          <Tape place="tl" />
          <JoinQr
            url={joinUrl(window.location.origin, view.code)}
            label={t('scanToJoin', { code: view.code })}
          />
        </div>
      </section>
      {coarse && <PluggedInNote t={t} />}
      <HowToPlay t={t} className="mt-auto" />
    </div>
  );

  // The right page: who's here (the tabs stand beside it), the host line, the settings and Start.
  const right = (
    <div className="flex h-full min-h-0 flex-col gap-[1.6vmin] text-[max(3vmin,15px)] leading-snug">
      <h2 className="text-[max(4.4vmin,20px)] leading-none font-normal">{t('whosHere')}</h2>
      <p>{hostingLine}</p>
      <p className="text-soft">{settingsLine(t, settings)}</p>
      <p className="text-soft">{t('waitingForMore')}</p>
      {view.host && (
        <div className="mt-auto flex flex-col gap-[1.4vmin]">
          {/* Portrait has the width but not the height: the small buttons share Start's row. */}
          <div className="flex flex-wrap items-center gap-[1.6vmin]">
            <SettingsButton
              ref={settingsButton}
              open={panelOpen}
              onOpen={() => setSettingsOpen(true)}
              t={t}
              className={SMALL_GHOST}
            />
            <CustomWordsButton
              ref={wordsButton}
              count={view.host.customWordCount}
              open={wordsPanelOpen}
              onOpen={() => setWordsOpen(true)}
              t={t}
              className={SMALL_GHOST}
            />
            <button
              type="button"
              onClick={start}
              disabled={starting || connected < 2}
              className={`${sketchButtonClass('primary', layout === 'landscape')} ${
                layout === 'portrait' ? 'min-w-[16rem] flex-1' : ''
              } min-h-[max(9vmin,48px)]! text-[max(4.4vmin,22px)]! shadow-[0.42vmin_0.56vmin_0_var(--color-ink)]!`}
            >
              {t('startGame')}
            </button>
          </div>
          <p className="text-center" role="status">
            {error ??
              (connected < 2 ? t('needTwoPlayers') : connected === 2 ? t('betterWithThree') : '')}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative h-full">
      <div inert={panelOpen || wordsPanelOpen || chipPlayer !== undefined} className="h-full">
        <ScreenDesk
          layout={layout}
          code={view.code}
          players={view.players}
          {...(view.host ? { onSelectPlayer: (pid: string) => setChipPid(pid) } : {})}
          left={left}
          right={right}
        />
      </div>
      {/* The panels keep the old dark look until F63 restyles them (`legacy-ink`, DECISIONS 85). */}
      {panelOpen && (
        <div className="legacy-ink">
          <ScreenSettings settings={settings} socket={socket} t={t} onClose={closeSettings} />
        </div>
      )}
      {wordsPanelOpen && (
        <div className="legacy-ink">
          <CustomWordsPanel
            count={view.host!.customWordCount}
            socket={socket}
            t={t}
            onClose={closeWords}
            onScreen
          />
        </div>
      )}
      {chipPlayer && !panelOpen && !wordsPanelOpen && (
        <div className="legacy-ink">
          <PlayersDialog
            players={[chipPlayer]}
            title={chipPlayer.name}
            socket={socket}
            t={t}
            onClose={closeChip}
          />
        </div>
      )}
    </div>
  );
}

/** The room code as four Nunito cells on `pen` underlines; the sr-only line before it says it. */
function CodeCells({ code }: { code: string }) {
  return (
    <p aria-hidden className="flex shrink-0 gap-[1.7vmin]">
      {[...code].map((ch, i) => (
        <span
          key={i}
          className="w-[8.9vmin] min-w-9 border-b-[length:max(3px,0.7vmin)] border-pen text-center font-num text-[max(9.4vmin,40px)] leading-none font-black"
        >
          {ch}
        </span>
      ))}
    </p>
  );
}

/**
 * Three steps, read from across the room: the whole rule, with typing (not saying) taught. Each is
 * numbered in a `pen` circle; screen readers hear the copy as written ("1 · One person draws…").
 */
export function HowToPlay({ t, className = '' }: { t: Translate; className?: string }) {
  return (
    <section aria-labelledby="how-to-play" className={`shrink-0 ${className}`.trim()}>
      <h2 id="how-to-play" className="sr-only">
        {t('howToPlay')}
      </h2>
      <ol className="grid gap-[1.1vmin] text-[max(3.3vmin,16px)] leading-tight">
        {HOW_TO_PLAY.map((step, i) => {
          const text = t(step.key);
          return (
            <li key={step.key} className="flex items-center gap-[1.4vmin]">
              <span className="sr-only">{text}</span>
              <span
                aria-hidden
                className="grid size-[max(5vmin,26px)] shrink-0 place-items-center rounded-full border-[length:max(2px,0.35vmin)] border-pen font-num text-[max(2.5vmin,13px)] font-black text-pen"
              >
                {i + 1}
              </span>
              <span aria-hidden>{text.replace(/^\d+\s*·\s*/, '')}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * The join QR, `ink` on the canvas white with its quiet zone, in an `ink` frame (taped on by its
 * parent), as large as the lobby can spare: phones scan it from the sofa. Its address is this Screen's own origin, so a Screen opened on the LAN address
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
      className="block aspect-square w-[max(19vmin,88px)] border-[length:max(2px,0.28vmin)] border-ink bg-canvas text-ink"
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** Tablet and phone Screens only: a Screen that sleeps or dies mid-game stops the room's drawing. */
export function PluggedInNote({ t }: { t: Translate }) {
  return (
    <p className="bg-sticky px-[1.4vmin] py-[0.6vmin] text-[max(2.8vmin,14px)] leading-tight text-ink shadow-[0.28vmin_0.28vmin_0_var(--color-ink)]">
      {t('keepPluggedIn')}
    </p>
  );
}
