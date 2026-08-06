/**
 * Markdown → HTML for the case studies.
 *
 * Build-time only. `markdown-it` is a devDependency and its output is baked
 * into five static files; nothing here reaches a browser, and the runtime
 * budget in `../../README.md` is untouched by it.
 *
 * Chosen over `marked` for two defaults rather than for features. `html:
 * false` escapes raw HTML instead of passing it through, which is the right
 * posture for a build that reads markdown out of five working trees it does
 * not control — and it is what makes the corpus's many `` `<button>` ``
 * spans render as text rather than disappearing into the DOM. `breaks: false`
 * is the other: all five sources are hard-wrapped at about 80 columns, so a
 * renderer that treated single newlines as `<br>` would break every line of
 * every paragraph, and it would look *deliberate*.
 *
 * No syntax highlighter, and not because it would be extra weight —
 * highlighters exist to emit colour, and the one colour rule forbids colour.
 * Code is set in ink at one weight. If you are here to add `shiki`, read
 * `src/tokens.css` first.
 */

import MarkdownIt from 'markdown-it';

/**
 * `typographer: true` is a typographic decision, not a default left switched
 * on. Every one of the five sources is written with straight quotes — 129 of
 * them — and straight quotes in a Didone are typewriter marks in a face that
 * has no typewriter in its ancestry. They are the single most visible way a
 * page can look unset.
 *
 * The risk of the option is its `replacements` rule, which also turns `--`
 * into an en dash. That was checked rather than assumed: the only `--` outside
 * a code span anywhere in the corpus is the `---` of a horizontal rule or a
 * table delimiter, both consumed by the block parser before any text rule
 * runs. The three real CSS custom properties (`--nav-height` and friends) are
 * all inside backticks, which typographer never touches.
 */
const md = new MarkdownIt({
  html: false,
  linkify: true, // suki writes one bare `https://suki.kimnejudne.dev`
  typographer: true,
  breaks: false,
});

/** Heading text → a stable fragment id. */
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/`[^`]*`/g, ' ') // code spans carry punctuation that reads badly in a URL
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/*
 * Tables scroll inside their own box rather than widening the document.
 *
 * `role="region"` plus `tabindex="0"` is the accessible half of that: a region
 * that scrolls has to be reachable by keyboard, or its right-hand columns are
 * simply unavailable to anyone not using a pointer. This is the same trade
 * `pre` makes below, and the assertion in `verify.mjs` that no page overflows
 * at 390px allows exactly these two elements to be wider than the viewport.
 */
md.renderer.rules.table_open = (tokens, idx, options, _env, self) =>
  '<div class="cs-scroll" role="region" tabindex="0" aria-label="Table">\n' +
  self.renderToken(tokens, idx, options);

md.renderer.rules.table_close = (tokens, idx, options, _env, self) =>
  self.renderToken(tokens, idx, options) + '\n</div>';

/*
 * The lede gets its own size.
 *
 * Every case study opens with a bold one-sentence summary, and it wants to be
 * larger than the body — but a `:first-of-type` selector would be wrong for
 * SUKI, whose lede is followed by two more ordinary paragraphs before the
 * facts list. Tagging the first *top-level* paragraph as it is emitted is
 * exact, and it does not care what follows it.
 */
md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
  if (!env.ledeSeen && tokens[idx].level === 0) {
    tokens[idx].attrJoin('class', 'cs-lede');
    env.ledeSeen = true;
  }
  return self.renderToken(tokens, idx, options);
};

/*
 * Deep-linkable sections. Ten lines, and it means a paragraph of a case study
 * can be sent to someone rather than a whole document with a "scroll down to".
 */
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.tag === 'h2' || token.tag === 'h3') {
    const inline = tokens[idx + 1];
    const base = slugify(inline?.type === 'inline' ? inline.content : '');
    if (base) {
      env.slugs ??= new Map();
      const n = (env.slugs.get(base) ?? 0) + 1;
      env.slugs.set(base, n);
      token.attrSet('id', n === 1 ? base : `${base}-${n}`);
    }
  }
  return self.renderToken(tokens, idx, options);
};

/*
 * `rel="noopener"` on anything leaving the origin. No `target` — opening a new
 * tab is a decision a page makes on the reader's behalf, and this one has no
 * reason to.
 */
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  if (/^https?:\/\//i.test(tokens[idx].attrGet('href') ?? '')) {
    tokens[idx].attrSet('rel', 'noopener');
  }
  return self.renderToken(tokens, idx, options);
};

/** Render one case study. Returns HTML for the inside of `<article>`. */
export function renderCaseStudy(markdown) {
  return md.render(markdown, {});
}
