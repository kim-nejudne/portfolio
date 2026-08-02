# PRD — PLINTH Marketing Site

## Original problem statement
Single-page marketing site for PLINTH, a 16-week periodised strength program.
Portfolio piece for a design engineer: editorial poster design meeting
Apple-grade scroll craft. No photographs, no backend, no component library.
Kinetic editorial art direction: Bone #F2EEE6 / Ink #101010 / Blue #1F2BFF
(structure) / Vermilion #FF3B14 (effort). Archivo (display, width axis) +
Space Mono (data). GSAP-only animation (ScrollTrigger, SplitText,
DrawSVGPlugin) inside gsap.matchMedia with a prefers-reduced-motion policy.
Nine plates: hero, premise, pinned wall planner, horizontal blocks, load
curve, session, Sunday cadence, evidence, close.

## Architecture
- Vite + React 19 + TypeScript (strict, noUnusedLocals/Parameters)
- Tailwind CSS 4 via @tailwindcss/vite; palette + --nav-height as CSS custom
  properties in src/index.css
- GSAP + @gsap/react; plugins registered once at module scope in
  src/gsapSetup.ts; every animation inside useGSAP + gsap.matchMedia
  (isDesktop / isMobile / reduceMotion)
- Fonts bundled: @fontsource-variable/archivo (standard.css, wght + wdth
  axes), @fontsource/space-mono 400/700
- Fixed datasets in src/data.ts (blocks, tonnage, intensity, sessions,
  evidence) — no Math.random anywhere
- src/images.ts: typed 4-slot image manifest, all url:'' ; Figure.tsx renders
  a designed solid-panel fallback. Zero slots used visually.
- No backend, no database, no auth, no routing, no env usage. Template
  backend (FastAPI/Mongo scaffolding) deleted per spec.

## User personas
- Design engineer reviewing the piece as a portfolio artifact (motion craft,
  typography, accessibility)
- Strength trainee evaluating the program (facts, price, cadence)

## Core requirements (static)
Nine plates in order; colour blocking as layout; blue = plan, vermilion =
effort; transform/opacity-only animation (one DrawSVG exception); reduced
motion renders complete static end-states; semantic HTML with skip link;
real radio group for sessions; WCAG AA contrast; production build + strict
typecheck pass.

## Implemented (2026-08-02)
- All nine plates built and verified end-to-end with screenshots (desktop
  1920px, mobile 390px, reduced-motion emulation)
- Hero: CSS-keyframe masked line entrance (no JS dependency), sticky plate
  with GSAP scroll parallax
- Premise: SplitText line reveal + infinite GSAP marquee (xPercent -50 loop)
- Wall planner: pinned 300vh scrub — 16×3 real DOM grid assembles block by
  block (solid / outlined / stipple / hollow), zooms to WK 11 then resolves
  into a session card
- Four blocks: pinned 400vh horizontal track (xPercent -300) on desktop,
  stacked with entrance reveals on mobile; volume/intensity bar pairs invert
  across panels
- Load curve: DrawSVG scrubbed blue tonnage sawtooth + vermilion intensity
  line, crossing annotated at WK 11 · 24,100 KG · 84% 1RM
- Session: keyboard-operable real radio group (DAY 1/2/3) with GSAP
  cross-fade, three fully typeset week-11 sessions
- Sunday: SplitText headline, seven-day strip with marker stepping to SUN
  18:00 on scrub
- Evidence: four GSAP counters (41,600 / 1.9M / +18% / 71%), aria-hidden
  with real text for screen readers
- Close: £29 / £96 price blocks, non-functional CTAs, mono colophon footer
- yarn typecheck and yarn build pass; no console errors; no markers; no
  Math.random

## Polish pass (2026-08-02, second session)
- Signature on-load moment: CSS-only double plate wipe (blue, then ink with
  mono wordmark) revealing the hero; gated in no-preference media, zero JS
- Hero headline: pointer-driven 3D tilt (rotationX/Y, transformPerspective)
  via gsap.quickTo, desktop + no-preference only, alongside existing scroll
  parallax
- Magnetic CTAs on the close plate (quickTo x/y, spring back on leave)
- Scroll-progress hairline (blue, scaleX scrub) under the fixed nav
- Nav link underline reveals (transform-only CSS transition)
- Re-verified: typecheck + build pass, console clean, reduced motion renders
  hero instantly with no wipe and all static end-states intact

## Print stylesheet (2026-08-02, third session)
- PRINT THIS SESSION button on the session plate calls window.print()
- @page A4 + @media print rules hide the nav, wipe, and every section
  (including ScrollTrigger pin-spacers) except the session plate
- Print-only program card mirrors the currently selected day: wordmark,
  WK 11 · BLOCK 03 · REALISE tag, blue day label, display lift name, all
  rows against hairlines, equipment/cadence footer lines
- Verified with print-media emulation at A4 dimensions: only the card prints

## Currency localisation (2026-08-02)
- Prices converted GBP → PHP at ~£1 = ₱74, rounded to clean numbers:
  £29/month → ₱2,150, £96/cycle → ₱7,100 (close plate only place prices
  appear)

## Backlog
- P0: none — definition of done met
- P1: og-card image slot (manifest ready), plate-texture halftone overlay
- P2: per-block portrait art via block-portrait slot; session-detail scanned
  program page; print stylesheet

## Next tasks
1. Commission/generate art for the four image manifest slots if desired
2. Wire CTAs to a real checkout/signup if the program ever ships
3. Add a second cycle's dataset (PLINTH 2.0) to data.ts when written
