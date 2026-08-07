import { EARLIER, ROLES } from '../roles';

/**
 * Where the nine years went, directly under the index.
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
 * It is quieter than the index by one step in the type scale. The order is
 * deliberate and the index has to stay the louder of the two: the work is the
 * argument and this is the support for it.
 */
export default function Roles() {
  return (
    <section className="roles" aria-labelledby="roles-heading">
      <h2 className="index-heading mono" id="roles-heading">
        Where the nine years went
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
          </li>
        ))}
        <li className="roles-row roles-row--earlier">
          <span className="roles-employer">Earlier</span>
          <span className="roles-title mono">
            {EARLIER.employers.join(' · ')}
          </span>
          <span className="roles-dates mono">{EARLIER.dates}</span>
        </li>
      </ol>
    </section>
  );
}
