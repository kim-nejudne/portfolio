# CV: content draft

Words only. Typography comes after this settles; `placeholder.html` is the
skeleton it gets set into, and `build-placeholder.sh` the pipeline that renders
it.

**Structure changed 2026-11-23 (ATS overhaul, per Kim):** header, summary,
Skills, then the four main roles fill page 1; page 2 is `EARLIER EXPERIENCE`
then a compressed `SELECTED WORK`. `BACKGROUND` and the AI-method coda are gone.
The 2026-08-07 structure below is kept as history.

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
Senior Full-Stack Developer

kimnejudne.dev · github.com/kim-nejudne · linkedin.com/in/kim-nejudne · work.august.nejudne@gmail.com
Remote (UTC+8 · Open to US, EU & APAC hours)

> **2026-11-26, per Kim.** The title is `Senior Full-Stack Developer`, and the
> homepage H1 is the title alone. The pitch opens with `Senior full-stack developer.`

> **2026-11-23, ATS overhaul, per Kim.** Single column. The two-column masthead extracted
> across the gutter in line-based parsers ("Kim Nejudne kimnejudne.dev"). The
> location became the timezone line, worded by Kim, and the same line is on the
> homepage via `AVAILABILITY` in `src/identity.ts`.

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

Senior full-stack developer. Nine years of
production React, TypeScript and Node: a multi-tenant platform for
engineering consultancies, features for a global membership storefront, a
startup MVP. I own
features end to end, schema to deployment, with a decade of magazine design
behind the UI.

> **2026-11-23, ATS overhaul, per Kim.** Three lines, one paragraph. It must open with
> `PITCH_SENTENCE`; `scripts/identity-check.mjs` fails the build otherwise.
> "Python for the automation and AI work" went with D-Launch; Python stays in
> Skills, backed by PokéTrack's FastAPI. The second paragraph (four products)
> went for the 3-line budget; the portfolio URL leads the contact line.

> Two paragraphs, not nine lines of prose. The second exists to catch the
> skim: Selected Work is on page 2, and this is what tells a reader it is
> there.
>
> **The automation clause was worked in on 2026-08-07**, to name the scrapers,
> n8n and LLM work. Two additions rather than a rewrite:
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

### Contract Full Stack Engineer, NETINT Technologies · April – October 2026

- Built a proof of concept for offering NETINT's video processing units as a
  cloud service
- Built netint.com's research page, a searchable VPU resource library, in
  WordPress and Elementor

> **2026-11-26, per Kim.** The research page bullet is back, now that the
> homepage shows a screenshot of that page. Kim built it with WordPress and
> Elementor, and confirmed the screenshot is cleared to show. Nothing here
> came from the NETINT archive.

> **2026-11-23, ATS overhaul, per Kim.** The WordPress bullet came off so the top role reads
> as full-stack engineering. Kim wants the POC split into 2 to 3 NDA-safe
> technical bullets (stack, what he owned, safe outcome); **those facts are
> still to come**, and nothing was taken from the NETINT archive.

> **Added 2026-11-02, per Kim.** The client is named at
> Kim's decision, on a CV served from a public URL. The bullets are generic on
> purpose: the engagement's material is confidential and none of it is on this
> document beyond what the two lines say. The title is what the contract was
> called, on the same rule as every other heading here.
>
> **Page 1 paid for it.** The block costs a heading and two lines on a page
> that had about 3mm of clearance. 10x Ventures gave up its third bullet (see
> that role), and four bullets lost the word or two that had wrapped onto a
> line of their own: "front to back" here, "with" under the role above it,
> "from schema to shipped interface" at 10x Ventures, and Xergy's reconciliation bullet now
> opens "Cut" rather than "Replaced". Measured by rasterising page 1. The first
> render printed Freelance through the folio.
>
> It is also in `src/roles.ts`, so the homepage lists it and
> `scripts/identity-check.mjs` holds this heading to it.
>
> **2026-11-23, per Kim: the previous top role was removed, and NETINT now
> leads.** The dates stay April – October 2026, because that is when the
> contract ran; no role on the document says Present. The freed space bought
> back two of the trims above: Xergy's reconciliation bullet opens "Replaced"
> again, and 10x Ventures has "from schema to shipped interface" back. Page 1
> was rasterised after the change and has clearance to spare.

