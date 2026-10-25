# CV: content draft

Words only. Typography comes after this settles; `placeholder.html` is the
skeleton it gets set into, and `build-placeholder.sh` the pipeline that renders
it.

Structure decided 2026-08-07: **reverse-chronological, jobs first**, two pages,
print background stays and the theology degree comes off. Page 1 is the career,
page 2 is the evidence. The three oldest roles compress into `EARLIER` at the
foot of page 1 so `SELECTED WORK` opens page 2 with room to breathe.

**No em dashes anywhere in this document**, per Kim, 2026-08-07. En dashes in
date ranges (`June 2025 – March 2026`) are a different mark and stay. This rule
carries into the typeset HTML. The check is `grep -rP '\x{2014}' hub/cv/`, and
it must come back empty. Written as an escape rather than as the literal
character on purpose: spelling the rule with the mark it bans would make the
rule its own first violation, and the check would never pass.

---

## Header

**KIM NEJUDNE**
Senior Full-Stack Engineer
Dumaguete, Philippines · open to remote

kimnejudne.dev · github.com/kim-nejudne · linkedin.com/in/kim-nejudne
work.august.nejudne@gmail.com

> The portfolio goes first, before GitHub and LinkedIn. It is the strongest
> link on the page and it was missing from the last version entirely.
>
> Decided 2026-08-07: **Kim Nejudne**, matching the domain, the GitHub handle
> and all five case studies; the legal name stays for contracts. **No phone
> number**, because this PDF gets emailed around and posted to job boards, and
> email plus LinkedIn is reachable enough for a first contact.
>
> The name, the title and the location are three lines rather than one string
> joined by punctuation. They are three different things and the typesetting
> should say so.
>
> **Changed in typesetting, 2026-08-07:** the location moved out from under
> the title and became the last line of the right-hand contact stack, so the
> masthead is name and title on the left against everything-to-reach-him on
> the right. `cv.html` is the authority on placement; this file stays the
> authority on the words.
>
> **The title changed, 2026-08-07.** It read `Design Engineer` and now reads
> `Senior Full-Stack Engineer`, per Kim, who does not identify with the first
> one. Two reasons beyond preference. The label was undercharging the work:
> design engineer usually means frontend plus taste, and four of the five
> shipped spokes have a real backend behind them. And "Senior" appeared
> nowhere on this document or on the site, next to nine years of production
> JavaScript. The past role headings below are untouched, because those are
> what the jobs were actually called and are checkable. The words on this
> document now come from `hub/src/identity.ts`, which is checked against the
> typeset `cv.html` at every hub build.
>
> **The LinkedIn URL changed, 2026-08-08.** Kim set the vanity URL, so the
> line reads `linkedin.com/in/kim-nejudne` instead of the auto-generated
> `linkedin.com/in/kim-nejudne-44a969140`. It now matches the domain, the
> GitHub handle and the masthead on all five case studies, which is the whole
> point: the contact stack was asking a reader to retype nine digits of noise.
> LinkedIn keeps the old slug redirecting, so every PDF already emailed out
> stays live. Nothing checks this string, so it exists in exactly two places
> and both are listed here: this line and `cv.html:471`.

---

## Pitch

Senior full-stack engineer with a designer's eye. Nine years of production
JavaScript (React, TypeScript, Node), Python for the automation and AI work,
and a decade in desktop publishing and magazine design before any of it, which
is where the eye came from. I build the whole thing: interface, motion, API,
schema, pipeline, and the box it runs on.

One product currently shipped and running at **kimnejudne.dev**, with its own
art direction, a written case study and public source.

> Two paragraphs, not nine lines of prose. The second exists to catch the
> skim: Selected Work is on page 2, and this is what tells a reader it is
> there.
>
> **The automation clause was worked in on 2026-08-07**, once D-Launch turned
> out to be scrapers, n8n and LLM steps. Two additions rather than a rewrite:
> "Python for the automation and AI work" in the credentials sentence, and
> "pipeline" into the list of what Kim builds. Putting it in the enumeration
> is the part that matters. Automation reads as one more thing he builds
> alongside interface and schema, rather than as a recent detour bolted onto
> the end of the paragraph.
>
> **It cost no vertical space at all**, which was not luck but was not
> foreseen either: page 1 had 3.2mm of clearance and a fifth line would have
> needed 4.5mm. The old paragraph's last line ended short, and 36 characters
> of new text fell into that slack, so it reflowed to the same four lines with
> line four now running nearly full. Measured in the render rather than
> estimated, and the estimate had said it would overflow.

