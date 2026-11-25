# Sketchy — Case Study

**A party drawing game where the TV is the canvas.** One Screen shows the
drawing live: a laptop on the TV, a tablet or a spare phone. The drawer draws a
secret word on their phone and everyone else types guesses on theirs. The
server times every guess and corrects for each phone's network latency, so a
slow phone on mobile data doesn't cost anyone points.

Live at [sketchy.kimnejudne.dev](https://sketchy.kimnejudne.dev). No install, no
account: scan the QR code or type a 4-letter room code.

React · Express · Socket.IO · TypeScript 6 · one Node process, rooms in memory ·
word categories in a JSON file · Claude API (admin only) · Docker

## The short version

**What it is** A game for 2–10 people in a living room. One Node process runs
Express and Socket.IO and serves the React client. Rooms live in memory. The
word categories live in one JSON file on a data volume, seeded from 581 words
in 9 English packs. Spicy is one of them, off unless the host ticks it. A
password-protected admin edits the categories, and can draft new ones with the
Claude API under a monthly spend cap. There is no database server and no
analytics.

**The hardest problem** The drawing channel. Strokes travel from the drawer's
phone, often on mobile data, through the server to the Screen and to no other
device. Every Screen has to end up with exactly the picture on the drawer's
pad, undo and clear included. That holds for a Screen that reloads mid-turn
and for one that loses a batch.

**What the scaffold missed** Sketchy wasn't scaffolded, so this row covers what
the agent's first pass got wrong. A drawer could spam Clear and grow the
server's memory without limit. The dev-only word endpoint was gated on "not
production", which fails open. A drawer whose first handshake went unanswered
had a pad that never sent anything. Reviewing agents or a scripted playtest
caught each one before commit, and each now has a test.

**How it was proven** 2,057 Vitest tests in 142 files. One is a leak audit that
plants marked words and fails if one reaches a device that may not see it.
Another runs random drawing sessions with undo and clear and requires identical
stacks on the pad, the server and three Screens. Every deploy is smoke-tested
through nginx and TLS. The gap is real phones: most of those checks are still
queued for me.

---

## Where this started, plainly

The code was written by an AI. I wrote the brief for the spec: the game, who it
is for, the fixed requirements and ten design decisions it had to settle. The
fixed requirements were that only the drawer sees the word, only the Screen
gets the drawing, and speed scoring is corrected for latency. Claude Code,
Anthropic's coding agent, questioned me on the brief and drafted `docs/spec.md`
from my answers. A party-game design review of that draft raised 20 findings. I
accepted all 20 and answered its eight open questions, and since then only I
edit the spec. Claude Code then built the game one roadmap feature per session:
85 features and one bug fix between 30 October and 3 November 2026. The model
is co-author on 94 of the 104 commits that touch `sketchy/`, and the history
says so.

Most of the build ran unattended. `scripts/autopilot.sh` starts a fresh session
for each unfinished roadmap item, retries failures and gives blocked items a
second pass. When nothing is left, it runs the checks, pushes and watches the
deploy. The sessions themselves can't push, ssh or run Docker. Up to three
separate reviewing agents checked each feature before commit: one against the
spec, one for secrets and fairness, one for phone UX. Anything with a UI also
got a scripted Playwright run. Checks only a person can do, such as real phones
on mobile data or reviewing word lists, were queued for me instead of blocking
the run.

Where the spec was silent, the agent made the call and wrote down its reason.
`docs/DECISIONS.md` has 111 of those rows. The calls that changed the game were
mine. I planned the avatars, the sketchbook redesign, the move to English only
and the admin. I applied the English-only and admin spec patches by hand, ran
the UI audit that became the one bug fix, and approved the spicy word list
before it shipped. That last gate was tested once. The autopilot's retry pass
reset the blocked spicy pack to "todo" automatically. The session that picked
it up found no sign of my approval, refused to build it and marked it blocked
again, at the cost of that run not deploying.

---

## 1. One drawing, three copies

The game reducer decides who draws and when, but it never sees a point. Ink
goes over a separate `/ink` channel. Every 50 ms the drawer's phone flushes the
new points as deltas on a 1024-unit grid. A radial filter first drops any point
closer than 3 units to the last one kept, and then a line simplification pass
runs. The pad draws every raw point locally. The test bound for the Screen's
line is 3 + 1 grid units from the pad's line, about 1.3 px on a 328 px pad.

The first pass simplified too eagerly. The Screen smooths lines with curves, so
a long simplified run rounded corners there much more than on the pad, and the
UX reviewer saw corners cut. Spans longer than 24 grid units are now split.

Each batch has a sequence number. A duplicate is ignored. A gap is dropped and
the server asks for a resend, at most once a second per gap. The drawer keeps
every batch for the turn and resends them unchanged, never renumbered, so a
repeat can only ever be a duplicate. A Screen that reloads, or sees a gap,
asks for a snapshot of the whole stack. A drawer who reloads gets their own.
While testing a drawer reload, the scripted playtest found a real bug: the send
function had been detached from its socket.

The server also bounds memory. Past 200 KB of visible drawing, new strokes are
refused but undo and clear still work. Past 400 KB for the whole stack, only
undo works. Without that ceiling, a drawer spamming Clear could add about 27,000
actions a second.

The spec targets 150 ms median and 300 ms p95 from finger to Screen on 4G, and
estimates about 20 kbit/s of upload while drawing. A `?debug=1` overlay measures
it. So far it has only been read on loopback (1 ms and 2 ms). The 4G measurement
is one of the checks queued for me.

## 2. Timing a guess fairly

A correct guess scores 300 points at the start of the turn and falls evenly to
100 at the buzzer. The drawer gets half of what the guessers scored. The server
times guesses, so a phone on slow data would lose to a fast one unless the
server corrects for latency.

The phone can't be trusted to time itself. The server sends `pong`, times how
long the phone's acknowledgement takes, and keeps the last 10 samples per
connection. A guess's one-way latency is half the median, capped at 250 ms, and
is subtracted from when the guess arrived. Guesses are still accepted for 300
ms after the buzzer, but only count if their corrected time is before it.

The spec's own worked example puts this in proportion: 100 ms is worth a
quarter of a point. What the correction really decides is order, and guesses at
the buzzer. In the example, Ana typed first but her guess arrived second. She is
listed first. Mutation checks back this up: removing the cap fails 3 tests, and
appending guesses instead of ordering them fails Ana's example. I also know one
check proves less than it looks. The 300 ms grace bound can't fail on its own,
because the 250 ms cap sits inside it. A phone that delays its acks can inflate
its own latency, and the cap is the limit on what that gains.

## 3. Keeping the word secret

Each device gets a view filtered for its role. The leak audit swaps the word
list for marked words, then plays scripted games through the reducer and over
real sockets. It fails if any marked word or alternate appears where that viewer
may not see it, in state, effects, acks or logs. Positive controls stop it
passing for the wrong reason. Eight deliberate leaks were planted, and each one
failed it. The fairness reviewer found that the log check was vacuous, because a
clean game never logs. A forced gateway failure now makes it log something to
check.

Near misses were the subtle leak. The first build fed wrong guesses to the TV as
typed, so the word plus a suffix would have put the answer on screen. A test for
that was written as an expected failure until guess matching landed. Now a
close guess goes only to that phone ("So close!") and appears on the TV at the
reveal, under "Almost:". A guess is close at an edit distance of 1, or 2 for
words of 7 letters or more. A correct guesser's phone shows "+270" without the
word, and swaps the guess box for emoji reactions so nobody can type a hint.

## 4. Budgets and the box

The player page has a 120 KB budget for gzipped JavaScript. The first real
measurement showed 134 KB, because nginx compresses at level 1 by default.
Level 6 fixed that. Replacing react-router with a router of about 100 lines took
the page from 119.1 KB to 106.7 KB. It is 117.4 KB now, with CSS and fonts at
54.4 KB against a 59 KB budget. A test builds the client and fails if either
budget is exceeded.

A memory probe plays 10 players through 30 turns, each drawer filling the
canvas. One game peaks at 228 MB with V8's default heap, or 166 MB with a 128 MB
heap. Two games at once come to 243 MB, so the container runs at 256 MB with
that heap cap. A deploy ends every live game, so the workflow waits up to 10
minutes for live connections to reach zero. If `/healthz` never answers after
the restart, it rolls back.

## 5. Two late changes

The sketchbook look (12 features) was meant to be visual only. The reviewers
still found layout bugs. Names were cut to about five letters on a TV. The host
lobby with its doodle pad needs about 750 px of height, which doesn't fit a
360 × 560 phone, so that feature failed its first review. I accepted a column
that scrolls inside a page that doesn't.

Going English only removed the second language the game launched with. That
took the player JavaScript from 118.8 KB to 116.3 KB, and a guard test now
fails if it comes back. The family packs were rewritten as 507 words. The
74-word spicy pack shipped as I approved it, with one change: a word needs at
least 3 letters once normalised, so `DJ` became `deejay`.

## 6. Categories and an admin

The last 11 features reversed two lines of the spec: no admin UI for words, and
no paid services. I wanted to add a category without a commit, and to get a
first draft of one from a title. The packs became categories in
`categories.json` on a data volume. The repo's packs seed that file once, and
after that the file is the only copy. Every write goes to a temp file, then is
flushed and renamed. A file that won't parse stops the server rather than being
replaced, because replacing it would quietly lose every edit. The Spicy toggle
went too. Spicy is now an ordinary category, off by default, and the host ticks
categories in the lobby. A game snapshots its categories at Start, so an edit
never changes a game that is already running. Once the drawer has chosen, the
word's category shows on every device. A test checks that no category shows
while the drawer is still choosing.

The admin at `/admin` has one password and no usernames. A setup code from the
server's environment sets the password on the first visit, and stays valid as
the reset key. The scrypt hash, the sessions, the cookie and the write guard
are ported from Buzzr, my game-show buzzer. The admin is a lazy chunk of 13.7
KB, and a test fails if any of it reaches the player page. Generation runs a
Sonnet 5.5 writer and then a Haiku 5.5 checker, which drops words that are hard
to draw. The pack rules run last. The result is only a draft in memory. I
review it, and a saved draft becomes a hidden category until I unhide it. Each
generation is priced into a history file, and a monthly cap (5 USD by default)
refuses a start once the month has reached it.

The reviewers found three real bugs here. A sign-in whose password check was
still running when a reset replaced the hash would have got a session that
outlived the reset. Import accepted a word twice when the editor refused it.
And an error late in a generation would have dropped the cost already spent,
which the cap counts on.

## 7. What it is not

It hasn't been proven at a real party yet. Of the 83 checks queued for me on
real phones and devices, 80 were still unticked as I wrote this. Those include
the 4G ink-delay measurement, the full playtest checklist on mobile data, and
the first generation with the real Claude API from the droplet. There are no
player accounts, and nothing about a game outlives it: only the categories,
the admin's password hash and the spend history are saved. A deploy or restart
ends every game, and two full games at once is the memory ceiling. Three known
gaps are in the backlog rather than fixed. When the server refuses a batch, the
pad can keep a stroke the server lacks. Nothing caps the total number of live
rooms on the server. And a restart in the middle of a generation loses that
generation's cost from the history.
