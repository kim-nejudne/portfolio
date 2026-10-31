import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type {
  Avatar as AvatarEmoji,
  PlayerChipView,
  PlayerView,
} from '../../../../shared/types.js';
import { doodleKey } from '../../ink/doodle.js';
import type { Translate } from '../../lib/copy.js';
import { useHostSender } from '../../lib/hostSend.js';
import type { GameSocket } from '../../lib/socket.js';
import { CustomWordsButton, CustomWordsPanel } from '../CustomWords.js';
import { HostPlayerList } from '../HostPlayerList.js';
import { Avatar } from '../Avatar.js';
import { ScreenSettings, settingsLine } from '../screen/ScreenSettings.js';
import { ChangeAvatarDialog } from './ChangeAvatar.js';
import { DoodlePad } from './DoodlePad.js';
import { sketchButtonClass } from '../sketch/SketchButton.js';
import { LeaveButton } from './LeaveButton.js';
import { NameInColour } from './NameInColour.js';

/**
 * The lobby on a phone (UI by role and phase, Guesser phone, Lobby): "You're in, Jun!", their
 * avatar in their colour (F53), who is waiting for whom, who's here, and Leave. The crown holder's
 * lobby is the host view instead (Host controls, F25): "You're the host 👑", a big Start game, and
 * the settings summary with Change (presets, settings and the players list with Give crown and
 * Kick), and "Add your own words" (F48). Both have the warm-up doodle pad (F27, F55) under that,
 * the host's below Start. In both, the avatar by the heading opens Change avatar (F54). Not yet:
 * Change name (renames land with their reducer action).
 */
