# TALLOW — Case Study

**A dry-aged steakhouse with a live 86 board.** Reservations checked against real
cover capacity, a back-of-house console that strikes a dish from the public menu
the moment the kitchen runs out, and a printed-menu art direction that holds up
under a loupe.

Stack: Vite 6 · React 19 · TypeScript · Express 4 · Postgres · Tailwind 4 ·
Docker on a DigitalOcean droplet.

## The short version

**What it is** A reservations and back-of-house system for a dry-aged
steakhouse. Bookings are checked against real per-sitting cover capacity, and
the 86 board strikes a dish from the public menu the moment the kitchen runs
out.

**The hardest problem** The generated auth compared a hardcoded PIN and
returned the literal string `staff-session-active-token`, and no other route
checked it, so the reservation book with every guest's name, email and phone was
open to anyone who typed the URL. The fix was signed expiring session tokens, a
rate-limited sign-in and two roles, so a stranger can walk the back of house
without being able to delete the menu.

**What the scaffold missed** Nought of six admin routes behind auth, one ARIA
attribute in the whole app, `prefers-reduced-motion` honoured on a single class,
four font families loading render-blocking from a CDN, an 879-line dashboard
component, and a typecheck that was implicitly `any` throughout.

**How it was proven** Six of six routes guarded, 85 ARIA attributes, a global
reduced-motion policy, 156KB of self-hosted latin-subset fonts, a 289-line
largest module, `strict` on. The contrast figures were measured against
`getComputedStyle` in a real browser rather than read off the stylesheet.

---

## Where this started, plainly

**TALLOW was scaffolded by an AI app builder in about ten minutes.** Concept, art
direction, seven views and thirteen API routes arrived essentially free. I did
not hand-build this from a blank page, and the interesting part of the story is
not that I could have.

The interesting part is the distance from that draft to this repo — because a
generated app is a convincing shell, and a shell is exactly what a hiring
manager should be suspicious of. The scaffold was the starting line. What
follows is what it cost to make it real.

Two things the draft genuinely got right, and I kept:

- **The art direction.** Paper stock, hairline rules, a display serif, data set
  in mono like a spec sheet. It reads like something that could be printed and
  handed to you. My print background is why I could tell it was right — the
  craft pass deliberately did not restyle it.
- **The domain model.** Early / prime / late sittings, per-slot cover maths,
  tokenised booking lookup. That is real product thinking and it survived intact.

Everything below is what the draft did *not* buy.

---

## 1. The admin surface had no lock on it

The generated auth compared a hardcoded PIN (`tallow123`) and returned the
literal string `'staff-session-active-token'`. No other route checked it. Every
admin endpoint — 86 the menu, delete a dish, read the full reservation book with
every guest's name, email and phone — was open to anyone who typed the URL.

Fixed with signed, expiring session tokens, a rate limiter on the sign-in route,
and `requireSession` / `requireStaff` guards on every admin route. `SESSION_SECRET`
is mandatory and the server **refuses to boot without it** rather than failing on
the first sign-in, so a misconfigured deploy dies at the healthcheck instead of
quietly serving an unlocked dashboard.

**The demo problem, and the interesting part of the answer.** A portfolio piece
has to let a stranger walk through the back of house. A portfolio piece also
cannot let a stranger delete the menu. So there are two roles: `staff` writes,
`demo` reads. The read-only session is enforced on the server, and the UI mirrors
that refusal — every writing control shares one `writeProps` spread, so a
read-only session sees them as unavailable rather than clicking them and eating a
403. The demo PIN is served from an API route rather than compiled into the
bundle, so rotating it doesn't need a rebuild.

The cover maths, the sitting loads and the 86 board are all live in the demo.
Nothing is faked for the tour.

**Then the invitation was measured, and it failed.** Having built the demo role,
the sign-in screen announced it in a 10px brass caption tucked under the PIN
field — `#8C6E43` on `#F7F4EE`, which measures **4.32:1** against AA's 4.5:1
floor for normal text, and 10px is nowhere near the large-text exemption. The
one screen written to be read by a stranger was the one place the contrast
budget had been quietly overspent, and it survived because nobody had pointed a
contrast checker at a *hint* — hints read as decoration until you need one.

It is now the same brass notice the dashboard already uses for its read-only
banner, moved above the form: `#5C4A2E` on `#EFE6D5` at 11px, **6.85:1**,
verified against `getComputedStyle` in a real browser rather than against the
stylesheet. No new colour was invented — the fix was to stop inventing one and
reuse the pair that already passed.

