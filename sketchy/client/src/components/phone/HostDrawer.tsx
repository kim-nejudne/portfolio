import { useCallback, useEffect, useRef } from 'react';
import { GUESS_FEED_CHOICES } from '../../../../shared/constants.js';
import type { PlayerView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import {
  CONFIRM_LABELS,
  FEED_LABELS,
  LABELS,
  drawerSections,
  type ControlId,
} from '../../lib/hostKeys.js';
import { useHostTaps } from '../../lib/hostTaps.js';
import type { GameSocket } from '../../lib/socket.js';
import { HostPlayerList } from '../HostPlayerList.js';
import { sketchButtonClass } from '../sketch/SketchButton.js';
import { RINGS_ROW_PX } from '../sketch/SpiralRings.js';

/**
 * The crown holder's phone once the game has started (Host controls): a 👑 Host button in a slim
 * top bar opens a bottom drawer over the player's own view, which keeps playing underneath. It
 * holds only public controls, per phase: never the word. It opens only from the button, so it
 * never covers the drawer's pad by accident. Mounted only while the view has the host block; the
 * server checks every event again.
 */
export function HostDrawer({
  view,
  socket,
  t,
  open,
  onOpenChange,
  placement = 'bar',
}: {
  view: PlayerView;
  socket: GameSocket;
  t: Translate;
  /** Held by the page, which makes the player's view behind the sheet inert. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * `bar`: a slim bar of its own above the view. `drawer`: over the right end of the drawer's top
   * bar, first row (Sketchbook Drawer); the page positions it, `DrawerTurn` keeps the room free.
   */
  placement?: 'bar' | 'drawer';
}) {
  const inBar = placement === 'drawer';
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  // Closing puts focus back on Host, once the bar is no longer inert.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      {/* Above the paused overlay, so Resume stays in reach. */}
      <div
        inert={open}
        // In the drawer's bar: just under the page's rings, at the bar's right end.
        style={inBar ? { top: `calc(env(safe-area-inset-top) + ${RINGS_ROW_PX}px)` } : undefined}
        className={
          inBar
            ? 'absolute right-[calc(env(safe-area-inset-right)+0.25rem)] z-30'
            : 'relative z-30 flex shrink-0 justify-end px-3 pt-1'
        }
      >
        {/* A 44 px tap area around a small hand-bordered pill; in the drawer's bar the pill sits
            in the first row and the tap area hangs below it. */}
        <button
          ref={button}
          type="button"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex min-h-11 min-w-11 touch-manipulation justify-center px-1 font-hand text-ink ${
            inBar ? 'items-start pt-[3px]' : 'items-center'
          }`}
        >
          <span className="rounded-[12px_4px_12px_4px] border-2 border-ink bg-paper px-2 py-px text-[15px] leading-5 whitespace-nowrap">
            <span aria-hidden="true">👑</span> {t('hostButton')}
          </span>
        </button>
      </div>
      {open && <DrawerSheet view={view} socket={socket} t={t} onClose={close} />}
    </>
  );
}

/** The open drawer: the phase's controls, the guess feed and the players list. */
export function DrawerSheet({
  view,
  socket,
  t,
  onClose,
}: {
  view: PlayerView;
  socket: GameSocket;
  t: Translate;
  onClose: () => void;
}) {
  const { armed, tap, sending, status, statusIsHint, send } = useHostTaps(view, socket, t);
  const sheet = useRef<HTMLDivElement>(null);
  const { controls, feed, players } = drawerSections(view);

  useEffect(() => {
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const primary = (c: ControlId) =>
    c === 'next' || c === 'resume' || c === 'rematch' || c === 'cancelRematch';

  return (
    // A paper veil, never dark (Sketchbook Results: overlays), then a dot-grid paper sheet with an
    // ink edge and a hard shadow, rising from the bottom.
    <div
      className="fixed inset-0 z-40 flex cursor-pointer flex-col justify-end bg-paper/70 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="host-drawer-title"
        tabIndex={-1}
        className="paper-dots flex max-h-[85dvh] cursor-auto flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-[22px_14px] border-x-[2.5px] border-t-[2.5px] border-ink bg-paper px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-hand text-ink outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="host-drawer-title" className="text-[28px] leading-tight">
            <span aria-hidden="true">👑</span> {t('hostControls')}
          </h2>
          <button type="button" onClick={onClose} className={sketchButtonClass('ghost')}>
            {t('close')}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {controls.map((control) => {
            const confirm = CONFIRM_LABELS[control];
            const isArmed = armed?.control === control;
            const big = control === 'rematch' || control === 'cancelRematch';
            return (
              <button
                key={control}
                type="button"
                onClick={(e) => tap(control, e.timeStamp)}
                aria-disabled={sending === control}
                // Armed is red pen with the "Tap again…" line, unlike either resting look.
                className={`${sketchButtonClass(
                  isArmed ? 'armed' : primary(control) ? 'primary' : 'ghost',
                  big ? 'tall' : false,
                )} ${big ? '' : 'w-full'} aria-disabled:opacity-70`}
              >
                {isArmed && confirm ? t(confirm) : t(LABELS[control])}
              </button>
            );
          })}
        </div>

        <p role="status" className="min-h-[1.5em] text-lg text-red">
          <span className={statusIsHint ? 'sr-only' : ''}>{status ?? ''}</span>
        </p>

        {feed && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-lg text-soft">{t('settingGuessFeed')}</legend>
            <div className="flex gap-2">
              {GUESS_FEED_CHOICES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view.settings.guessFeed === value}
                  aria-disabled={sending !== null}
                  onClick={() => {
                    if (!sending && view.settings.guessFeed !== value)
                      void send('guessFeed', 'host:settings', { guessFeed: value });
                  }}
                  className="min-h-11 flex-1 rounded-[12px_4px_12px_4px] border-2 border-ink bg-paper px-3 text-lg text-ink aria-disabled:opacity-60 aria-pressed:bg-hl aria-pressed:shadow-[2px_3px_0_var(--color-ink)]"
                >
                  {t(FEED_LABELS[value])}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {players && (
          <section className="flex flex-col gap-2">
            <h3 className="text-lg text-soft">{t('playersTitle')}</h3>
            <HostPlayerList
              players={view.players}
              socket={socket}
              t={t}
              size="phone"
              mePid={view.me.pid}
            />
          </section>
        )}
      </div>
    </div>
  );
}
