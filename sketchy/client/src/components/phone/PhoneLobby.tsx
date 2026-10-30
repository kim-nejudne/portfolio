import type { PlayerView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import { LeaveButton } from './LeaveButton.js';

/**
 * The lobby on a phone (UI by role and phase, Guesser phone, Lobby): "You're in, Jun!", their
 * colour, who is waiting for whom, who's here, and Leave. v0: no Change name (renames land with
 * their reducer action), no doodle pad (F27) and no host lobby for the crown holder (F25).
 */
export function PhoneLobby({
  view,
  onLeave,
  t,
}: {
  view: PlayerView;
  onLeave: () => void;
  t: Translate;
}) {
  const me = view.players.find((p) => p.pid === view.me.pid);
  const crown = view.players.find((p) => p.crown);
  const others = view.players.filter((p) => p.pid !== view.me.pid);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-4 pt-4 pb-3">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          style={{ background: me?.color }}
          className="size-10 shrink-0 rounded-full border-2 border-white/80"
        />
        <h1 className="font-display min-w-0 text-3xl leading-tight font-bold break-words">
          {t('youreIn', { name: me?.name ?? '' })}
        </h1>
      </header>
      <p className="text-lg text-white/80">
        {me?.crown ? t('youHaveCrown') : t('waitingForHostToStart', { name: crown?.name ?? '' })}
      </p>

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
  );
}
