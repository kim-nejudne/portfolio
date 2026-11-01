# Buzzr — Case Study

**A game-show buzzer that runs in the browser.** A laptop on the TV shows the
questions, every player buzzes from their own phone, and one server decides who
was first, correcting for each phone's network delay. Nobody installs anything:
players scan a QR code or type a four-letter room code.

Live at [buzzr.kimnejudne.dev](https://buzzr.kimnejudne.dev). No accounts and no
database; rooms live in the server's memory, and question sets live in the
host's browser.

React 19 · Express 5 · Socket.IO 4 · TypeScript 6 · Zod · one Docker container behind nginx

## The short version

**What it is** Three roles on three kinds of device. The Screen shows the
question and who buzzed, each Player gets one giant button, and the Host judges
Correct or Wrong from a paired phone or the Screen's keyboard. One Node process
keeps every room in memory and runs all game logic through a single pure
reducer. It was built in 107 roadmap features over four days, and ships with 60
built-in sets of 15 questions, teams, multiple choice, typed answers and a
category board.

**The hardest problem** Deciding who buzzed first when one phone is on Wi-Fi and
another is on mobile data. The server times each player's round trip itself,
takes half of it off the arrival time, caps that correction at 150 ms so nobody
gains by faking a slow line, and collects buzzes for 150 ms before naming a
winner.

**What the scaffold missed** Buzzr was not scaffolded, so this row covers what
the agent's first pass got wrong. The collection window closed whenever its
timer fired, so a late timer let late buzzes in. A player who joined
mid-question saw a live button that silently did nothing. And until an audit
listed 72 layout issues, the client had no responsive breakpoints outside two
classes on the Screen.

**How it was proven** 2,806 Vitest tests in 109 files, including gateway tests
that drive real Socket.IO clients against an injected clock and assert that no
answer reaches the Screen or a phone before the reveal. The push-to-deploy pipeline
builds the Docker image and smoke-tests it before shipping it. The spec's own checklist on real phones
is not yet recorded as done.

---

## Where this started, plainly

The code was written by an AI. I wrote the specification on 27 October 2026:
the three roles, the state machine, the fairness rules, the data model, every
realtime event, the edge cases and a manual acceptance checklist. Claude Code,
Anthropic's coding agent, then implemented it one roadmap feature per session.
Each session planned the feature, built it, ran the checks, logged what it did
in `docs/PROGRESS.md`, made one commit and stopped. From F09 on, the log records
a Playwright playtest with Screen, Host and Player tabs open together; the
later entries also record what a separate reviewing agent found and what was
fixed. Ten features, the responsive milestone F92–F101, ran through an
unattended script that started one fresh session per feature. 132 of the 134
commits that touch the project carry the model as co-author. The two that do
not are my spec edits.

My part was the spec and the calls. Only I could change the spec; the agent was
blocked from editing it. When it found a gap, it wrote the question into
`docs/DECISIONS.md` with a recommended answer and kept going on that answer
until I said otherwise. The product calls are mine: the deploy target, the
restyle, which backlog items to build and how, and how much of the audit to take
on. Later milestones began as my requests, written up as proposed spec text that
went into the spec only with my say-so. The 60 starter sets were written with Claude as well.

---

## 1. One server, one reducer

The spec fixed the shape before any code: the server is the only source of
truth, and clients render what they are sent. All game logic is one pure
function, `(room, action)` in, new room and effects out. Timers are effects too:
the reducer asks for a `windowClosed` or `reopen` action at a given time, and
the gateway runs the `setTimeout`. Each timer carries its phase, question index
and opening counter, so one that fires after the host has moved on is ignored.

The Screen is public, so it never receives a secret. The state each socket gets
is filtered by role, and a gateway test serialises every Screen and Player
payload and checks that no answer, host note or token hash appears in it.

Some things stay out of the reducer on purpose. Fifty players pinging every two
seconds would mean 25 state snapshots a second to every device if pings went
through it, so a ping updates the player's latency directly and sends nothing.

## 2. Deciding who was first

A player on slow mobile data should not always lose to one on fast Wi-Fi. The
rule from the spec: each buzz gets `adjustedTime = serverReceiveTime −
min(oneWayLatency, 150 ms)`, one-way latency is half the rolling median of the
last 10 round trips, and the lowest adjusted time wins after a 150 ms collection
window. The Screen shows the gap to second place, "+0.12 s", because a close
call feels fair when you can see it.

My spec had a hole in it. It said `ping {t}`, answered by `pong {t}`, which lets
the client time the round trip but not the server. A client-reported number
would make the server trust something it cannot check. So the server times its
own sample, from emitting `pong` to the client's acknowledgement. A client that
delays its ack gains at most the 150 ms cap, the same as any faked slow
connection. The catch, flagged in the log for the next feature: a phone that
never acks gets no samples, so its correction is silently zero. Acking became
an acceptance condition of the player screen.

The window itself was wrong at first. The first pass kept it open until the
timer fired, and noted that Node's timers run a few milliseconds late. That
meant a buzz arriving after 150 ms could still count. The fix, in F39, anchors
the window to the first buzz's monotonic arrival time and cuts on raw arrival,
not adjusted time, so latency correction cannot pull a late buzz into the
window. A buzz at exactly +150 ms counts and the next millisecond does not;
there is a test for each.

Edge cases came out of the same work. A player who joins mid-question can buzz
from the next opening, tracked by an opening counter rather than a timestamp, so
two events in the same millisecond cannot misorder. Their phone now shows a grey
"Get ready…" button instead of one that does nothing. One `canBuzz` function
answers for both the reducer and the phone's view, so they cannot drift apart.
If the host kicks the first buzzer mid-window and only late buzzes remain, the
buzzers reopen rather than crowning a late arrival.

## 3. Phones drop, servers restart

A refresh on any device returns it to the same question with the same score: a
player's id lives on their phone, the host's token in `localStorage`. The Host
can still judge a winner whose phone has gone offline. Every role pings, and two
missed acks or the browser's `offline` event start a five-second clock before
the Screen shows "Reconnecting…".

Rooms live in memory, so a restart ends every game, and the phones say "This
game has ended" rather than "Room not found". The deploy pipeline works around
that. Before restarting, it counts established connections to the container and
waits up to 10 minutes for them to reach zero, then rolls back if `/healthz`
never answers. A Screen left open on a TV holds a socket too, so the wait can
fail with no game running, and forcing it is a separate, deliberate command.

## 4. What went wrong in the build

The spec started as 34 features in seven milestones. It grew to 107 in 26, from
my backlog review, a product audit I chose to take in full, and a responsive
audit with 72 issues. The built-in sets moved three times: seeded into each
browser's own list, then a read-only library in the bundle, then a JSON file on
the server that an admin edits with draft and publish.

The test suite broke twice in ways the code did not. Set editor tests hung
because an unmounted editor flushed an autosave to IndexedDB while the next test
deleted the database; that failed a deploy. Admin tests used a fake session with
a fixed expiry of 30 October, and five of them failed once the date passed. A
third flake is still open: about one full run in a few fails a single test on
`document.title`, and the next run passes.

## 5. What it is not

It is one process with rooms in memory, so it cannot scale past one instance,
and a deploy mid-game ends that game. Question sets stay in the browser that
made them, moved between devices by JSON export. The spec's goal of a winner on
screen within 300 ms of a press has not been measured, and its manual checklist
on real devices, including a phone on mobile data, is not recorded as done. The
main JavaScript chunk is 561 kB, past Vite's 500 kB warning, and lazy loading is
in the backlog.