The screen also stopped asking a reviewer to do transcription. Reading a PIN and
typing it into a password field is three chances to give up, so there is a
second button that signs in with the PIN the server already publishes. It is
deliberately the *secondary* control even though it is the only one a public
visitor can complete: making it primary would turn a staff portal into a
portfolio demo, and the PIN field is what proves the lock is real. Both controls
share one code path and one in-flight flag, so the button is not a second kind
of sign-in that can drift from the first — it is the same POST. Where `DEMO_PIN`
is unset, the banner and the button both vanish and an ordinary staff sign-in is
left behind.

## 2. Accessibility: three attributes to a keyboard-operable app

The scaffold shipped one `aria-label` and a single `prefers-reduced-motion` rule
covering one class. The app now carries 85 ARIA attributes, but the count is not
the point — these were the failures that actually locked people out:

**Client-side routing said nothing.** Changing route swapped the entire page
while the document title stayed put, focus stayed on the link that was clicked,
the viewport kept its old scroll offset, and a screen reader announced nothing at
all. `RouteAnnouncer` restores all four, and route names live in one `pageMeta`
module so the tab title and the spoken announcement can differ — the tab wants
the brand, the announcement does not want to hear "TALLOW" read aloud before
every page name.

**The choice grids were buttons wearing radio costumes.** Party size and sitting
time are single-select, and both were rendered as `<button>` grids: no group
name, no checked state, no arrow-key traversal, nothing telling a screen reader
the choices were exclusive. They are now real radio inputs, visually hidden
under the same printed styling, so all of that behaviour comes from the platform
instead of from me.

Unavailable sittings are `aria-disabled`, not `disabled` — a fully committed
19:30 is *information a guest wants*, and a truly disabled input is skipped
silently by the keyboard and never read at all. Each option's spoken label
carries the detail the visual cell can leave implicit: "19:30, 12 covers open".

**The modal was a modal for mouse users only.** The menu editor rendered over
the page and left focus behind it, so a keyboard user tabbed straight through to
the document underneath, operating controls they could not see. `useFocusTrap`
moves focus in, cycles Tab within, closes on Escape, locks background scroll,
and — the part most often skipped — returns focus to the control that opened it.

**Reduced motion is now a policy, not a per-component afterthought.** One global
rule neutralises anything that animates; new motion has to opt back in
deliberately rather than escape by being forgotten. Durations go to `0.01ms`
rather than `0`, so `transitionend` still fires and nothing waiting on it is
stranded.

## 3. The keyboard shortcuts fought the keyboard

The staff table has vim-style bindings — `j`/`k` to move, `1`–`4` to set a
booking to seated / confirmed / completed / cancelled, `/` to focus the filter.
Good idea, correct instinct for a service console.

They were bound to `window`. Pressing `j` while typing in the date picker moved
the table cursor instead of typing a `j`. The only guard was a check for one
specific input element.

Now the listener is scoped to the panel, ignores any event originating in a
field, and row commands require the cursor to actually be in the table body.
Rows use a **roving tabindex** — the table is one tab stop and the arrow keys
move within it — and the focused index is clamped when a filter shrinks the list
under it, which previously left the shortcuts acting on a row that no longer
existed. Because a number-key press has no visible affordance, each status
change is announced: *"Eleanor Vance, 19:30: seated."*

## 4. Earning the 86 strike

The 86 board is the app's signature move: the kitchen strikes a cut, and it goes
through on the public menu. It happened instantly, with no transition at all.

`text-decoration-line` is not animatable. `text-decoration-color` is. So **every**
menu line carries `line-through` at all times, held transparent, and being 86'd
transitions the colour in over 420ms — the strike *inks in* rather than popping.
Colour and opacity only: no layout, no compositing surprises, no restyling of a
design that was already right.

That is the whole motion budget on this spoke, and deliberately so. The
restrained end of the range is where the steakhouse belongs; the animation
showcase is a different piece. **I removed the `motion` library** — it had been
installed by the scaffold and never imported once. Shipping a dependency you
don't use is the same failure as shipping motion you don't need.

## 5. Bugs found by actually running it

Typechecking green is not the same as working. These came out of exercising the
thing:

