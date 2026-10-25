/**
 * Which chromium to drive.
 *
 * Five scripts in this directory shell out to a headless browser: `verify.mjs`,
 * `axe.mjs`, `case-study-cards.mjs`, `brand.sh` and `cv/build.sh`. Three of them
 * searched a list of names and two hardcoded `chromium`, which is a difference
 * nobody chose. It went unnoticed for as long as the only machine that ran them
 * was an Arch workstation, where `chromium` is what the package is called.
 *
 * It stopped being cosmetic when the suite had to run in CI. A GitHub
 * `ubuntu-latest` runner ships Chrome as `google-chrome` and has no `chromium`
 * on PATH at all, so `verify.mjs` and `axe.mjs` were the two scripts that could
 * not run anywhere except here, and they are the two whose whole purpose is to
 * be run somewhere else.
 *
 * `$CHROMIUM` wins if it is set, so a runner can name a binary at an absolute
 * path without this list having to know about it.
 *
 * The doctrine is the one `identity-policy.mjs` and `case-study/policy.mjs`
 * already set: when two scripts have to agree about a rule, the rule is a module
 * they both import rather than a thing written twice and kept in step by hand.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/** In preference order. `chromium` first, because that is the workstation. */
const CANDIDATES = ['chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome', 'chrome'];

/**
 * The chromium binary to spawn.
 *
 * Throws rather than returning undefined. Every caller needs a browser to do
 * anything at all, and a spawn of `undefined` fails later with a message about
 * argument types rather than about the missing browser.
 */
export function chromiumPath() {
  const override = process.env.CHROMIUM;
  if (override) {
    // An absolute path is checked on disk; a bare name still has to be resolved
    // on PATH, because `CHROMIUM=chromium` on a box without it should fail here
    // with a useful message rather than at spawn time.
    if (override.includes('/')) {
      if (existsSync(override)) return override;
      throw new Error(`$CHROMIUM is set to ${override}, which does not exist`);
    }
    if (onPath(override)) return override;
    throw new Error(`$CHROMIUM is set to ${override}, which is not on PATH`);
  }

  const found = CANDIDATES.find(onPath);
  if (!found) {
    throw new Error(
      `no chromium on PATH. Tried: ${CANDIDATES.join(', ')}. Set $CHROMIUM to a binary if it is called something else.`,
    );
  }
  return found;
}

function onPath(name) {
  try {
    execSync(`command -v ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}