export function PhoneLobby({
  view,
  socket,
  onLeave,
  onAvatarSaved,
  t,
}: {
  view: PlayerView;
  socket: GameSocket;
  onLeave: () => void;
  /** The server took a new avatar: the phone stores it for its next join. */
  onAvatarSaved: (avatar: AvatarEmoji) => void;
  t: Translate;
}) {
  const me = view.players.find((p) => p.pid === view.me.pid);
  const crown = view.players.find((p) => p.crown);
  // You first, then the others in join order.
  const here = [
    ...view.players.filter((p) => p.pid === view.me.pid),
    ...view.players.filter((p) => p.pid !== view.me.pid),
  ];
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

  // Change avatar likewise, back to the avatar.
  const [avatarOpen, setAvatarOpen] = useState(false);
  const closeAvatar = useCallback(() => setAvatarOpen(false), []);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const avatarWasOpen = useRef(false);
  const avatars = avatarOpen && me !== undefined && !open && !words;
  useEffect(() => {
    if (avatarWasOpen.current && !avatars) avatarButtonRef.current?.focus();
    avatarWasOpen.current = avatars;
  }, [avatars]);

  return (
    <div className="relative h-full">
      <div
        inert={open || words || avatars}
        className={`flex h-full flex-col gap-3 overflow-y-auto overscroll-contain pt-1 pb-3 ${
          // The guest page is ruled: text starts right of the red margin.
          isHost ? 'px-5' : 'pr-5 pl-[62px]'
        }`}
      >
        <header className={`flex items-center ${isHost ? 'gap-3' : 'gap-3.5'}`}>
          {me && (
            // SPEC-QUESTION: the spec doesn't place Change avatar; the avatar itself is the button,
            // with a pencil badge, so neither lobby gets taller (DECISIONS 77).
            <button
              ref={avatarButtonRef}
              type="button"
              onClick={() => setAvatarOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={avatars}
              aria-label={t('changeAvatar')}
              className="wobbly relative shrink-0 hover:bg-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen"
            >
              <Avatar player={me} size={isHost ? '3rem' : '4rem'} />
              <span
                aria-hidden="true"
                className="wobbly absolute -right-1 -bottom-1 grid size-6 place-items-center border-2 border-ink bg-paper text-xs leading-none"
              >
                ✏️
              </span>
            </button>
          )}
          <div className="min-w-0">
            {isHost && (
              <p className="font-num text-xs font-black tracking-[0.14em] text-soft uppercase">
                {t('roomEyebrow', { code: view.code })}
              </p>
            )}
            <h1 className="text-[30px] leading-[1.05] break-words">
              {isHost ? t('youreHost') : t('youreIn', { name: me?.name ?? '' })}
            </h1>
            {!isHost && <WaitingLine crown={crown} t={t} />}
          </div>
        </header>
        {isHost && (
          <>
            <Roster players={here} mePid={view.me.pid} t={t} />
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
          </>
        )}

        {/* SPEC-QUESTION: the spec puts a guesser's pad below the list; it goes above it, so it is on screen at 360×560 (DECISIONS 50). */}
        <DoodlePad storageKey={doodleKey(view.code, view.me.pid)} t={t} />

        {!isHost && (
          <section>
            <h2 className="text-base leading-tight text-soft">
              {t('whosHere')} ({view.players.length})
            </h2>
            <ul className="mt-1 flex flex-wrap gap-1">
              {here.map((p) => (
                <li key={p.pid} className={p.connected ? '' : 'opacity-50'}>
                  <Avatar player={p} size={view.players.length > 8 ? '1.75rem' : '2.125rem'} />
                  <span className="sr-only">
                    {p.crown ? '👑 ' : ''}
                    {p.name}
                    {p.pid === view.me.pid ? ` (${t('you')})` : ''}
                    {p.connected ? '' : ` (${t('offline')})`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex shrink-0 justify-center">
          <LeaveButton onLeave={onLeave} inGame={false} t={t} />
        </div>
      </div>
      {avatars && (
        <ChangeAvatarDialog
          avatar={me.avatar}
          socket={socket}
          t={t}
          onSaved={onAvatarSaved}
          onClose={closeAvatar}
        />
      )}
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
            <h3 className="text-soft">{t('playersTitle')}</h3>
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
 * "Waiting for 👑 Mika to start" with the host's name in their colour. Screen readers get the
 * sentence in one piece; the coloured copy beside it is hidden from them.
 */
function WaitingLine({ crown, t }: { crown: PlayerChipView | undefined; t: Translate }) {
  return (
    <p className="mt-1 text-base leading-snug text-soft">
      <NameInColour say={(name) => t('waitingForHostToStart', { name })} player={crown} />
    </p>
  );
}

/**
 * The host lobby's roster on dashed rules (the mockup's `sk-roster`): avatar, the name in the
 * player's colour, "(you)", 👑 for the crown. Read-only: Kick and Give crown stay in Change's
 * players list (`HostPlayerList`).
 */
function Roster({ players, mePid, t }: { players: PlayerChipView[]; mePid: string; t: Translate }) {
  return (
    <ul className="flex flex-col">
      {players.map((p) => (
        <li
          key={p.pid}
          className={`flex items-center gap-2.5 border-b-[1.5px] border-dashed border-dot text-[22px] leading-tight ${
            players.length > 4 ? 'min-h-9' : 'min-h-[42px]'
          }`}
        >
          {/* Offline: the avatar fades and "(Offline)" is written; the name keeps its contrast. */}
          <span className={p.connected ? 'contents' : 'opacity-40'}>
            <Avatar player={p} size={players.length > 4 ? '1.75rem' : '2.125rem'} />
          </span>
          <span className="min-w-0 truncate" style={{ color: p.color }}>
            {p.name}
          </span>
          {p.pid === mePid && <span className="shrink-0 text-base text-soft">({t('you')})</span>}
          {!p.connected && <span className="shrink-0 text-base text-soft">({t('offline')})</span>}
          {p.crown && (
            <span role="img" aria-label={t('hostButton')} className="ml-auto shrink-0 text-lg">
              👑
            </span>
          )}
        </li>
      ))}
    </ul>
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
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          if (!sending && !tooFew) void send('start', 'host:start', {});
        }}
        disabled={tooFew}
        aria-disabled={sending !== null}
        className={`${sketchButtonClass('primary', true)} mt-1 aria-disabled:opacity-70`}
      >
        {t('startGame')}
      </button>
      <p role="status" className="text-center text-base leading-tight text-ink">
        {status ?? (tooFew ? t('needTwoPlayers') : '')}
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-1 text-base leading-tight text-soft">
        <span>{settingsLine(t, view.settings)}</span>
        {/* The dot wraps with Change, so no line ends on a dangling separator. */}
        <span className="inline-flex items-center gap-x-1 whitespace-nowrap">
          <span aria-hidden="true">·</span>
          <button
            ref={changeRef}
            type="button"
            onClick={onChange}
            aria-haspopup="dialog"
            className={LINK_BUTTON}
          >
            {t('change')}
          </button>
        </span>
      </p>
      <CustomWordsButton
        ref={wordsRef}
        count={view.host?.customWordCount ?? 0}
        open={wordsOpen}
        onOpen={onWords}
        t={t}
        className={`${LINK_BUTTON} self-center`}
      />
    </section>
  );
}

/** An underlined word that acts (Change, Add your own words): the mockup's `<u>`, 44 px tall. */
const LINK_BUTTON =
  'min-h-11 min-w-11 px-1 text-lg text-ink underline decoration-pen decoration-2 underline-offset-4 hover:bg-none focus-visible:outline-3 focus-visible:outline-pen';