### Full Stack Engineer, Xergy · June 2025 – March 2026

- Helped build Proteus, a multi-tenant project lifecycle platform for
  engineering consultancies, across proposals and pricing, cost and schedule
  controls, resourcing and timesheets, and invoicing, in React and Laravel
- Built tenant-specific features and per-tenant configuration on a shared
  core, with each customer's data kept isolated
- Onboarded new tenants and synced invoicing with their ERP and accounting systems

> **2026-11-26, per Kim: all three bullets replaced.** Kim helped build
> Proteus, Xergy's multi-tenant project lifecycle platform for engineering
> consultancies (proposals, project controls, resources and time, invoicing),
> a React SPA on a Laravel backend. Kim's tenant work covered tenant-specific
> features, configuration of the shared core, data isolation and onboarding.
> The wholesale-distributor ERP framing, the six modules, the reconciliation
> figure and the operations and finance line came off: Kim said none of them
> happened on Proteus. The Pitch changed with them. The notes below are history.

> **2026-11-23, ATS overhaul, per Kim.** Reconciliation moved to bullet 1: the strongest
> business outcome leads. Tenure left unexplained (Kim did not pick a framing).

> **Cut on 2026-08-07 to make room on page 1:** "Kept figures consistent
> where modules overlap. Several processes read and write the same records, and
> a bad write surfaces as a wrong invoice somewhere else entirely."
>
> It described the difficulty rather than a result, and the reconciliation
> bullet below it already carries the data-integrity theme with an outcome
> attached. Every role on page 1 was three bullets after it.

### Frontend Engineer, Fabletics · June 2023 – March 2025

- Migrated a VIP-membership storefront serving millions of members from Adobe
  ColdFusion and Vue.js to Next.js and NestJS, one section at a time, while
  still shipping new features and seasonal campaigns
- Released changes in stages behind A/B tests, so each one was proven on live
  traffic before it reached every member
- Built features for an international storefront, with copy pulled per
  language from the translation team's tool

> **2026-11-26, per Kim: all three bullets replaced.** The role was the
> migration of the storefront from Adobe ColdFusion and Vue.js to Next.js and
> NestJS, done section by section while features and seasonal campaigns kept
> shipping, with staged rollouts, A/B tests and per-language copy from a
> translation team's tool. Kim was a core member of the migration team, hence
> "Migrated". Kim built on the translation tool rather than building it.
> Kim chose these three over keeping the LCP bullet and the review, standards
> and onboarding bullet, so the notes below about those two are history.

> **2026-11-23, ATS overhaul, per Kim.** Scale wording is Kim's. "Significantly reduced"
> rather than "roughly halved", because "halved" was offered only if true and
> was not confirmed. No figures; see the 2026-08-07 note below.

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

> **Cut on 2026-11-02 to make room for NETINT, Kim's choice between the two
> candidates:** "Took it from an early idea to something real users could use
> and trust, reaching its first 2,000 users." It was the only outcome in the
> block. It was also an unsourced figure an interviewer could press on, and
> that weighed more. "From schema to shipped interface" came off the first
> bullet the same day, because the second bullet says it in full. It went back
> on 2026-11-23, when page 1 had room again.

> **Cut on 2026-08-07 to make room on page 1:** "Worked directly with the
> founders, iterating on features fast enough to keep up with what they were
> learning."
>
> A process bullet, and the first bullet already claims end-to-end ownership of
> the MVP, which implies the same proximity to the founders without spending
> two lines on it.

> **2026-11-23, ATS overhaul, per Kim.** "2,000 users" stays off. Kim wants this role expanded
> with real deliverables; **those are still to come.**

### EARLIER EXPERIENCE (page 2 since 2026-11-23)

**Backend Developer, Tawk.to Inc.** · March – September 2021
- Developed Node.js microservices depended on by 70+ systems, on MongoDB and
  Elasticsearch, tested with Mocha and Sinon

**Frontend Developer, Acudeen Technologies Inc.** · May 2019 – March 2021
- React, Redux, Sass, Bootstrap. Small team, fast release cadence.