---

## Experience

### Full Stack Engineer, D-Launch · April 2026 – Present

- Built the automation pipeline behind a fully automated newsletter site for
  the streaming industry, from source collection through to a published issue
- Python scrapers gathering the sources, orchestrated as n8n workflows
- AI integrations drafting, classifying and summarising each issue, with no
  editor in the loop

> Nothing in this entry is invented, unlike the unsourced figures below. A
> fabricated job description at a *current* employer is a different order of
> risk from a fabricated metric at a past one: D-Launch can be contacted, and
> this is the role an interview will spend most of its time on.
>
> **It is the only role on the document that is not about an interface**, and
> that is worth knowing rather than worrying about. The pitch says full-stack
> with a designer's eye; a pipeline role broadens that rather than contradicting
> it, and scrapers into n8n with LLM steps is the most current-sounding work
> here by some distance.
>
> **The title changed on 2026-08-07, per Kim: `Software Engineer` became
> `Full Stack Engineer`.** Worth recording because it is the class of edit this
> document warns about two sections down, where past titles are deliberately
> *not* normalised up to match the site's new one. This one is different on both
> counts and the distinction is the whole reason it is safe: it is a change of
> specificity rather than of seniority, and it is the *current* employer, so it
> is the one title Kim can state from his own contract rather than reconstruct
> from memory. The rule that stands is the one about inflation, and `Software`
> to `Full Stack` does not inflate.
>
> It does mean the two most recent rows on the homepage now read
> `Full Stack Engineer` in succession. That is what the jobs were called, and
> the alternative is varying a title for visual relief, which is the worst
> possible reason to change one.
>
> The words live in `src/roles.ts`, not here: `scripts/identity-check.mjs`
> fails the build if `cv/cv.html` does not name every employer and title in it,
> so this heading and `cv.html:495` have to move together and the check is what
> makes that true rather than diligence.

### Full Stack Engineer, Xergy · June 2025 – March 2026

- Built and shipped six modules for the ERP running a wholesale
  distributor's core operations, front to back in React and NestJS
- Worked directly with the operations and finance teams who used the system,
  turning operational requirements into software rather than taking tickets
  from a spec
- Replaced a two-day manual month-end reconciliation with a report that runs
  in under an hour

> **Cut on 2026-08-07 to make room for D-Launch:** "Kept figures consistent
> where modules overlap. Several processes read and write the same records, and
> a bad write surfaces as a wrong invoice somewhere else entirely."
>
> It described the difficulty rather than a result, and the reconciliation
> bullet below it already carries the data-integrity theme with an outcome
> attached. Every role on page 1 is three bullets now.

### Frontend Engineer, Fabletics · June 2023 – March 2025

- Shipped features to a high-traffic e-commerce storefront serving thousands of
  daily visitors, on a regular release cadence with designers, PMs and backend
  engineers
- Cut largest contentful paint on the product listing page by giving the lead
  product image priority and correct sizing, and removing a client-side data
  waterfall ahead of first render
- Set the review, performance and component standards the frontend was held to
  in an org of 15+, and wrote the onboarding new joiners came up through, in
  React and Redux

> **Replaced on 2026-08-07, and it is the only bullet on the document about
> other engineers.** It read "Held the frontend to that standard release over
> release, in React, Redux and styled-components, on a storefront that never
> went down for a rebuild".
>
> The old one restated the bullet above it. Everything on this CV and all five
> products in the portfolio were evidence of what Kim can build alone, and a
> senior hire on a product team is bought for judgment applied to *other
> people's* work: review, mentoring, technical direction, disagreeing well.
> There was no evidence of any of it. `EARLIER` had the only such line on the
> document, Tawk.to's "a team of fifteen with a strong code-review culture", and
> it was cut for space earlier the same day.
>
> **Confirmed by Kim, not inferred:** code review at volume, mentoring and
> onboarding, technical direction others adopted (performance practices,
> component conventions, review and testing standards, onboarding docs), and an
> org of more than fifteen engineers. Fabletics is where all of it happened and
> is also the longest recent role, so it is the right place to spend the line.
>
> **It replaces rather than adds, because page 1 has no room.** Every role here
> is three bullets and the clearance is about 3.2mm. A first draft ran to three
> lines and **printed the Freelance entry straight through the folio** -- the
> exact failure this file warns about two sections down. Page count stayed 2,
> `build.sh` reported nothing, and the magic bytes were fine, because absolute
> positioning means overlap is not overflow. Caught by rasterising page 1, which
> is the only way it can be caught.
>
> **What came off, and why it is affordable.** "On a storefront that never went
> down for a rebuild" was the nicest phrase in the block and is flavour rather
> than evidence. `styled-components` survives in the Skills row and Redux
> survives at 10x Ventures, so the stack is still on the document; this was the
> cheapest 30 characters available and buying two lines back required them.

