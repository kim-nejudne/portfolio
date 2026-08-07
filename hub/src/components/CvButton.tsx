import { CV } from '../cv';

/**
 * The one thing on this page a visitor can take away with them.
 *
 * Rendered twice — in `Pitch`, at rest, and in `Colophon`, at the end — and
 * defined once, so the two cannot say different things. The top copy is the one
 * a recruiter meets on a skim; the bottom one is for the person who read the
 * whole page and is deciding what to do about it.
 *
 * It is the only solid block on the site besides the skip link, and it borrows
 * that link's vocabulary rather than inventing a button style: ink ground,
 * paper type, mono caps. Both are literal tokens, so the colour-rule sweep in
 * `verify.mjs` reads them off the paper-to-ink line like everything else.
 *
 * `download` rather than a new tab, because the label promises a download. The
 * filename is set explicitly so the saved file is identifiable in a folder that
 * will contain several other files called `cv.pdf`.
 */
export default function CvButton({ className }: { className?: string }) {
  return (
    <a className={className ? `cta mono ${className}` : 'cta mono'} href={CV.href} download={CV.filename}>
      {CV.label}
      {/*
        Decoration for the eye, not for the accessible name — a screen reader
        announcing "Download my CV PDF" gains nothing, and the anchor already
        says it is a download.
      */}
      <span className="cta-tag" aria-hidden="true">
        PDF
      </span>
    </a>
  );
}
