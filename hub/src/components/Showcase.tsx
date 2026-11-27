import { EARLIER, EARLIER_LINE, ROLES, roleImage, years } from '../roles';

/** The denominator on every card, from the list itself. It was a literal `05`
 *  and read "01 / 05" over a stack of two for a week. */
const TOTAL = String(ROLES.length + 1).padStart(2, '0');

const count = (n: number) => (
  <span className="card-count mono">
    {String(n).padStart(2, '0')} <span aria-hidden="true">/</span> {TOTAL}
  </span>
);

/**
 * The four cards, stacked in one place.
 *
 * Every card sits at the same spot in the sky, one on top of another, and the
 * timeline brings them out of the head one at a time. Only ever one is
 * visible, so the stack never reads as a stack.
 *
 * This is a *performance*, not the navigation. It renders nothing at all until
 * the timeline claims it (`.stage[data-ready]`), because four identical
 * absolutely-positioned cards piled on one another is what it degrades to
 * otherwise — and under reduced motion it never appears at all. The list that
 * always works is `Index`, below the pin, and that is what the skip link
 * points at.
 *
 * Since 2026-11-26 the cards are the four employers, not the side projects
 * (see `roles.ts`), and per Kim they are not links: a card is a screenshot of
 * shipped work with a caption, and the side projects keep their links in the
 * index. `.card-link` is a span now and keeps its name only so the stylesheet
 * and the verify suite stay as they are. Outside its own beat a card is
 * `visibility: hidden`, as before.
 *
 * Each card carries its role's CV bullets as well, and a fifth, text-only
 * card closes the run with the EARLIER roles, so the sky holds the whole
 * employment history and the section below the pin is only the fallback for
 * readers this never plays for (see `Roles.tsx`). "Experience" heads the sky
 * from the moment the head opens; `useHubTimeline` fades it in.
 */
export default function Showcase() {
  return (
    <div className="showcase" aria-hidden="true">
      <p className="showcase-heading" data-showcase-heading>
        Experience
      </p>
      <ul className="showcase-stack" data-cards>
        {ROLES.map((r, i) => {
          const { avif, png } = roleImage(r.id);
          return (
            <li className="card" data-card key={r.id}>
              <div className="card-link">
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
                <div className="card-text">
                  {count(i + 1)}
                  <span className="card-name">{r.employer}</span>
                  <span className="card-line mono">
                    {r.title} · {years(r.dates)}
                  </span>
                  <span className="card-stack mono">{r.stack.join(' · ')}</span>
                  <ul className="card-bullets">
                    {r.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
        <li className="card card--text" data-card>
          <div className="card-link">
            <div className="card-text">
              {count(ROLES.length + 1)}
              <span className="card-name">Earlier</span>
              <span className="card-line">{EARLIER_LINE}</span>
              <span className="card-stack mono">{years(EARLIER.dates)}</span>
            </div>
          </div>
        </li>
      </ul>
    </div>
  );
}