> **The two figures came off on 2026-08-07, per Kim, and the technique went in
> instead.** It read "from 4.1s to 1.9s and 340KB off the main bundle, on a
> codebase under real production traffic". Both numbers were on the unsourced
> list below, and an attempt to source them established that they cannot be:
>
> - There is no `git log`. Kim left in March 2025 and has no repository access.
> - The PLP is not publicly measurable. `www.fabletics.com` gates behind a
>   membership sign-in; an anonymous session reaches an interstitial carrying
>   one outbound link. Tried three ways: curl (403), the PageSpeed Insights API
>   (keyless quota exhausted), and headless Chrome with a real mobile UA, which
>   loads the gate and nothing else.
> - Today's site is seventeen months of other people's work regardless.
> - The June 2023 baseline has no observable source by any means.
>
> Measuring what *could* be measured argued against keeping them. The homepage
> today is **LCP 4,776ms** with a **1,202KB** main bundle and 8.98MB of decoded
> JavaScript, so anyone who runs PageSpeed on fabletics.com sees a number
> sitting beside this bullet's old *before* rather than its *after*. That has an
> easy true answer, but it is a question the bullet no longer has to invite. And
> against a 1.2MB main bundle, "340KB off" was real but small.
>
> The replacement names **what was slow and what changed**, which is the half
> Kim can defend from memory in a room. Decimal precision is what invites "how
> did you measure that?"; a technique invites "tell me more", which is the
> question you want.
>
> **It cost no vertical space**, measured in the render rather than estimated:
> two lines before and two lines after, page count still 2.
>
> **"That standard" in the next bullet still has a referent.** It pointed at the
> numbers and now points at the performance work described above it, which is
> what it always meant.
>
> **CrUX History and HTTP Archive are the only external corroboration that
> exists**, and both are origin-level: they could support "the site got faster
> while I owned the frontend" and could never support a personal before/after.
> The CrUX History API needs a free key; unregistered callers get 403, tested.
> See `readiness-brief.md`.

### Full Stack Engineer, 10x Ventures · September 2021 – June 2023

- Built the MVP for a social platform for people building in public, end to
  end, from schema to shipped interface
- Designed the database schema and the backend APIs (NodeJS, Express); built
  the React/Redux frontend against them
- Took it from an early idea to something real users could use and trust,
  reaching its first 2,000 users

> **Cut on 2026-08-07 to make room for D-Launch:** "Worked directly with the
> founders, iterating on features fast enough to keep up with what they were
> learning."
>
> A process bullet, and the first bullet already claims end-to-end ownership of
> the MVP, which implies the same proximity to the founders without spending
> two lines on it.

### EARLIER

**Backend Developer, Tawk.to Inc.** · March – September 2021
NodeJS, MongoDB, Elasticsearch. Microservices depended on by 70+ systems.

**Frontend Developer, Acudeen Technologies Inc.** · May 2019 – March 2021
React, Redux, Sass, Bootstrap. Small team, fast release cadence.

**Freelance Web Developer** · June 2016 – March 2019
React, Redux, NodeJS, Express, MongoDB, Firebase. Owned end to end.

> **Compressed to one line each on 2026-08-07** to make room for D-Launch on
> page 1. The first attempt was not actually one line: the strings ran to about
> 100 characters against a measure that holds 78, so all three still wrapped
> and the change freed 5.5mm instead of the ~20mm it was supposed to. Measured
> in the render rather than estimated, then cut properly, which freed 18mm.
>
> What came off: Tawk.to's Mocha, Sinon and "a team of fifteen with a strong
> code-review culture"; Acudeen's "the company's web application"; Freelance's
> "from the first client conversation to delivery" and "chosen per project
> rather than by habit". These three roles cover 2016 to 2021 and their job on
> this document is to establish continuity, not to argue anything.

