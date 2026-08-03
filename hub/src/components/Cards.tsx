import { crop, SPOKES } from '../spokes';

/**
 * The five cards, in their settled positions.
 *
 * This is the real layout — not a flight deck. The timeline animates each card
 * *from* the cavity to where CSS already put it, so when the pin releases the
 * cards are exactly where the stylesheet says they are, with no FLIP, no
 * measurement to keep in sync, and nothing to unwind if JavaScript never runs.
 *
 * Semantically it is a list of links and nothing else. Identical paper frame on
 * every card, identical type block; the only thing that differs between them is
 * the crop. That is the whole coherence argument — the frame is the curator's
 * voice, the crop is the spoke's.
 */
export default function Cards() {
  return (
    <nav className="cards-wrap" id="work" aria-label="Projects">
      <ul className="cards" data-cards>
        {SPOKES.map((s, i) => {
          const { avif, png } = crop(s.id);
          return (
            <li className="card" data-card key={s.id}>
              <a className="card-link" href={s.href}>
                <span className="card-frame">
                  <picture>
                    <source srcSet={avif} type="image/avif" />
                    <img src={png} alt="" loading="lazy" decoding="async" width={900} height={600} />
                  </picture>
                </span>
                <span className="card-index mono">{String(i + 1).padStart(2, '0')}</span>
                <span className="card-name">{s.name}</span>
                <span className="card-line mono">{s.line}</span>
              </a>
              {s.caseStudy ? (
                <a className="card-aside mono" href={s.caseStudy}>
                  Case study
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
