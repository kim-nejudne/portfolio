import { crop, SPOKES } from '../spokes';

/**
 * The five cards, stacked in one place.
 *
 * Every card sits at the same spot in the sky, one on top of another, and the
 * timeline brings them out of the head one at a time. Only ever one is
 * visible, so the stack never reads as a stack.
 *
 * This is a *performance*, not the navigation. It renders nothing at all until
 * the timeline claims it (`.stage[data-ready]`), because five identical
 * absolutely-positioned cards piled on one another is what it degrades to
 * otherwise — and under reduced motion it never appears at all. The list that
 * always works is `Index`, below the pin, and that is what the skip link
 * points at.
 *
 * The cards are still real links. A card this size in the middle of the screen
 * invites a click, and refusing one because the element is technically an
 * animation frame would be a small betrayal. Outside its own beat a card is
 * `visibility: hidden`, so it is neither clickable nor focusable — the browser
 * enforces "only the card on stage is live" without any bookkeeping here.
 */
export default function Showcase() {
  return (
    <div className="showcase" aria-hidden="true">
      <ul className="showcase-stack" data-cards>
        {SPOKES.map((s, i) => {
          const { avif, png } = crop(s.id);
          return (
            <li className="card" data-card key={s.id}>
              <a className="card-link" href={s.href} tabIndex={-1}>
                <span className="card-frame">
                  <picture>
                    <source srcSet={avif} type="image/avif" />
                    <img
                      src={png}
                      alt=""
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      width={900}
                      height={600}
                    />
                  </picture>
                </span>
                <span className="card-count mono">
                  {String(i + 1).padStart(2, '0')} <span aria-hidden="true">/</span> 05
                </span>
                <span className="card-name">{s.name}</span>
                <span className="card-line mono">{s.line}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
