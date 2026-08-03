/**
 * Validates a post-sign-in return path.
 *
 * The `next` value originates in the middleware's redirect, which means it
 * reaches this function via the URL bar and a hidden form field — both fully
 * under the visitor's control. Without this check the sign-in form is an open
 * redirect: a link to `/sign-in?next=https://evil.test` would bounce someone
 * off the site immediately after they authenticated, at the exact moment they
 * are most likely to trust what they are looking at.
 *
 * Only a same-site absolute path is allowed through. Everything else falls back
 * to the caller's default, silently — there is nothing useful to tell a
 * visitor about a parameter they did not knowingly set.
 */
export function safeRedirectPath(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;

  // Must be an absolute path on this site.
  if (!raw.startsWith('/')) return fallback;

  // `//evil.test` and `/\evil.test` are both scheme-relative URLs: browsers
  // treat them as another origin, but they start with a slash and would sail
  // past a naive check.
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;

  // A backslash anywhere early is worth refusing outright — several browsers
  // normalise it to a forward slash before resolving the URL.
  if (raw.includes('\\')) return fallback;

  // Control characters, including the tab and newline that some parsers strip
  // before resolving a URL — which can smuggle a scheme past a string
  // comparison that ran before the stripping.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;

  return raw;
}