**Freelance Web Developer** · June 2016 – March 2019
- React, Redux, Node.js, Express, MongoDB, Firebase. Owned client projects end
  to end.

> **2026-11-23, ATS overhaul, per Kim.** Moved to page 2 to make room for Skills on page 1.
> Mocha and Sinon are back (cut for space on 2026-08-07, see below). Kim wants
> Tawk.to expanded with what the services did and a defensible reliability
> detail; **still to come.**

> **Compressed to one line each on 2026-08-07** to make room on page 1. The first attempt was not actually one line: the strings ran to about
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

**POKÉTRACK.** Project tracking that levels up: a partner's species, level and
evolution are derived from its XP events and never stored, so undoing work
de-evolves it for free.
*React · FastAPI · MongoDB* · poketrack.kimnejudne.dev

**TS-DOJO.** A TypeScript course graded by the real compiler, running
TypeScript 6 in a Web Worker for live diagnostics. No backend; it works offline.
*Vite · React · TypeScript 6 · CodeMirror 6 · Web Workers* · dojo.kimnejudne.dev

**BUZZR.** A game-show buzzer: players buzz from their phones and one server
decides who was first, corrected for each phone's latency.
*React · Express · Socket.IO · TypeScript 6* · buzzr.kimnejudne.dev

**SKETCHY.** A party drawing game: the drawer's strokes stream live to the TV
while everyone guesses on their phones and the server keeps the clock.
*React · Express · Socket.IO · TypeScript 6* · sketchy.kimnejudne.dev

All four self-hosted on DigitalOcean behind nginx, deployed by GitHub Actions.
Case studies at **kimnejudne.dev/work** · source at **github.com/kim-nejudne**

> **2026-11-23, ATS overhaul, per Kim.** Two lines plus a stack line per project. The coda
> saying how the work was built (AI scaffold, agents against specs) came off
> the CV; the case studies and GitHub README still say it. Superseded notes
> below are history.

