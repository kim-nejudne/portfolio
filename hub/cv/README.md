# The CV

`public/cv.pdf` is the **real CV** as of 2026-08-07, two A4 pages, built by
`./cv/build.sh` from `cv.html`. Run it from the hub directory:

```sh
./cv/build.sh                 # -> public/cv.pdf
./cv/build.sh /tmp/draft.pdf  # -> anywhere, for review
```

## The two files

- **`cv.html`** is the typeset document and the authority on how it looks.
- **`content.md`** is the authority on the words, and carries the reasoning:
  why the structure is what it is, what was cut and why, and which figures are
  unsourced.

They are kept in sync by hand. When they disagree, `content.md` records which
one wins for that particular thing.

## Figures that were never sourced

Eight numbers on page 1 were never reported back to Kim by the teams that had
them, and are set on the page as plain fact at his decision (2026-08-07, after
the risk was raised and reaffirmed twice). `content.md` lists all eight under
"Figures that were never sourced". That table exists so Kim knows exactly which
claims an interviewer can press on.

There was a build guard that refused to write `public/cv.pdf` while any figure
was still marked as a draft. It is gone, because its trigger is gone.

## Guards that remain

`build.sh` will refuse to produce a PDF if:

- **cv.html contains an em dash.** Kim's rule, 2026-08-07. Checked against the
  *source* rather than the PDF: chromium writes page text into a FlateDecode
  stream, so grepping the output finds nothing and the check would pass in
  silence. En dashes in date ranges are a different mark and are fine.
- **the output is not exactly two pages.** A CSS error that collapses the page
  break produces a perfectly valid one-page PDF that passes every other check.

It also deletes the destination before rendering, so the magic-bytes check
cannot pass on the *previous* PDF when chromium fails to write. That bug made a
sabotage run look like it had overwritten `public/cv.pdf` when it had not.

## History

`placeholder.html`, `build-placeholder.sh` and the `PLACEHOLDER` sentinel are
kept for reference. The placeholder existed so that everything *around* the CV
(the buttons, the download attribute, the content type, the assertions, the
deploy gate) could be built and proven before the CV itself was written, which
is the same bet the head art was built under. `deploy/deploy.sh` still refuses
to ship while `cv/PLACEHOLDER` exists; the file is deleted, so it does not.

`scripts/verify.mjs` checks the *shape* of the served file (200,
`application/pdf`, the `%PDF-` magic bytes), which held for the stub and holds
for the real one, so the suite kept working straight through the swap.
