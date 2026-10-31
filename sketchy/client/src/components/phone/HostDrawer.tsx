import { useCallback, useEffect, useRef, useState } from 'react';
import { GUESS_FEED_CHOICES } from '../../../../shared/constants.js';
import type { PlayerView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import {
  CONFIRM_LABELS,
  CONFIRM_MS,
  FEED_LABELS,
  LABELS,
  controlEvent,
  drawerSections,
  press,
  type Armed,
  type ControlId,
} from '../../lib/hostKeys.js';
import { useHostSender } from '../../lib/hostSend.js';
import type { GameSocket } from '../../lib/socket.js';
import { HostPlayerList } from '../HostPlayerList.js';

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
}: {
  view: PlayerView;
  socket: GameSocket;
  t: Translate;
  /** Held by the page, which makes the player's view behind the sheet inert. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
      <div inert={open} className="relative z-30 flex shrink-0 justify-end px-3 pt-1">
        <button
          ref={button}
          type="button"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="min-h-11 min-w-11 rounded-full bg-white/15 px-4 text-base font-bold"
        >
          <span aria-hidden="true">👑</span> {t('hostButton')}
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
  const { sending, status, setStatus, send } = useHostSender(socket, t);
  const sheet = useRef<HTMLDivElement>(null);
  // A first tap never carries over into another phase or turn.
  const scope = `${view.phase}:${view.turn?.id ?? ''}`;
  const [armedAt, setArmed] = useState<(Armed & { scope: string }) | null>(null);
  const armed = armedAt?.scope === scope ? armedAt : null;
  const { controls, feed, players } = drawerSections(view);

  useEffect(() => {
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!armedAt) return;
    const timer = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armedAt]);

  // `now` is the click's own timestamp (performance.now()'s clock).
  const tap = (control: ControlId, now: number) => {
    if (sending) return;
    const { command, armed: next } = press(control, armed, now);
    setArmed(next && { ...next, scope });
    if (command.kind === 'arm') {
      const hint = CONFIRM_LABELS[control];
      if (hint) setStatus(t(hint));
      return;
    }
    const { event, payload } = controlEvent(control, view);
    void send(control, event, payload);
  };

  const primary = (c: ControlId) => c === 'next' || c === 'resume' || c === 'rematch';

  return (
    <div
      className="fixed inset-0 z-40 flex cursor-pointer flex-col justify-end bg-black/60 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]"
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
        className="flex max-h-[85dvh] cursor-auto flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl bg-[#2A2730] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="host-drawer-title" className="font-display text-2xl font-bold">
            <span aria-hidden="true">👑</span> {t('hostControls')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-xl bg-[#FF6B35] px-4 font-bold text-[#1D1B22]"
          >
            {t('close')}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {controls.map((control) => {
            const confirm = CONFIRM_LABELS[control];
            const isArmed = armed?.control === control;
            return (
              <button
                key={control}
                type="button"
                onClick={(e) => tap(control, e.timeStamp)}
                aria-disabled={sending === control}
                className={`min-h-12 w-full rounded-xl px-4 py-2 text-lg font-bold aria-disabled:opacity-70 ${
                  isArmed
                    ? 'bg-[#FFD166] text-[#1D1B22]'
                    : primary(control) || control === 'cancelRematch'
                      ? 'bg-[#FF6B35] text-[#1D1B22]'
                      : 'bg-white/15'
                } ${control === 'rematch' || control === 'cancelRematch' ? 'min-h-16 text-2xl' : ''}`}
              >
                {isArmed && confirm ? t(confirm) : t(LABELS[control])}
              </button>
            );
          })}
        </div>

        <p role="status" className="min-h-[1.5em] text-base text-[#FFD166]">
          {status ?? ''}
        </p>

        {feed && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-white/80">{t('settingGuessFeed')}</legend>
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
                  className="min-h-11 flex-1 rounded-xl bg-white/10 px-3 font-bold aria-disabled:opacity-60 aria-pressed:bg-[#FF6B35] aria-pressed:text-[#1D1B22]"
                >
                  {t(FEED_LABELS[value])}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {players && (
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
        )}
      </div>
    </div>
  );
}