---

## Selected Work (page 2)

**POKÉTRACK.** Project tracking that levels up. A partner's entire state
(species, level, evolution) is derived from the sum of its XP events and never
stored, so undoing work de-evolves it for free.
*React · FastAPI · MongoDB · real PokéAPI growth curves*
poketrack.kimnejudne.dev

The bar: 60fps motion, `prefers-reduced-motion` honoured throughout,
keyboard-navigable, and self-hosted on a single DigitalOcean droplet behind
nginx, with no PaaS anywhere.

Case studies at **kimnejudne.dev/work** · source at **github.com/kim-nejudne**

> The stack line and the URL are separate lines now rather than joined by a
> dash. That was layout standing in as punctuation: once this is set in HTML
> they want to be separate elements anyway, at different sizes.
>
> The section had an intro paragraph until 2026-08-07. It was cut because it
> said what the pitch on page 1 already says (five products, five art
> directions, a case study each, public source) and page 1 has to carry that,
> since it is the part a skim reaches. Nothing was lost: the case-study and
> source URLs are on the closing line below, and the five entries are their
> own argument. Page 2 opened straight onto TALLOW until TALLOW and PLINTH
> were taken down on 2026-10-25; it now opens onto POKÉTRACK.

---

## Skills

**Languages** TypeScript · JavaScript · Python · SQL
**Frontend** React · styled-components · Tailwind · SCSS · GSAP
**Backend & data** NestJS · Express · FastAPI · Postgres · MongoDB · Elasticsearch
**Craft** Accessibility (keyboard, semantics, reduced motion) · performance budgets · motion design · typography · tests proven by sabotage
**Automation & AI** n8n · Python scrapers · LLM integrations
**Infrastructure** Docker · nginx · Linux · CI/CD · Git

> Grouped rather than a fifteen-item grid, and cut to what argues for this
> role. `Craft` is the row that does the actual work here. It is the only
> place on the document where the design half of the pitch is named as a set
> of skills rather than implied, and it matters more now that the title says
> engineer twice over: the title claims the seniority and the stack, and this
> row is the only hard evidence for "with a designer's eye" outside the
> portfolio itself.
>
> **`Vue` was cut on 2026-08-12**, and it is the one entry here that failed
> the test the rest of the row passes. No role on this document and no project
> in the portfolio supports it, which makes it the cheapest claim on the page to
> falsify: a screener who asks one follow-up question finds nothing behind it,
> and a skills row that is wrong once is a skills row that gets read as
> aspirational throughout. `identity.ts:116` had already recorded the same
> judgement and kept it off the homepage stack line, so the fold and the CV were
> disagreeing about a claim; they agree now.
>
> The cost was nothing. `Frontend` still runs six deep and the row still wraps
> the same way, checked in the render rather than assumed.
>
> Python and SQL were inferred from POKÉTRACK's FastAPI backend and the
> Postgres work rather than from the old résumé, and Kim confirmed both as
> claims he wants to make (2026-08-07). Python is no longer an inference at
> all: the D-Launch scrapers are production Python at a current employer,
> which is the strongest support any language on this list has.
>
> **n8n was cut and then came back, and the reversal is the point.** It came
> off because it "argues for a different job" than the one being applied for.
> (That job was called design engineering at the time; see the header note.)
> Then
> D-Launch turned out to be scrapers into n8n with LLM steps, so the thing
> that looked like résumé clutter is the current role. `Automation & AI` is a
> row of its own rather than three items appended to `Infrastructure`,
> because it is the newest and most sought-after work on the document and
> burying it next to Git would waste it.

---

## Background

Nine years of production JavaScript, full-stack throughout: ERP modules, a
storefront under real traffic, an MVP from empty schema to its first users.
Before software, a decade of desktop publishing and magazine design, the part
of this work that does not come from a framework.

