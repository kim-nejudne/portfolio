/**
 * What the hub owes a reader who got to the bottom: where the work runs, and
 * how to reach him. Deliberately plain — the performance is over.
 */
export default function Colophon() {
  return (
    <footer className="colophon">
      <div className="colophon-inner">
        <p className="colophon-lede">
          Five standalone products, each with its own art direction. The range is the point; the
          craft bar is the same on every one.
        </p>
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
              <a href="mailto:august.nejudne@gmail.com">august.nejudne@gmail.com</a>
              <span aria-hidden="true"> · </span>
              <a href="https://github.com/kim-nejudne">github.com/kim-nejudne</a>
            </dd>
          </div>
        </dl>
      </div>
    </footer>
  );
}
