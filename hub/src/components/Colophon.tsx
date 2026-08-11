import { CONTACT } from '../contact';
import CvButton from './CvButton';

/**
 * What the hub owes a reader who got to the bottom: where the work runs, and
 * how to reach him. Deliberately plain — the performance is over.
 */
export default function Colophon() {
  return (
    <footer className="colophon">
      <div className="colophon-inner">
        {/*
          The second sentence arrived on 2026-08-11, and it is the H1's old
          second half.

          "with a designer's eye" sat directly under the title until then, where
          it read as a qualifier on the title rather than as a second claim:
          frontend, plus taste. That is the reading the retitle four days
          earlier existed to prevent, so it came out of the H1. It did not come
          out of the argument. It is the differentiation `positioning-brief.md`
          rests on against pure engineers, and the editorial background is the
          proof of it that cannot be faked.

          Here it reads as range instead of as a category, which is what it is,
          and it reads to someone who has already been through the five
          products rather than to someone deciding whether to look at them. The
          60fps claim came down with it, for the same reason and to the same
          place: it is a craft fact, and this is where the craft facts live.
        */}
        <p className="colophon-lede">
          Five standalone products, each with its own art direction. The range is the point; the
          craft bar is the same on every one. The designer’s eye behind them is an editorial one,
          out of magazine and desktop-publishing work that predates the nine years of JavaScript,
          and the motion holds 60fps everywhere it appears.
        </p>
        {/*
          Between the lede and the facts, which is the one place it belongs.

          After the closing statement, because it is what to do about it; before
          the facts, because those are a three-column grid at 768px and a block
          this size dropped into them would break the row. It sits beside
          Contact in meaning without sitting inside it in markup.
        */}
        <CvButton />
        <dl className="colophon-facts mono">
          <div>
            <dt>Stack</dt>
            <dd>TypeScript end to end · React · NestJS · Postgres · GSAP</dd>
          </div>
          <div>
            <dt>Hosting</dt>
            <dd>Self-hosted. One droplet, nginx, no PaaS.</dd>
          </div>
          <div>
            <dt>Contact</dt>
            <dd>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <span aria-hidden="true"> · </span>
              <a href={CONTACT.github}>{CONTACT.githubLabel}</a>
            </dd>
          </div>
        </dl>
      </div>
    </footer>
  );
}
