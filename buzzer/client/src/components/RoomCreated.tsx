import { useState } from 'react';
import { useNavigate } from 'react-router';
import { HOVER } from '../lib/hover.js';
import { displayUrl } from '../lib/joinUrl.js';
import { CARD } from '../lib/ui.js';
import { usePointerFine } from '../lib/usePointerFine.js';
import { Icon, type IconName } from './Icon.js';

type Option = 'screen' | 'elsewhere' | 'remote' | 'phoneOnly';

const OPTIONS: Record<Option, { icon: IconName; title: string; hint: string }> = {
  screen: { icon: 'tv', title: 'This is the Screen', hint: 'Show questions on this device' },
  elsewhere: { icon: 'cast', title: 'Screen elsewhere', hint: 'Open the Screen on a TV or laptop' },
  remote: { icon: 'remote', title: 'Host remote', hint: 'Control the game from this phone' },
  phoneOnly: { icon: 'phone', title: 'Phone only', hint: 'No TV: run everything from here' },
};

/** A laptop is most likely the Screen; a phone, the remote (LND-05). The first is the gold one. */
const MOUSE_ORDER: readonly Option[] = ['screen', 'elsewhere', 'remote', 'phoneOnly'];
const TOUCH_ORDER: readonly Option[] = ['remote', 'phoneOnly', 'screen', 'elsewhere'];

const OPTION_CARD =
  'flex min-h-11 items-center gap-4 rounded-2xl border-2 p-4 text-left transition active:scale-95';

/** Creating and joining a room, step 2: once the room exists, ask where the Screen is. */
export function RoomCreated({ code }: { code: string }) {
  const navigate = useNavigate();
  const pointerFine = usePointerFine();
  const [showScreenUrl, setShowScreenUrl] = useState(false);
  const screenUrl = `${window.location.origin}/screen/${code}`;

  const actions: Record<Option, () => void> = {
    screen: () => void navigate(`/screen/${code}`),
    elsewhere: () => setShowScreenUrl((shown) => !shown),
    // hostSet already kept the hostToken (saveHostToken), so the remote joins without a pairing hash.
    remote: () => void navigate(`/host/${code}`),
    // The remote stores the read-aloud choice for this tab and drops `?read=1` (F69).
    phoneOnly: () => void navigate(`/host/${code}?read=1`),
  };
  const order = pointerFine ? MOUSE_ORDER : TOUCH_ORDER;

  return (
    <section
      aria-labelledby="host-heading"
      className={`flex flex-col gap-4 ${CARD} shadow-[0_0_0_6px_var(--color-bg),0_0_0_10px_var(--color-accent)]`}
    >
      <h2 id="host-heading" className="font-display text-3xl">
        Room created
      </h2>
      <p className="text-center font-display text-6xl tracking-[0.2em] text-accent">{code}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {order.map((option, index) => {
          const { icon, title, hint } = OPTIONS[option];
          const primary = index === 0;
          return (
            <button
              key={option}
              type="button"
              onClick={actions[option]}
              aria-labelledby={`room-${option}`}
              aria-describedby={`room-${option}-hint`}
              aria-expanded={option === 'elsewhere' ? showScreenUrl : undefined}
              className={`${OPTION_CARD} ${HOVER} ${
                primary
                  ? 'border-accent bg-accent text-accent-ink hover:bg-accent-hover'
                  : 'border-edge bg-bg'
              }`}
            >
              <Icon name={icon} className="size-8" />
              <span className="flex min-w-0 flex-col">
                <span id={`room-${option}`} className="font-display text-lg">
                  {title}
                </span>
                <span
                  id={`room-${option}-hint`}
                  className={`text-base ${primary ? 'text-accent-ink' : 'text-muted'}`}
                >
                  {hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {showScreenUrl && (
        <p className="text-center text-lg text-muted">
          On the TV device, open{' '}
          <strong className="break-all text-ink">{displayUrl(screenUrl)}</strong>
          <br />
          Room code <strong className="font-display tracking-widest text-ink">{code}</strong>
        </p>
      )}
    </section>
  );
}