> The stack line and the URL are separate lines now rather than joined by a
> dash. That was layout standing in as punctuation: once this is set in HTML
> they want to be separate elements anyway, at different sizes.
>
> The section had an intro paragraph until 2026-08-07. It was cut because it
> said what the pitch on page 1 already says (five products, five art
> directions, a case study each, public source) and page 1 has to carry that,
> since it is the part a skim reaches. Nothing was lost: the case-study and
> source URLs are on the closing line below, and the five entries are their
> own argument. ~~Page 2 opened straight onto TALLOW until TALLOW and PLINTH
> were taken down on 2026-10-25; it now opens onto POKÉTRACK.~~ Superseded
> 2026-11-02: page 2 now lists all four spokes, in the hub's order.
>
> **Buzzr and Sketchy joined on 2026-11-02**, a day after they went live on
> the hub. The latency claim in Buzzr's entry is checked against
> `hub/case-studies/buzzr.md` §2 (the server's adjusted time, capped at 150 ms).
>
> **The coda now says how the work was built.** The GitHub profile README and
> every case study already said it, and the CV was the one surface that did
> not. A reader who follows the link from here to a case study should not meet
> the method for the first time there. It is accurate per project. PokéTrack
> was a generated scaffold that was rewritten. The other three were written by
> an agent against a spec, with Kim's part being the brief and the product
> calls. "With no PaaS anywhere" came off to keep the paragraph at four lines,
> since "self-hosted" already says it.

---

## Skills (page 1, under the summary, since 2026-11-23)

**Languages** TypeScript · JavaScript · Python · SQL · HTML · CSS
**Frontend** React · Next.js · Redux · Zustand · TanStack Query · styled-components · Tailwind · SCSS · GSAP
**Backend & data** Node.js · NestJS · Express · PHP · Laravel · Socket.IO · FastAPI · Zod · PostgreSQL · Supabase · MongoDB · Elasticsearch

> **2026-11-26, per Kim.** PHP and Laravel are back, now that the Xergy role
> names Laravel (Proteus is a React SPA on a Laravel backend). WordPress stays
> off.
**Testing** Jest · Vitest · Playwright · Testing Library · Mocha · Sinon
**Cloud & CI/CD** Docker · GitHub Actions · Vercel · DigitalOcean · nginx · Linux · Git
**AI** LLM integrations (Anthropic API) · AI-assisted development
**Practice** Core Web Vitals · accessibility (keyboard, semantics, reduced motion) · real-time multiplayer · code review · mentoring

> **2026-11-23, ATS overhaul, per Kim.** Exact names for ATS. Dropped: n8n, Python
> scrapers (no role behind them after D-Launch), WordPress / PHP (Kim),
> "tests proven by sabotage", "performance budgets", "motion design",
> "typography". Added: Redux (Fabletics, 10x, Acudeen), the portfolio tools Kim
> said he can defend (Vitest, Playwright, Testing Library, Zustand, TanStack
> Query, Zod, GitHub Actions, DigitalOcean), Mocha and Sinon (Tawk.to). LLM
> integrations are backed by Buzzr and Sketchy (`server/generate/`, Anthropic
> API). Code review and mentoring are the Fabletics confirmation. Kim added
> Jest, Vercel, Next.js, Supabase and DigitalOcean as production tools, same
> day.

> **Added 2026-11-02, per Kim.** Socket.IO and real-time multiplayer come
> from Buzzr and Sketchy. WordPress / PHP comes from the NETINT contract. The
> agent-driven method comes from ts-dojo, Buzzr and Sketchy. Each one has a
> role or a live spoke behind it, which is the test the rest of the row
> passes. Postgres stays at Kim's decision, although the homepage stack line
> dropped it on 2026-11-01. "With latency correction" and "coding" were cut
> for space: Buzzr's entry carries the latency claim, and page 2 was two lines
> over on the first render.
>
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
> claims he wants to make (2026-08-07). The production scrapers behind the
> `Automation & AI` row are Python too.
>
> **n8n was cut and then came back, and the reversal is the point.** It came
> off because it "argues for a different job" than the one being applied for.
> (That job was called design engineering at the time; see the header note.)
> It came back on 2026-08-07, when scrapers into n8n with LLM steps became
> real production work rather than résumé clutter. `Automation & AI` is a
> row of its own rather than three items appended to `Infrastructure`,
> because it is the newest and most sought-after work on the document and
> burying it next to Git would waste it.

---

## Background

> **2026-11-23, ATS overhaul, per Kim.** **Removed.** It repeated the summary. Kept below as
> history.

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
> most sought-after work here, because Skills carries an `Automation & AI` row
> four lines above.
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

**It was eight, then six, and it is five.** The 10x Ventures user count came
off on 2026-11-02 with its bullet; see that role. The two Fabletics figures came off the document
later the same day, replaced by the technique behind them. See the note under
that role.

| Role | Figure |
|---|---|
| Xergy | **six** modules |
| Xergy | **a wholesale distributor's** core operations |
| Xergy | the **operations and finance** teams |
| Xergy | a bad write surfaces as a wrong **invoice** |
| Xergy | **a two-day manual month-end reconciliation**, now **under an hour** |

~~Two of the eight can still be turned from invented into sourced~~ **This was
wrong, and finding out cost an afternoon.** It said the Fabletics LCP and bundle
figures could be measured against the live storefront with `git log` alongside.
Neither is available: Kim left in March 2025 so there is no repository, and the
PLP sits behind a membership gate so the page the bullet named cannot be loaded
anonymously by any tool. Kept struck through rather than deleted, because it is
the plausible-sounding wrong idea and somebody will have it again.

**2026-11-26: the Xergy figures came off with the bullets that carried them**
(Kim replaced the role's bullets; see that role). None of the five rows above
is on the document any more.

**The remaining six have no equivalent escape route.** All are internal facts
about private systems at past employers, so no measurement, archive or public
dataset can reach any of them. The Fabletics pair looked sourceable only because
a storefront is public, and even that turned out not to be true. What worked
there was rewriting the claim to something Kim can defend from memory, and it is
the only move available for the other six as well.

## Open questions

1. ~~**The pitch does not mention automation or AI.**~~ Done 2026-08-07. See
   the note under the pitch.

2. ~~**The current employer is named on a public CV.**~~ Moot since
   2026-11-23: no role on the document says Present, so nobody reading
   kimnejudne.dev learns where Kim works now.

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
