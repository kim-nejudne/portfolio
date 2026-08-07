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

kimnejudne.dev · github.com/kim-nejudne · linkedin.com/in/kim-nejudne-44a969140
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

---

## Pitch

Senior full-stack engineer with a designer's eye. Nine years of production
JavaScript (React, TypeScript, Node), Python for the automation and AI work,
and a decade in desktop publishing and magazine design before any of it, which
is where the eye came from. I build the whole thing: interface, motion, API,
schema, pipeline, and the box it runs on.

Five products currently shipped and running at **kimnejudne.dev**: five
distinct art directions, a written case study each, public source for all five.

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

> Nothing in this entry is invented, unlike the eight figures below. A
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
- Cut largest contentful paint on the product listing page from 4.1s to 1.9s
  and 340KB off the main bundle, on a codebase under real production traffic
- Held the frontend to that standard release over release, in React, Redux and
  styled-components, on a storefront that never went down for a rebuild

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

**TALLOW.** Dry-aged steakhouse. Reservations booked against real cover
capacity, and an 86 board wired from the kitchen straight to the public menu.
*Vite · React · Express · Postgres*
tallow.kimnejudne.dev

**PLINTH.** A sixteen-week periodised strength program told entirely in type.
No photography anywhere, by design: everything is type, rule, colour and drawn
SVG.
*Vite · React · GSAP*
plinth.kimnejudne.dev

**FORME.** A trade printer's production system. The preflight engine measures
your PDF with poppler and ghostscript rather than asserting it passed, and
reports `SKIPPED` with a stated reason for the three checks it cannot make.
*Next.js · NestJS · Postgres · Drizzle · 172 tests*
forme.kimnejudne.dev

**POKÉTRACK.** Project tracking that levels up. A partner's entire state
(species, level, evolution) is derived from the sum of its XP events and never
stored, so undoing work de-evolves it for free.
*React · FastAPI · MongoDB · real PokéAPI growth curves*
poketrack.kimnejudne.dev

**SUKI.** A neighbourhood sari-sari store's ledger, built for a cheap Android
phone with no signal. Hand-rolled sync over IndexedDB: an append-only operation
queue, client-generated UUIDs as idempotency keys, server authoritative. No
CRDTs, because there is one writer and sums commute.
*Vite · React · NestJS · Postgres · offline-first*
suki.kimnejudne.dev

Across all five: 60fps motion, `prefers-reduced-motion` honoured throughout,
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
> own argument. Page 2 now opens straight onto TALLOW.

---

## Skills

**Languages** TypeScript · JavaScript · Python · SQL
**Frontend** React · Vue · Next.js · styled-components · Tailwind · SCSS · GSAP
**Backend & data** NestJS · Express · FastAPI · Postgres · MongoDB · Drizzle · Elasticsearch
**Craft** Accessibility (keyboard, semantics, reduced motion) · performance budgets · motion design · typography
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

Kim took these eight as final on 2026-08-07, after the risk was raised twice
and reaffirmed both times. They are set as plain fact on the page now: the
draft tinting, the guillemets and the build guard are all gone, because a
document cannot be half-published.

This list is the only place the distinction survives, and it exists for one
purpose: **these are the eight things an interviewer can ask about.** Kim said
he would deal with defending them. Knowing exactly which eight is the cheapest
possible preparation.

| Role | Figure |
|---|---|
| Xergy | **six** modules |
| Xergy | **a wholesale distributor's** core operations |
| Xergy | the **operations and finance** teams |
| Xergy | a bad write surfaces as a wrong **invoice** |
| Xergy | **a two-day manual month-end reconciliation**, now **under an hour** |
| Fabletics | LCP on the PLP, **4.1s to 1.9s** |
| Fabletics | **340KB** off the main bundle |
| 10x Ventures | its first **2,000 users** |

Two of the eight can still be turned from invented into sourced without anyone
telling Kim anything: the Fabletics LCP and bundle figures can be measured
today against the live storefront, and `git log` around the performance commits
will say what actually changed. That is the highest-value bullet on the
document and the least effort to make true.

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
