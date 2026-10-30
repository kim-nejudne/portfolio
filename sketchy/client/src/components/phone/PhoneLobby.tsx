import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerView } from '../../../../shared/types.js';
import { doodleKey, type SendDoodle } from '../../ink/doodle.js';
import type { Translate } from '../../lib/copy.js';
import { useHostSender } from '../../lib/hostSend.js';
import type { GameSocket } from '../../lib/socket.js';
import { CustomWordsButton, CustomWordsPanel } from '../CustomWords.js';
import { HostPlayerList } from '../HostPlayerList.js';
import { ScreenSettings, settingsLine } from '../screen/ScreenSettings.js';
import { DoodlePad } from './DoodlePad.js';
import { LeaveButton } from './LeaveButton.js';

/**
 * The lobby on a phone (UI by role and phase, Guesser phone, Lobby): "You're in, Jun!", their
 * colour, who is waiting for whom, who's here, and Leave. The crown holder's lobby is the host
 * view instead (Host controls, F25): "You're the host 👑", a big Start game, and the settings
 * summary with Change (presets, settings and the players list with Give crown and Kick), and
 * "Add your own words" (F48). Both have the doodle pad (F27) under that, the host's below Start.
 * Not yet: Change name (renames land with their reducer action).
 */
export function PhoneLobby({
  view,
  socket,
  onLeave,
  sendDoodle,
  t,
}: {
  view: PlayerView;
  socket: GameSocket;
  onLeave: () => void;
  /** Sends a finished doodle stroke on the page's `/ink` socket. */
  sendDoodle: SendDoodle;
  t: Translate;
}) {
  const me = view.players.find((p) => p.pid === view.me.pid);
  const crown = view.players.find((p) => p.crown);
  const others = view.players.filter((p) => p.pid !== view.me.pid);
  const isHost = view.host !== null;

  // Change covers the lobby with the settings; closing it puts focus back on Change.
  const [panelOpen, setPanelOpen] = useState(false);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const changeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const open = panelOpen && isHost;
  useEffect(() => {
    if (wasOpen.current && !open) changeButton.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // "Add your own words" likewise, back to its button.
  const [wordsOpen, setWordsOpen] = useState(false);
  const closeWords = useCallback(() => setWordsOpen(false), []);
  const wordsButton = useRef<HTMLButtonElement>(null);
  const wordsWasOpen = useRef(false);
  const words = wordsOpen && isHost && !open;
  useEffect(() => {
    if (wordsWasOpen.current && !words) wordsButton.current?.focus();
    wordsWasOpen.current = words;
  }, [words]);

  return (
    <div className="relative h-full">
      <div
        inert={open || words}
        className="flex h-full flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-4 pb-3"
      >
        <header className="flex items-center gap-3">
          <span
            aria-hidden
            style={{ background: me?.color }}
            className="size-10 shrink-0 rounded-full border-2 border-white/80"
          />
          <h1 className="font-display min-w-0 text-3xl leading-tight font-bold break-words">
            {isHost ? t('youreHost') : t('youreIn', { name: me?.name ?? '' })}
          </h1>
        </header>
        {isHost ? (
          <HostLobby
            view={view}
            socket={socket}
            t={t}
            changeRef={changeButton}
            onChange={() => setPanelOpen(true)}
            wordsRef={wordsButton}
            wordsOpen={words}
            onWords={() => setWordsOpen(true)}
          />
        ) : (
          <p className="text-lg text-white/80">
            {t('waitingForHostToStart', { name: crown?.name ?? '' })}
          </p>
        )}

        {/* SPEC-QUESTION: the spec puts a guesser's pad below the list; it goes above it, so it is on screen at 360×560 (DECISIONS 50). */}
        <DoodlePad storageKey={doodleKey(view.code, view.me.pid)} send={sendDoodle} t={t} />

        <section>
          <h2 className="mb-2 text-base font-semibold text-white/70">
            {t('whosHere')} ({view.players.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {[...(me ? [me] : []), ...others].map((p) => (
              <li
                key={p.pid}
                className={`flex items-center gap-2 rounded-full bg-white/10 py-1 pr-3 pl-1 ${
                  p.connected ? '' : 'opacity-50'
                }`}
              >
                <span
                  aria-hidden
                  style={{ background: p.color }}
                  className="size-6 shrink-0 rounded-full"
                />
                <span className="max-w-[12rem] truncate">
                  {p.crown ? '👑 ' : ''}
                  {p.name}
                  {p.pid === view.me.pid ? ` (${t('you')})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-auto flex justify-center">
          <LeaveButton onLeave={onLeave} inGame={false} t={t} />
        </div>
      </div>
      {words && (
        <CustomWordsPanel
          count={view.host!.customWordCount}
          socket={socket}
          t={t}
          onClose={closeWords}
          onScreen={false}
        />
      )}
      {open && (
        <ScreenSettings settings={view.settings} socket={socket} t={t} onClose={closePanel}>
          <section className="flex flex-col gap-2">
            <h3 className="text-white/80">{t('playersTitle')}</h3>
            <HostPlayerList
              players={view.players}
              socket={socket}
              t={t}
              size="phone"
              mePid={view.me.pid}
            />
          </section>
        </ScreenSettings>
      )}
    </div>
  );
}

/**
 * The crown holder's part of the lobby: Start, the settings summary with Change, and "Add your own
 * words".
 */
function HostLobby({
  view,
  socket,
  t,
  changeRef,
  onChange,
  wordsRef,
  wordsOpen,
  onWords,
}: {
  view: PlayerView;
  socket: GameSocket;
  t: Translate;
  changeRef: RefObject<HTMLButtonElement | null>;
  onChange: () => void;
  wordsRef: RefObject<HTMLButtonElement | null>;
  wordsOpen: boolean;
  onWords: () => void;
}) {
  const { sending, status, send } = useHostSender(socket, t);
  const connected = view.players.filter((p) => p.connected).length;
  const tooFew = connected < 2;

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => {
          if (!sending && !tooFew) void send('start', 'host:start', {});
        }}
        disabled={tooFew}
        aria-disabled={sending !== null}
        className="min-h-16 w-full rounded-2xl bg-[#FF6B35] px-6 py-4 text-2xl font-bold text-[#1D1B22] disabled:opacity-40 aria-disabled:opacity-70"
      >
        {t('startGame')}
      </button>
      <p role="status" className="min-h-[1.5em] text-center text-base text-[#FFD166]">
        {status ?? (tooFew ? t('needTwoPlayers') : '')}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-white/80">
        <span>{settingsLine(t, view.settings)}</span>
        <button
          ref={changeRef}
          type="button"
          onClick={onChange}
          aria-haspopup="dialog"
          className="min-h-11 min-w-11 rounded-xl bg-white/15 px-3 font-bold text-white"
        >
          {t('change')}
        </button>
      </p>
      <CustomWordsButton
        ref={wordsRef}
        count={view.host?.customWordCount ?? 0}
        open={wordsOpen}
        onOpen={onWords}
        t={t}
        className="min-h-11 w-full rounded-xl bg-white/15 px-3 py-2 text-left text-base font-bold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
      />
    </section>
  );
}