- **`npm run dev` could not start from a `.env` file.** `db.ts` reads
  `DATABASE_URL` while its module body evaluates — which under ESM happens
  before any statement in `server.ts` runs — so the `dotenv.config()` call
  further down loaded the file long after the process had already thrown. It
  only worked in production because the container passes real environment
  variables. Fixed by making it a side-effect import, first.
- **`@types/react` was never installed.** Every prop, hook and JSX element in the
  app was implicitly `any`, and `npm run lint` was passing on all of it — a
  typecheck giving false confidence is worse than no typecheck. Types installed,
  `strict` + `noUnusedLocals` + `noUnusedParameters` enabled. Total fallout
  across the whole app: three unused imports.
- **The calendar export produced invalid files.** End time was the start hour
  plus two, computed as string maths — so the last sitting of the night emitted
  `DTEND:...T2400`, which is not a valid time, and never rolled over to the next
  day. Guest notes went in unescaped, so a comma silently truncated the
  description in most calendar clients. Rewritten against RFC 5545: correct
  duration arithmetic, escaped text, `UID` and `DTSTAMP` (without a UID,
  re-importing duplicates the event instead of updating it), CRLF line endings
  and 75-octet line folding.
- **The object URL behind that download was never revoked**, leaking a blob per
  click for the life of the document.
- **The reservation date window was unenforced.** The site promises bookings open
  30 days ahead; the API accepted any well-formed date, including ones in the
  past. The input bounds it now *and* so does the server — the input is not the
  security boundary.
- **Two lockfiles** (`bun.lock` and `package-lock.json`) with a Dockerfile
  running `npm ci`. Removed the stray one before it resolved something different
  in CI than on the desk.

## 6. Performance

- **Fonts self-hosted.** Four families were loading from the Google Fonts CDN
  behind a render-blocking stylesheet on a third-party origin. Now bundled,
  same-origin, hashed and cacheable.
- **Newsreader: 276KB → 48KB.** Requested as a two-axis variable font, its
  regular and italic came to 132KB and 144KB. The body serif is only ever set at
  one weight — so it ships as two static instances at 24KB each. The UI and data
  faces *do* carry weight variation, so those stay variable. Whole family set:
  **156KB, latin-subset.**
- Remote images lazy-load and decode async; the decorative hero backdrop is
  requested at a size that suits a 15%-opacity grayscale wash rather than a hero
  photograph.
- Dead build dependencies removed (`autoprefixer` with no PostCSS config,
  `@types/dotenv` for a self-typed package).

## 7. Architecture

`StaffDashboard.tsx` was 879 lines holding auth, four panels, a modal, data
fetching and a global key handler. It is now nine focused modules behind a
`StaffSession` context, the largest of which is 289 lines. Same behaviour, minus
the bugs that were hiding in it.

The scaffold's other leavings went too: an AI-Studio `.env.example` documenting
a Gemini key the app never used, a `metadata.json` claiming a server-side AI
capability that does not exist, and HMR config commented "do not modify" for a
platform this no longer runs on. The `.env.example` now documents the variables
the app actually reads, and says which ones the server refuses to boot without.

---

## What I chose not to build

The private dining enquiry form on the Visit page never went anywhere — it set a
`submitted` flag and showed a success message. Wiring it to a real endpoint meant
inventing product beyond this spoke's scope, so instead the confirmation stops
claiming something was sent: private hire is arranged by hand, and the copy now
says so and gives the phone number and address. **A form that lies about what it
did is the shell problem in miniature**, and the honest version cost one
paragraph.

## What the numbers say

| Measure | Scaffold | Shipped |
|---|---|---|
| Admin routes behind auth | 0 of 6 | 6 of 6 |
| ARIA attributes | 1 | 85 |
| `prefers-reduced-motion` coverage | 1 class | global policy |
| Font payload | 4 families, CDN, render-blocking | 156KB, self-hosted |
| Largest component | 879 lines | 289 lines |
| TypeScript | implicitly `any` throughout | `strict` |

---

## The honest summary

The AI builder gave me a good-looking, well-modelled draft in ten minutes and
saved me the blank page — which is real, and I'd do it again. It also gave me an
unauthenticated admin panel, an app that was inaccessible to anyone not using a
mouse, a typecheck that checked nothing, and a calendar export that emitted
invalid files.

Knowing which of those matter, in what order, and what each actually costs to
fix — that is the job. The scaffold is not the work. This is.
