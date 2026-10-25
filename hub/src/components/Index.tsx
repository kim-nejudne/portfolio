import { SPOKES } from '../spokes';

/**
 * The contents page.
 *
 * The showcase is a performance and it leaves. This does not. Anyone who flung
 * past the whole sequence, or arrived with reduced motion, or is reading with
 * a screen reader, lands here — one link per spoke, always present, in the document,
 * needing nothing to run.
 *
 * It is also the reason the keyboard story is simple. An earlier version hid
 * the work inside the pinned section and needed a scripted rescue to drag a
 * keyboard user to the one scroll position where it was visible. With a real
 * list below the pin, the skip link is an ordinary anchor and there is nothing
 * to rescue.
 *
 * Deliberately quiet: no crops, no frames, ink on paper. It is a table of
 * contents after the show, and it must not compete with what it follows.
 */
export default function Index() {
  return (
    <section className="index" id="work" aria-labelledby="work-heading">
      <h2 className="index-heading mono" id="work-heading">
        The work — three standalone products
      </h2>
      <ol className="index-list">
        {SPOKES.map((s, i) => (
          <li className="index-row" key={s.id}>
            <a className="index-link" href={s.href}>
              <span className="index-num mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="index-name">{s.name}</span>
              <span className="index-line mono">{s.line}</span>
            </a>
            {s.caseStudy ? (
              <a className="index-aside mono" href={s.caseStudy}>
                Case study
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
