import { EARLIER, EARLIER_LINE, ROLES } from '../roles';

/**
 * Experience, directly after the head and above the index.
 *
 * Since 2026-11-26 the cards that come out of the head carry everything here
 * (employer, title, dates, bullets, and EARLIER as a fifth card), so when the
 * showcase plays this section is visually hidden (`index.css`). It stays in the
 * document because the showcase is `aria-hidden` and never plays under reduced
 * motion or without JavaScript: for those readers this is the only copy.
 *
 * The index answers "what has he made". This answers "who has he done it for",
 * which is the question a recruiter asks second and which the homepage could
 * not answer at all until 2026-08-07 — the page offered five side projects, a
 * droplet, and a PDF you had to download. See `roles.ts` for why it is here
 * rather than in the showcase.
 *
 * Deliberately not links. Every employer has a website and every one of them
 * leads away from the portfolio, which is the opposite of what this page is
 * for: the hub exists to push people *into* the spokes. A name that is a fact
 * rather than a destination is also the honest treatment, because the claim
 * being made is "I worked here", not "look at their site".
 *
 * It was quieter than the index by one step until 2026-11-26, when Kim asked
 * for the employer work to lead: a recruiter hiring a senior engineer weighs
 * what was shipped for employers above side projects. Each role is now a panel
 * with its CV bullets. The screenshots were here too until the same day moved
 * them into the cards that come out of the head (`Showcase.tsx`); showing each
 * twice in one scroll was repetition. The EARLIER row stays a single line.
 */
export default function Roles() {
  return (
    <section className="roles" aria-labelledby="roles-heading">
      <h2 className="index-heading mono" id="roles-heading">
        Experience
      </h2>
      <ol className="roles-list">
        {ROLES.map((r) => (
          <li className="roles-row" key={r.id}>
            <span className="roles-employer">{r.employer}</span>
            <span className="roles-title mono">{r.title}</span>
            {/*
              A `<time>` would be wrong here. These are printed ranges like
              "April 2026 – Present", and `datetime` takes one machine-readable
              value — there is no honest attribute for an open-ended range, and
              a wrong one is worse than none for anything parsing the page.
            */}
            <span className="roles-dates mono">{r.dates}</span>
            <ul className="roles-bullets">
              {r.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </li>
        ))}
        <li className="roles-row roles-row--earlier">
          <span className="roles-employer">Earlier</span>
          <span className="roles-title mono">{EARLIER_LINE}</span>
          <span className="roles-dates mono">{EARLIER.dates}</span>
        </li>
      </ol>
    </section>
  );
}