> The theology degree is cut per the 2026-08-07 decision. Worth noting the
> document now says nothing about formal education at all, which reads as a
> deliberate omission rather than an absence, and that is the intended effect.
>
> **Rebalanced 2026-08-07, per Kim: the section was all editorial and no
> engineer.** Every one of its 41 words was about print, on the last block of a
> CV for a senior full-stack role, so the document closed on typography. The
> print half is now the subordinate clause and the nine years lead.
>
> **Four lines is the hard budget, and it is set by the folio, not by taste.**
> The folio is absolutely positioned in the bottom margin and the section head
> sits where it sits, so there are about 84pt between them. A first draft ran
> to 82 words and printed its last two lines straight through `2 / 2`; a second
> at 57 words still collided by one. Nothing in `build.sh` catches this: the
> page count stays 2 and the magic bytes are fine, because absolute positioning
> means overlap is not overflow. It has to be looked at. Render to a scratch
> path (`./cv/build.sh /tmp/draft.pdf`) and rasterise page 2.
>
> **What was cut, and why it was the right thing to lose.** "It is where the
> typography comes from" went, and the closing clause absorbed its job. It was
> the third print claim in a row on a document that already says "with a
> designer's eye" in the pitch and lists typography under Craft, and cutting it
> is the cheapest 11 words available. Automation went too, despite being the
> current role and the most sought-after work here, because Skills carries an
> `Automation & AI` row four lines above and D-Launch opens page 1.
>
> **The engineering half is a synthesis, not a re-list.** ERP, storefront under
> traffic, MVP from zero: those are the *kinds* of system, which is the senior
> argument and the one thing four reverse-chronological role blocks never
> actually state. It deliberately avoids repeating the pitch's layer list
> ("interface, motion, API, schema, pipeline"), which is the obvious way to
> write this paragraph and would have said nothing new on page 2.

---

## Figures that were never sourced

Kim took these as final on 2026-08-07, after the risk was raised twice and
reaffirmed both times. They are set as plain fact on the page: the draft
tinting, the guillemets and the build guard are all gone, because a document
cannot be half-published.

This list is the only place the distinction survives, and it exists for one
purpose: **these are the things an interviewer can ask about.** Kim said he
would deal with defending them. Knowing exactly which is the cheapest possible
preparation.

**It was eight and it is six.** The two Fabletics figures came off the document
later the same day, replaced by the technique behind them. See the note under
that role.

| Role | Figure |
|---|---|
| Xergy | **six** modules |
| Xergy | **a wholesale distributor's** core operations |
| Xergy | the **operations and finance** teams |
| Xergy | a bad write surfaces as a wrong **invoice** |
| Xergy | **a two-day manual month-end reconciliation**, now **under an hour** |
| 10x Ventures | its first **2,000 users** |

~~Two of the eight can still be turned from invented into sourced~~ **This was
wrong, and finding out cost an afternoon.** It said the Fabletics LCP and bundle
figures could be measured against the live storefront with `git log` alongside.
Neither is available: Kim left in March 2025 so there is no repository, and the
PLP sits behind a membership gate so the page the bullet named cannot be loaded
anonymously by any tool. Kept struck through rather than deleted, because it is
the plausible-sounding wrong idea and somebody will have it again.

**The remaining six have no equivalent escape route.** All are internal facts
about private systems at past employers, so no measurement, archive or public
dataset can reach any of them. The Fabletics pair looked sourceable only because
a storefront is public, and even that turned out not to be true. What worked
there was rewriting the claim to something Kim can defend from memory, and it is
the only move available for the other six as well.

## Open questions

1. ~~**The pitch does not mention automation or AI.**~~ Done 2026-08-07. See
   the note under the pitch.

2. **The employer is named**, deliberately, on a CV published at a public URL.
   Kim's call on 2026-08-07, with the consequence stated: D-Launch can discover
   he is looking by opening kimnejudne.dev.

3. **The swap has happened.** `public/cv.pdf` is the real document and
   `cv/PLACEHOLDER` is gone. This paragraph said the opposite until 2026-08-07,
   which is how the retitle nearly missed the PDF: the note claimed the shipped
   file was a placeholder nobody had to update, and the shipped file was the
   real CV serving `DESIGN ENGINEER` from the homepage's two download buttons.

   **The PDF does not update when `cv.html` does**, and nothing said so. It is a
   render, so every text check in this repository looked straight past it:
   chromium writes page text into a compressed stream and a grep finds nothing.
   `scripts/identity-check.mjs` now decodes it with `pdftotext -layout` at every
   hub build and fails naming the file. Editing the words above means running
   `./cv/build.sh` afterwards.
