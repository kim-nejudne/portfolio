# Progress

Handoff log, one entry per feature or bug. Newest first. Template:

```markdown
## F07 — Title (YYYY-MM-DD)
**What changed:** 2–4 bullets
**Decisions:** anything chosen where the spec was silent (also in DECISIONS.md)
**New dependencies:** each with a one-line reason, or none
**Notes for next session:** gotchas, half-finished edges, things to watch
**How to try it:** exact commands / URLs / which devices
```

## Kim checks

Things only Kim can do: real devices, real accounts and keys, live third-party services, and reviewing content. Unattended sessions add a line here instead of blocking. Format: `- [ ] Fnn: exact steps · what to look for`. Kim ticks them off.

- [ ] F09: open https://pinpoint.kimnejudne.dev/ on a laptop (≥ 768 px wide) and on a phone · the two cards **Join a game** and **Show a game on this screen** read as equal weight (side by side on the laptop, stacked on the phone, no sideways scroll); press **Show** on the laptop and click the overlay · the TV-style lobby fills the window letterboxed, the browser goes fullscreen (not on iPhone) and the laptop does not dim or sleep while the lobby is open
- [ ] F10: with a game showing on the laptop (https://pinpoint.kimnejudne.dev, **Show**, click the overlay), join from two real phones: phone A scans the lobby QR, phone B opens https://pinpoint.kimnejudne.dev/ and types the code · each phone reaches its lobby ("Waiting for ★ … to start", or "You're the VIP ★" for the first) in under 15 s from opening the camera or browser; on phone B the first phone's emoji is greyed out; pull-to-refresh on either phone rejoins straight to the lobby without the form; both tiles appear on the TV
- [ ] F12: with a game showing on the laptop (https://pinpoint.kimnejudne.dev, **Show**, click the overlay), join from a real phone (iPhone Safari and an Android Chrome if you have both). In the lobby, pinch and pan the practice map under the amber crosshair, try + and −, then tap **Lock in** · the map moves smoothly with no page zoom, text selection or long-press menu, the crosshair stays at the centre, the attribution "© OpenStreetMap contributors © CARTO" is readable in the bottom-right corner, the phone shows "N km from 0°, 0°" (about 0 km when aimed at the Gulf of Guinea) with **Try again** for 3 s, and that player's tile wiggles on the TV; locking in again within 2 s shows "Slow down"
- [ ] F13: with a game showing on the laptop (https://pinpoint.kimnejudne.dev, **Show**, click the overlay), join from a real phone (about 360 px wide) as the first player · the settings card sits above the practice map, readable without zooming: category cards with emoji, name and "Easy n · Medium n · Hard n", the Mode, Difficulty, Rounds and Timer rows each fit on one line with 48 px buttons, and Start ▶ is full width and enabled; tap Hard, 15 rounds and 45 s · the laptop's row under the tiles reads "<CATEGORY> · NAME · HARD · 15 ROUNDS · 45 S" at once; any greyed option still shows its label and the reason under it; close the laptop tab, press **Show** again for a new room and join it from the same phone · the new room starts with Hard, 15 rounds and 45 s. Once there are more than 8 categories, type in the search box with the keyboard up · the cards filter and the page does not jump
- [ ] F18: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones, start a 5-round World game and let each round run out (phones have no guessing UI until F19, so everyone scores at the region centre) · Intro reads "ROUND 1/5 · NOW BOARDING" (round 4 adds "×1.5 BONUS ROUND", round 5 "×2 FINAL ROUND"); Guessing shows the city in amber flaps, the timer counting down and turning red with "FINAL CALL" for the last 5 s; Reveal shows the name and fact on top, the real CARTO map on the left fitted around the pins and the amber target (not over-zoomed for a close guess), coloured lines and rail rows ticking in; the scoreboard and "FINAL STANDINGS" rows are readable from across the room at 1280 × 720 and 1920 × 1080
- [ ] F19: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones and start a 5-round Name game (a regional category, not World) · during the intro each phone shows "Round 1 of 5" over a map of the region that does not move when dragged; in guessing the city name and timer sit in the top bar, the map pans and pinches under the crosshair and stops hard a little past the region's edges; Lock in on one phone shows the "Boarding · Locked in" card with the timer, the other phone's emoji under "Still guessing" and a small map with your pin at the zoom you locked at; at the reveal each phone stays face down and flips to its result (distance, points, multiplier on rounds 4–5, total, CLOSEST/BULLSEYE when earned) only when the TV's rail reaches that player; the scoreboard adds the rank and "Next: Round N of 5"; the final shows your place and points. Join a third phone mid-game · it shows "Next departure"
- [ ] F20: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones and start a 5-round Name game. Mid-guess, close the laptop's tab · after about 3 s both phones' maps are covered by "Waiting for the Screen…", the timer stops and Lock in can't be pressed, and the ★ top bar stays visible above the cover. Reopen the Screen (**Show** with the same code, click the overlay) · the cover gives way to a big 3-2-1 on the phones, then the timer continues from where it stopped and Lock in works. (The VIP's Pause button arrives with F21; repeat then for the TV banner "Delayed · the VIP paused the game" along the bottom and the red "Delayed" gate label.)
- [ ] F21: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones and start a 5-round Name game. On the VIP's phone tap ★ in each of INTRO, GUESSING, REVEAL and SCOREBOARD · the drawer slides up from the bottom only when ★ is tapped, never by itself; it shows Pause, Skip round and End game (plus Next in REVEAL and SCOREBOARD; no Skip on the scoreboard); a tap outside it closes it. Tap Skip round once and wait 3 s · it reads "Tap again to skip" ("Tap again to void this round" in REVEAL), then goes back to "Skip round". Tap it twice · a new place appears with the same round number on the TV. Pause from the drawer · the TV shows the red "Delayed" banner. Tap End game twice · both phones and the TV go to the final; ending in round 1's intro shows "No rounds played"
- [ ] F22: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from three real phones (A first, so A is VIP, then B and C) and start a 5-round game. On phone A during guessing tap ★, then **Kick** next to C, then **Tap again to kick** · C's phone shows "You were removed from this game" with **Back to Pinpoint**, pull-to-refresh on C shows it again, C's tile leaves the TV, and if A and B had locked in the reveal starts within a second or two. Then on phone A tap ⋯ → **Leave game** · within a second B shows the amber-bordered toast "You're the VIP now ★" at the top for about 3 s, B's top bar gains the ★ button, and the ★ badge sits on B's row of the TV standings board
- [ ] F25: on the laptop open https://pinpoint.kimnejudne.dev, **Show**, click the overlay; join from two real phones (A first, the VIP, then B) and start a 5-round Name game. In round 1's guessing, pan B's map somewhere, then pull-to-refresh B · B comes back to the guessing map with the crosshair where it was and Lock in still works. Lock in on A, then refresh A · A shows the "Boarding · Locked in" card and keeps the ★. Refresh the laptop tab (click the overlay again) · the TV returns to the same round and timer, both tiles on it. In round 2 lock B's screen and leave it in a pocket for 20 s, then unlock · B reconnects to the current view; while away B's TV tile was greyed, and if B missed round 2 the reveal rail shows "—" for B and the scoreboard keeps B's row greyed with B's total. Finally restart the app on the droplet (or wait 3 h) and refresh each device · TV and both phones show "This game has ended" with a link home
- [ ] F26: on a laptop run `npm run dev`, open http://localhost:5180, **Show**, click the overlay; join from one phone on the same Wi-Fi (or a second browser window) as the VIP, then open http://localhost:5180/dev/bots/<CODE>?count=4 in another tab · the tab shows `{"code":…,"bots":["Bot 1",…,"Bot 4"]}` and four bot tiles appear on the TV; start a 5-round game · in every round the bots' tiles show LOCKED IN at scattered moments before the timer, their pins land inside the category's region at the reveal, and the game runs to the final standings with you as the only human
- [ ] F28: on the laptop run `npm run dev`, open http://localhost:5180, **Show**, click the overlay, and fill the TV view on a real TV; join from two real phones, add bots with http://localhost:5180/dev/bots/CODE?count=6, play a 5-round game to the end · on the TV the podium rises 3rd, 2nd, 1st in about 3 s, the passes fill a 4-wide grid from 5 s and the award cards follow from 8 s, one every 2.5 s, all readable from across the room and nothing under the join strip; each phone shows its own pass (colour stripe, "1st of 8", points, best round, "Avg … km") and only its own awards; refreshing the TV mid-finale replays the staging (DECISIONS 36) and still looks right
- [ ] F30: in a real terminal run `npm run admin:hash`, type a password twice (nothing echoes) · it prints one `scrypt$32768$8$1$…$…` line. Put it in the droplet's `/opt/pinpoint/.env` as `ADMIN_PASSWORD_HASH` (append as the deploy user, see the droplet memory), restart, open https://pinpoint.kimnejudne.dev/admin on a laptop · a wrong password says "That password is wrong.", the right one shows "Signed in until HH:MM" about 12 h ahead; DevTools → Application → Cookies shows `pinpoint_admin` HttpOnly, Secure, SameSite Strict, path `/api/admin`; Logout returns to the sign-in form. With the variable unset, /admin says "Admin is not configured on this server."
- [ ] F31: once F30's hash is on the droplet, sign in at https://pinpoint.kimnejudne.dev/admin on a laptop (window at least 1024 px wide) and on a phone · laptop: the header reads **Pinpoint Admin** · History · "Signed in until HH:MM" · Logout, the category list sits in a left pane with **+ Add category**, search, chips (All, Needs review, Generating, Live, Hidden) and a row per category (emoji, name, three dots, "Cities 15/15/15 · Landmarks …"), and the right pane shows the Overview tiles and "Needs review"; narrow the window under 1024 px and it becomes one pane with a ⋯ menu (History, "Logout (until HH:MM)") that closes on Escape or a tap outside. Phone: no sideways page scroll, the chip row scrolls sideways on its own, dots and counts are readable. Clicking a row opens "This page is not built yet." until F32
- [ ] F32: once F30's hash is on the droplet, sign in at https://pinpoint.kimnejudne.dev/admin on a laptop and open a category with places · the page shows "‹emoji› ‹name›", a map with an amber box and four square amber corner handles (easy to grab with a finger), every place as a dot (cities round, landmarks square, red and larger when outside the box), the South/West/North/East fields at 2 decimals and "Scale … km · Bullseye … km". Drag each corner: the two matching fields and the readout follow while dragging, and the box redraws. Type South 35, West 139, North 36, East 140: the red line "The box is too small: scale 100 km, at least 150 km" appears and Save box is greyed. Restore a real box and Save box: on a live category it says "Box saved into the draft." (the line beside the button says the box goes live on Publish) and lobbies still use the old box. Pick City, Country: "Label style saved." and it stays picked after a reload. On a phone (390 px wide): no sideways page scroll, the fields sit two by two, and the map pans with one finger
- [ ] F33: once F30's hash is on the droplet, sign in at https://pinpoint.kimnejudne.dev/admin on a laptop and open a category · the emoji button sits before the name; click it: a popover with a 6 × 4 grid and an "Other" field (typing "abc" and Save says "Type one emoji, such as 🦉."), picking 🧭 closes it and the list pane's row shows 🧭 at once. The Levels card lists Easy, Medium and Hard with "Live / Draft / Not generated", "Live: N cities · N landmarks" (and Draft counts when a draft exists), Reviewed / Not reviewed, and Review buttons. **Publish ‹name›** is greyed with its reasons listed (e.g. "Nothing to publish."); change the label style and it becomes enabled; click it · you land on /admin with the amber-bordered "‹name› is live: …" notice. **Hide from hosts** · the line under it says hidden and a phone's lobby no longer offers the category, while a game already started with it plays to the end; **Show to hosts** brings it back. **Delete** opens a field: **Delete ‹name›** stays greyed until the exact name is typed; Cancel puts focus back on Delete. Repeat on a phone (360–390 px): no sideways scroll, the emoji popover fits the screen
- [ ] F34: once F30's hash is on the droplet and a category has a draft level, sign in at https://pinpoint.kimnejudne.dev/admin on a laptop, open the category and press **Review** on a level · Cities and Landmarks tabs with counts; each card shows the name, "Shown as …" when the display name differs, country · Wikidata id (opens wikidata.org), the fact with "n/90", and a 200 px map with the amber box and a round amber pin that does not move when you scroll past it. Press **Edit** on a card: drag the pin to another spot inside the box · the Latitude/Longitude fields follow and "Moved N km from Wikidata" appears; drag it out to sea beyond the box and let go · it snaps back with "The pin must stay inside the box". Save · the card shows "Pin placed by admin". Press J and K · focus moves card to card and each scrolls clear of the footer; E opens Edit, Esc closes it; Delete shows **Confirm remove** (Cancel keeps the place). The footer stays at the bottom with **Mark ‹level› reviewed**; press it · "✓ ‹level› is reviewed." and the category page's Levels card says Reviewed. On a phone (390 px): no sideways scroll, the footer does not cover a card's buttons when scrolled to the end, the pin drags with a finger only in Edit
- [ ] F35: on your machine, run `WIKIMEDIA_CONTACT=<your email> npx tsx scripts/record-wikimedia.ts "Himeji Castle" Osaka Kyoto Sapporo "Tokyo Tower"`, then `git diff server/generate/fixtures/` · each title logs its Q-id (Q188754, Q35765, Q34600, Q37951, Q183536). The entities gain real claims and every sitelink. `sparql.json` says true for the three cities. `imageinfo.json` holds real Commons authors and licences. Then run `npx vitest run server/generate` and check it still passes; hand-made files such as `Tokyo Tower sign at entrance.jpg` stay, because recording merges. Commit the fixtures if they look right.
- [ ] F37: needs F30's hash and `WIKIMEDIA_CONTACT` (your email) in the droplet's `/opt/pinpoint/.env`, and a category with at least one level (the generator, F38–F39, makes the first). Sign in at https://pinpoint.kimnejudne.dev/admin on a laptop, open a test category → **Review** on a level → Cities tab, scroll to the bottom and press **Add by name**; type a city in the box that isn't in the category (e.g. "Kanazawa" for Japan) and **Search** · up to 7 rows appear, each with the name, Q-id, Wikidata's description and "Country · lat, lng"; pick the city, type a fact (the counter counts to 90) and press **Add ‹name›** · "Added ‹name›." shows, the Cities count goes up by one, and the new card's mini map puts the amber pin on the city inside the box. Add the same city again · "Already in the category". On the Landmarks tab pick a city instead · "Is a settlement, not a landmark". Then press **Mark ‹level› reviewed** again if the level should stay publishable
- [ ] F39: on your machine (key in the shell only, never in a file), run `PINPOINT_ANTHROPIC_API_KEY=<key> npx tsx -e "import('./server/generate/writer.ts').then(async (w) => { const a = await import('./server/generate/anthropic.ts'); const r = await w.createWriter(a.createAnthropicClient(process.env.PINPOINT_ANTHROPIC_API_KEY)).write({category:'Japan',guidance:'',level:'easy',box:null,count:4,avoid:['Tokyo'],first:true}); console.log(JSON.stringify(r, null, 1)); })"` · it prints 5 cities and 5 landmarks in Japan (no Tokyo), each with `name`, `country`, `enwiki` and a `fact` of at most 90 characters that doesn't repeat the name; a `box` around Japan, one emoji and `labelStyle` `city`; landmarks are single sites (no mountain range, lake or park); `usage.costUsd` is a few cents. A 400 error means the API refused a parameter (`betas`, `fallbacks`, `thinking` or `output_config` in `writerParams`): note the message for the next session.
- [ ] F40: on your machine (key in the shell only, never in a file), run `PINPOINT_ANTHROPIC_API_KEY=<key> npx tsx -e "import('./server/generate/checker.ts').then(async (c) => { const a = await import('./server/generate/anthropic.ts'); const p = {kind:'city',description:'',country:'United States',lat:33.66,lng:-95.56}; const items = [{id:'a',...p,name:'Paris',displayName:'Paris',wikidataId:'Q830149',description:'city in Texas',fact:'Home to a 65-foot Eiffel Tower replica topped with a red cowboy hat.'},{id:'b',kind:'landmark',name:'Tokyo Tower',displayName:'Tokyo Tower',wikidataId:'Q183536',description:'communications and observation tower in Tokyo',country:'Japan',lat:35.6586,lng:139.7454,fact:'It is the tallest structure in the world.'}]; const r = await c.createChecker(a.createAnthropicClient(process.env.PINPOINT_ANTHROPIC_API_KEY)).check(items,{level:'easy',maxSearches:10}); console.log(JSON.stringify(r, null, 1), JSON.stringify(c.judge(items, r.verdicts), null, 1)); })"` · it prints one verdict per id with a reason: Tokyo Tower is a `fix` with a true fact of at most 90 characters (or a `drop`) because the given fact is false; Paris, Texas may be `ok` or `drop` for the Easy level, with a reason. `usage.searches` is 10 or fewer and `usage.costUsd` a few cents. A 400 error means the API refused a parameter in `checkerParams` (the `web_search_20250305` tool or `strict`): note the message for the next session.
- [ ] F43: needs F30's hash, `WIKIMEDIA_CONTACT` and `PINPOINT_ANTHROPIC_API_KEY` in the droplet's `/opt/pinpoint/.env`. Sign in at https://pinpoint.kimnejudne.dev/admin on a laptop, press **Add category**, enter a small region (e.g. "Kansai", guidance "include Nara"), untick Medium and Hard, set Easy to 5 and press **Generate** · the progress shows "Generating Kansai", the running step shimmers along Write → Locate → Check → Photos (Replace only if places were dropped), the stage text changes, "Cities n/5 · Landmarks n/5" and the cost rise; open the category list mid-run · the amber "Generating Kansai" banner is at the top and its link brings the progress back; when done the page lands on Kansai's category page with an Easy draft · review its places for right pins and true facts. Then press **Regenerate** on Easy, confirm, and **Cancel** → **Stop generating** · "Cancelled at Easy." with **Try again**; on a 390 px phone the form rows and step labels fit without sideways scroll
- [ ] F44: with `GENERATE_FAKE=1 npm run dev` (or on the live site once the key is set), open a level's review on a laptop, focus a card with J and press **R**, type a note, **Replace** · the card shows "Queued · 1st" or a pulsing "Writing a new city…" with **Cancel**, then the new place under "Replaced ‹old›" with **Undo**; Undo puts the old place back. Start three replacements quickly · the second and third read "Queued · 1st/2nd" and Cancel on a queued one restores its buttons. **Add a place** on Landmarks · a queued line under the list, then a new card marked **Added**. The footer reads "N replacements left today (UTC)" and "2 replacing" while busy; at 390 px the job line, Undo and footer wrap without sideways scroll. (The fake writer knows 3 cities and 2 landmarks: remove one first or the job fails with "No place passed the checks".)
- [ ] F45: with `GENERATE_FAKE=1 npm run dev`, sign in at http://localhost:5180/admin on a laptop, generate a category, then open **History** (header link) at 1024 px and on a phone at 360 px · each job is one readable stacked entry (category, outcome, when, kind, levels, cost, saved, drops), the three spend tiles fit without sideways scroll, a Failed row's error is legible; on `/admin` at 1024 px the Running, Left today (UTC) and Spend sections sit under the counts and Spend's History link opens the page. Once the real key is set, check the spend figures roughly match the Anthropic console for that day.
- [ ] F46: needs `WIKIMEDIA_CONTACT` and `PINPOINT_ANTHROPIC_API_KEY` in the droplet's `/opt/pinpoint/.env` (F43's check). Generate a small category with landmarks (Easy 5) at https://pinpoint.kimnejudne.dev/admin/generate, then on the droplet run `ls -la /opt/pinpoint/data/photos/` and `exiftool /opt/pinpoint/data/photos/*.webp | grep -iE 'gps|xmp|iptc|icc|artist'` · every landmark has `<id>.webp` (≤ 1280 px) and `<id>-thumb.webp` (≤ 480 px), the ids look random, exiftool prints nothing for that grep, the service log shows no sharp load error, and the level's landmark cards (F51 shows the photos) carry an author and a CC0/PD/CC BY/CC BY-SA licence
- [ ] F47: needs `WIKIMEDIA_CONTACT` and `PINPOINT_ANTHROPIC_API_KEY` in the droplet's `/opt/pinpoint/.env` (F43's check). At https://pinpoint.kimnejudne.dev/admin/generate generate a landmark-heavy category whose Commons photos often show signs (e.g. "London stations", Easy 5) · the job finishes (no 400 from the API, which would mean the image block or `submit_sign_check` was refused), and **History** shows the job with any "Every photo names the place" drops by reason; the cost is a few cents more than the same size job before F47. Open the level's landmark cards (photos show from F51) · none of the stored photos has a readable sign, plaque or caption naming the place.
- [ ] F48: needs a published category with landmarks (after F46/F47's checks). At https://pinpoint.kimnejudne.dev start a Picture game with a laptop as the Screen and a phone as a player, and open DevTools → Network on the laptop · during GUESSING the only photo requests are `/api/photos/<22 random characters>` (and `/thumb` on the phone), answering `image/webp` with `Cache-Control: private, max-age=600` and no ETag or Last-Modified; no request, URL or socket frame carries the place's name, coordinates or a `File:` name; the next round's token is different; after the game, pasting an old photo URL into a new tab gives 404 once a new game has started
- [ ] F49: needs a published category with landmarks (after F46/F47's checks). At https://pinpoint.kimnejudne.dev on the laptop as the Screen at 1920 × 1080 (and once at 1280 × 720), join from a real iPhone and an Android phone, and as VIP pick Picture · the category cards switch to landmark counts; start · the TV shows the photo uncropped in a thin-framed 1500 × 820 box with "Photo: … · licence" under it, "ROUND 1/5" / "BOARDING" at the top left and the timer at the top right beside the photo, and the small player tiles in one row underneath, nothing cut off at the bottom. On each phone the 72 × 48 thumbnail sits in the top bar; tap it · the photo fills the screen fitted whole, pinches in (up to about 8×) and pans without leaving the photo, with the credit and Close underneath; Close returns to the map. At the reveal the TV band shows a 240 px thumbnail beside the name, the fact and "Photo: …, licence, via Wikimedia Commons". Then on the droplet, mid-round, move away that round's two files in `/opt/pinpoint/data/photos/` (`<id>.webp`, `<id>-thumb.webp`; find the id in the category) and start the next round on the same landmark, or refresh the Screen and phone mid-round · the TV shows "PHOTO UNAVAILABLE" in flaps inside the frame, the phones show "Photo unavailable" in the top bar, and the VIP's ★ drawer reads "Skip round (photo missing)"; put the files back afterwards

<!-- entries below, newest first -->
## F49 — Picture mode on the Screen and phones (2026-11-08)
**What changed:**
- Screen guessing (`client/src/components/ScreenGame.tsx`): in Picture mode the photo is contained (`object-contain`) in a 1500 × 820 frame with a 2 px `--line` border, and the 22 px guessing credit is a `figcaption` under it. To fit 1080, the gate label (28 px, one line per part) and the 120 px timer sit in the 210 px margins beside the photo. The tiles use `PlayerTile`'s new `compact` form (56 px square, 22 px text). Name mode is unchanged.
- Screen reveal: once the name lands, the band shows the 240 px thumbnail (the round's `/thumb`, ≤ 180 px tall) beside the name flaps, the fact and the full credit.
- Phone (`client/src/components/PlayGame.tsx`): the prompt bar's 72 × 48 thumbnail is an "Open the photo" button. It opens a full-screen dialog in which Leaflet on `CRS.Simple` (no tiles) gives pinch zoom and pan. The photo opens fitted whole, zooms to 8× and stays inside its own edges. The credit and a 48 px Close sit underneath, Escape also closes, and focus returns to the thumbnail. `minZoom: -5` is needed because without tile layers Leaflet's floor is 1:1. Listeners are detached before `map.remove()`, so a late `load` can't fit a removed map.
- "Photo unavailable": `client/src/components/Photo.tsx` swaps in a fallback when the image errors. On the Screen it is "PHOTO UNAVAILABLE" in prompt flaps inside the frame, and a bordered text card in the reveal slot. On the phone it is board-face text in the prompt bar and in the viewer.
- VIP drawer: `client/src/lib/useImageFailed.ts` probes the round's thumbnail with an `Image` on the VIP's phone only, and `VipDrawer`'s Skip round then reads "Skip round (photo missing)". The two-tap confirm is unchanged.
- Lobby: Picture mode and its landmark counts already existed (F13), and a test now pins them.

**Decisions:** DECISIONS 57.

**New dependencies:** none (the viewer reuses Leaflet).

**Tests:** `npx vitest run client/src/pages/Screen.test.tsx client/src/pages/Play.test.tsx client/src/components/VipLobby.test.tsx`
- Screen.test.tsx (3 new): the Picture prompt (photo src, `object-contain`, the 1500 × 820 frame and its border, the credit in the figcaption, the gate label, the timer, the compact tiles). A failed photo shows the flap card, and the next round's photo is tried afresh. In REVEAL the thumbnail is `/thumb` in the 240 px slot with the full credit, and Name mode has neither.
- Play.test.tsx (3 new): the 72 × 48 thumbnail button; the viewer dialog (`CRS.Simple`, touch zoom on, `minZoom < 0`, the full photo as the overlay, the credit), with Close returning focus and Escape closing. A failed thumbnail shows the card, as does a failed full photo in the viewer. The VIP's Skip round reads "Skip round (photo missing)" once the stubbed `Image` errors, and still takes two taps.
- VipLobby.test.tsx (1 new): Picture is offered, and the card's counts switch from cities (20/21/22) to landmarks (6/7/8).
- Mutation checks: with the drawer label hard-wired off, or the frame at 700 px, the matching test fails.

**Reviews:**
- spec-checker: FAIL on paperwork only (this entry and the Kim check), now fixed. I also applied its import-order note.
- secrecy: PASS. Alt texts before REVEAL are generic, and only the server's token URLs are used.
- ui: PASS WITH FIXES. Applied: the gate label margin is now `pl-4`, so "ROUND 10/15" fits on one line; focus returns to the thumbnail; the phone card text is 20 px; the reveal fallback has a border. Not applied, now in the Backlog: a focus trap in the viewer, `zoomAnimation: false` under reduced motion, and two-line compact names (no room in 1080). Escape closing both the viewer and the drawer can't happen, because the viewer covers the ★ button.
- Playtest (`.playtest/F49/scenario.ts`, Screen 1920 × 1080, 360 × 640 and Pixel 7 phones, `DATA_DIR` empty, so the World (dev) fixture): all five steps pass. The Screen frame measured 1500 × 820 with a 2 px border. The thumbnail measured 72 × 48, and the viewer fits the photo (412 × 309 on a 412 px screen). With Ana's photos blocked, she saw "Photo unavailable" and "Skip round (photo missing)", and Ben saw neither. The reveal thumbnail measured 240 × 180. The playtest found two bugs, both fixed: the viewer opened at 1:1 (the `minZoom` fix) and threw a Leaflet error after Close (the detach fix).

**Notes for next session:**
- F50's `/credits/:code` can reuse `Photo.tsx` for its thumbnails with a fallback.
- The Screen's Picture layout has about 18 px of vertical slack at 1080. Anything added there (the F53 flap animation on the gate label, for example) must keep the 28 px lines.

**How to try it:** `npm run dev`, open http://localhost:5180 on a laptop (**Show**) and join from a phone or a second window at `/play/<code>`. As VIP, pick World (dev) and Picture: the counts read 15 landmarks per level. Start, and the TV shows the framed photo with its credit. Tap the phone's thumbnail to open, pinch and close it. To see the missing-photo path, block `/api/photos/*` in the phone's DevTools (Network → Block request URL) and refresh: the card appears, and the VIP's ★ drawer shows "Skip round (photo missing)".


## F48 — Picture rounds: tokens and photo serving (2026-11-08)
**What changed:**
- Tokens: `Room.tokenKey` (32 random bytes, made by `createRoom`, never in a view). In Picture mode `openRound` derives a fresh 22-character token, HMAC-SHA256(tokenKey, `game:draws`) in base64url, and records it in `game.photoTokens` as `{photoId, revealed: false}`. Entering REVEAL marks it revealed, so `archiveGame` keeps that photo for `/credits`. The reducer stays pure.
- `shared/credits.ts` (new): `guessingCredit` shows "Photo: ‹author› · ‹licence›" unless the author contains a word of 4+ letters from the name, display name or country. The comparison ignores case and accents. `server/views.ts` uses it in place of F17's always-hidden author.
- `server/http.ts`: `GET /api/photos/:token` and `/thumb` allow 120 per IP per minute (429 past that). A token resolves through `RoomStore.photoIdForToken`, which reads only live rooms' current games and uses `Object.hasOwn`. Responses are `image/webp` with `Cache-Control: private, max-age=600` and no ETag, Last-Modified or Content-Disposition. A missing file is a JSON 404 with no cache header. Request logs print `/api/photos/[token]`. `server/photos.ts` `sendPhoto` reads the file whole and calls `res.end`, because Express's `sendFile` forces an ETag.
- `server/admin.ts`: `GET /api/admin/photos/:photoId` and `/thumb` (`idSchema`, `no-store`).
- `server/sockets.ts` takes `photoDir` (`server/index.ts` passes it). For a Picture-mode Start, Rematch tap and rematch countdown, `liveCategory` uses `withPhotosOnDisk` to leave out landmarks without both files. The enough-places check therefore counts only playable ones.

**Decisions:** DECISIONS 56. A skipped round's token keeps serving until the game ends; F20's note suggested dropping it, but that photo was already on screen and nothing more is learned from it.

**New dependencies:** none.

**Tests:** `npx vitest run shared/credits.test.ts server/views.test.ts server/http.test.ts server/http.admin.test.ts server/sockets.test.ts`
- credits.test.ts (4): an author shown; hidden by a name, display-name or country word, including after a hyphen and inside a longer word; accents and case on both sides; only words of 4+ letters count.
- views.test.ts (2 new, 1 fixture change): the token is 22 characters of `[\w-]`, has no photo id in it, is recorded unrevealed, is fresh after a skip, and is marked revealed at REVEAL. Back to lobby archives only the revealed photo id. Another room gives another token, and Name mode has none. A non-matching author shows in the guessing credit. The leak fixture's author now shares "Nowhere" with the name, so the existing `Jane Doe` ban still proves the rule hides it. `photoTokens` and `tokenKey` are banned from every view.
- http.test.ts (4): photo and thumb bytes with the exact headers for two rooms. 404 for an unknown token, a photo id, `constructor`, `__proto__`, a closed room's token, a token from the last game and a missing file (no Cache-Control). 120 requests a minute, then 429, then served again. The log line shows `[token]`.
- http.admin.test.ts (2): an admin gets the photo and thumb (`no-store`, no ETag); 401 signed out; 404 for a missing or traversal id; 404 with no admin password.
- sockets.test.ts (1): with 5 of 15 easy landmarks fully on disk (one more has only its full photo), Start's pool has exactly those 5 and the store keeps all of them. With one file removed, Start is refused "World (dev) · Easy has 4 landmarks; this game needs 5."

**Reviews:** spec-checker: FAIL on paperwork only (this entry and the Kim check), now fixed. I applied its two should-fixes: Cache-Control only accompanies the photo bytes, and a test that the archive keeps only revealed photo ids. secrecy: PASS WITH FIXES. I applied the token redaction in logs and the 404 cache header; its "another room" note is recorded in DECISIONS 56. game-rules: PASS WITH FIXES. I applied three fixes: a landmark with no `photo` is dropped even with no photo folder, a `shortcut:` comment marks the all-rooms scan, and the SPEC-QUESTION comment now sits at the code site. Its question about the 120/min figure is answered: it is the spec's. No client code changed, so there was no ui review or browser playtest; F49 makes Picture rounds visible.

**Notes for next session:**
- F49 draws the Picture prompt: the photo frame, the credit line, the phone thumbnail (`thumbUrl`) and the "Photo unavailable" card. A missing file mid-game answers a JSON 404, so an `<img>` `onError` is the signal. Skip round's "(photo missing)" label is also F49's. The server does not track missing files mid-game; the client would have to report it, or the VIP view could check.
- F50's `/credits/:code` reads `previousGames[].revealedPhotoIds` and the current game's revealed `photoTokens`. The photo ids map to the archived places only through the categories. Its thumbnails need a route: either `/api/admin/photos` (admin only, so no) or a credits-scoped one. Decide there.

**How to try it:** `npm run dev`, open http://localhost:5180 on a laptop as the Screen and a phone (or a second window at `/play/<code>`). As VIP, pick World (dev), Picture, Easy, 5 rounds, and Start. The Screen still reads "Picture round" (F49 draws it), but `curl -i http://localhost:5180/api/photos/<token>` with the token from the phone's state (DevTools → WS frame `thumbUrl`) returns the WebP with the headers above.

## F47 — Sign check (2026-11-08)
**What changed:**
- `server/photos.ts`: `fetchPhoto(candidates, client, dir, signal, signCheck?)` runs the sign check on each candidate's in-memory 480 px thumbnail after it downloads and decodes, before anything is written; a flagged candidate is skipped for the next one and kept in `photoCandidates` for Swap photo. It now answers `{drop}` instead of null: "Every photo names the place" (`DROP.allFlagged`) when a candidate was flagged and none accepted, else "No usable photo".
- `server/generate/pipeline.ts`: `LevelDeps.generator` needs `signChecker`; the Photos stage passes each check the Commons file, the WebP thumb, the place's name and country, and adds every call's usage to the level's cost.
- `server/generate/checker.ts`: `createSignChecker(client)`: Haiku 5.5 vision, no web search, the thumb as a base64 `image/webp` block, name and country as data, a strict `submit_sign_check` tool `{namesPlace, reason}`. A refusal or a missing or malformed answer flags the photo. `server/index.ts` uses it in place of F42's rejecting stub.
- `server/admin.ts`: Add by name runs no sign check (the spec says no LLM) and reads the new drop shape.

**Decisions:** DECISIONS 55.

**New dependencies:** none.

**Tests:** `npx vitest run server/photos.test.ts server/generate/generator.test.ts server/generate/checker.test.ts`
- generator.test.ts (3 new): a flagged first candidate is skipped for the second, which is stored, with the flagged one kept as a candidate and both checks priced (writer + checker + 2 checks = $0.04); a landmark with every photo flagged is dropped "Every photo names the place", topped up, and only the replacement's photo is on disk ($0.07); a failing sign check's spend joins the level's. All 20 existing call sites now pass the fake sign checker. Checked to fail with the check removed from the pipeline.
- photos.test.ts (2 new, 2 updated): the check sees the 480 px thumb, skips the flagged candidate and keeps it, drops the failed one; every candidate flagged → `{drop: 'Every photo names the place'}` and nothing written. The null cases now expect `{drop: 'No usable photo'}`.
- checker.test.ts (3 new): the request (Haiku 5.5, one strict tool, no web search, the image block, the name escaped as data, the abort signal); flagged on `namesPlace`, a refusal, no answer or a malformed one; priced by Haiku's rates, an API error a plain GenerationError.

**Reviews:** spec-checker FAIL on paperwork only (this entry, DECISIONS 55, the Kim check), all fixed. secrecy: PASS. Not applied: returning a reason key from `fetchPhoto` instead of importing `DROP` from `resolver.ts` (no cycle exists; resolver.ts owns the drop texts); its note that Add by name photos are unchecked is recorded in DECISIONS 55. No UI or game-rule code changed, so no ui or game-rules review, and no browser playtest.

**Notes for next session:**
- F48 serves photos by token; nothing here changes the stored files.
- F51's Swap photo should call the same `SignChecker` on pick (it needs the generator, which is off without a key: show the photo unchecked or refuse, and decide) and badge flagged candidates; `photoCandidates` already includes the ones generation flagged.

**How to try it:** `GENERATE_FAKE=1 npm run dev`, sign in at http://localhost:5180/admin, generate "Kansai" with Easy 5: Tokyo Tower keeps its first photo; its "sign at entrance" candidate is flagged only when reached, so to see a skip, run `npx vitest run server/generate/generator.test.ts -t "sign check"`.

## F46 — Commons photos and metadata stripping (2026-11-08)
**What changed:**
- `server/photos.ts` (new): `encodePhoto` re-encodes with `sharp` (`concurrency(1)`) to WebP q80 (≤ 1280 px) and a q75 thumbnail (≤ 480 px), never enlarged, orientation applied, every byte of metadata dropped; `writePhoto` stores `DATA_DIR/photos/<id>.webp` and `<id>-thumb.webp` under a random 20-character id; `fetchPhoto` stores the first candidate that downloads and decodes (one bad file skips to the next, a Commons outage fails the level) and keeps the later candidates' metadata for Swap photo; `commonsPageUrl`; `writeDevPhotos`.
- `server/generate/resolver.ts`: `photoCandidates(qid)`: P18 (by rank), the depicts search, the P373 category, deduplicated, ≤ 6, one `imageinfo` call; usable = CC0/PD/CC BY/CC BY-SA (`freeLicence`), longer side ≥ 800 px, an upload.wikimedia.org thumbnail; `plainAuthor` strips HTML (≤ 120). Drop "No usable photo". `normalizeTitle` moved to `wikimedia.ts`.
- `server/generate/pipeline.ts`: the Photos stage after Check, for as many landmarks as the level still needs; `LevelDeps.photoDir`; `photos` joins `LevelStage` and `JobStage` (the client already had its step). `pipelineLevel(generator, wikimedia, photoDir)`.
- Add by name (`server/admin.ts`) photographs a landmark too: 422 "No usable photo"; `createApp({photoDir})`, 502 without one.
- `server/fixtures/dev-world.json`: 15 landmarks per level with CC0 placeholder photos; `server/index.ts` renders the missing ones at a development start ("Photos: rendered 45 dev placeholder photo(s)").

**Decisions:** DECISIONS 54.

**New dependencies:** `sharp` ^0.34.5 (server): the spec's image library; re-encodes Commons photos to WebP and strips all metadata, which nothing installed can do.

**Tests:** `npx vitest run server/photos.test.ts server/generate/resolver.test.ts server/generate/generator.test.ts server/http.admin.test.ts server/categoryStore.test.ts server/http.test.ts`
- photos.test.ts (8): a JPEG with GPS EXIF, XMP, IPTC (an APP13 segment) and a P3 ICC profile comes out with none of them in either file (metadata and raw markers); 1280/480 sizes, tall, no enlargement; orientation; non-image refused; `fetchPhoto` skips a 404 and a non-image, stores the third, keeps the fourth, random id; null when nothing works, throws on an outage; `commonsPageUrl`; dev placeholders rendered once. Checked to fail with `keepMetadata()`.
- resolver.test.ts (7 new): the fixtures' order (Himeji: P18, the winter photo; the GFDL map refused), P18 by rank then search then category, deduplicated, capped at 6; licence allow-list (12 names) and the missing-URL rule; the 800 px floor on the longer side; author HTML, entities and the 120 cap.
- generator.test.ts (2 new): stored photo, credit and files for each kept landmark, and no download for one that would be trimmed; a GFDL-only landmark dropped "No usable photo" and topped up. The stage list now includes `photos`; the test world's sites have photos.
- http.admin.test.ts (2 new): Add by name stores Himeji's photo with the winter candidate kept; 422 with no usable photo, 502 with no photo folder. categoryStore.test.ts and http.test.ts: the fixture's 15 landmarks per level (random photo ids) and its counts.

**Reviews:** spec-checker FAIL on paperwork only (this entry, DECISIONS 54, the Kim check), all fixed. secrecy: PASS; applied its hardening Should-fix (decoding capped at 50 MP). Not applied: a comment against `withMetadata` (the strip test fails if it is added). No UI or game-rule code changed, so no ui or game-rules review.
- Live check (`GENERATE_FAKE=1`, a temp `DATA_DIR`, server only): the start rendered 45 placeholder photos; generating "Kansai" stored Himeji Castle (Bernard Gagnon, CC BY-SA 3.0, the winter photo kept) and Tokyo Tower (CC0, 853 × 1280, two kept) as WebP; a restart with the real `categories.json` deleted the 90 dev files and kept the 4. No UI changed, so no browser playtest.

**Notes for next session:**
- F47 slots the sign check into `fetchPhoto` between `encodePhoto` and `writePhoto` (it has the 480 px thumb in memory); the fake flags `sign` file names, and Tokyo Tower's second candidate is one.
- F48 serves `photosDir(dataDir)` files by token. Picture mode in development now has 45 photographed landmarks to play.
- sharp prints Fontconfig warnings on this Arch machine when it renders SVG placeholders (system config newer than sharp's bundled fontconfig); harmless.

**How to try it:** `GENERATE_FAKE=1 npm run dev`, sign in at http://localhost:5180/admin, generate "Kansai" with Easy 5, then `ls .data/photos` (or your `DATA_DIR`): two landmarks' `.webp` and `-thumb.webp` files; `exiftool` on them shows no GPS, XMP or IPTC.

## F45 — History page and dashboard spend (2026-11-08)
**What changed:**
- Server: `GET /api/admin/history?limit=` (`historyQuerySchema`, 0–500, default 500; 0 answers the totals alone) reads `DATA_DIR/generation-history.jsonl` through F41's `GenerationHistory` and answers `{entries, totals}`: the newest ended jobs first and spend today, over 30 days and in all (UTC days, by when each job ended). `createApp` takes `history` (`noHistory` when absent); `server/index.ts` passes the real one.
- `client/src/lib/adminHistory.ts` (new): `loadHistory(limit?)` and the row texts (kind, outcome, levels, "Cities 15 · Landmarks 12", "Not on Wikidata ×3", when, "The newest 500 of N jobs.").
- `client/src/pages/AdminHistory.tsx` (new), `/admin/history`: the spend tiles, then every ended generation, replacement and addition newest first as a stacked entry (category linked while it exists, outcome, when · kind · levels · cost, saved per mode, drops by reason or "Nothing dropped", a failure's error); loading, empty, and error with Retry.
- `AdminCategories.tsx`: the overview (from 1024 px) adds **Running** (the running job linked to its progress or its level, and how many wait), **Left today (UTC)** (levels and replacements, or why generation is off) from the frame's jobs poll, and **Spend** (`limit=0`, re-read on each page move, Retry, a History link). `SpendTiles` is shared with the history page.
- `Admin.tsx`: the history route replaces the placeholder; an unknown admin URL says "There is no admin page at this address."

**Decisions:** DECISIONS 53.

**New dependencies:** none.

**Tests:** `npx vitest run client/src/pages/AdminHistory.test.tsx client/src/pages/Admin.test.tsx server/http.admin.test.ts`
- AdminHistory.test.tsx (5): spend tiles; three rows newest first with kind, levels, cost ("under $0.01"), saved, drops by reason, outcome, a failure's error, a link only for a category that still exists; empty; error then Retry; the text helpers.
- Admin.test.tsx (2 new): a running replacement linked to its level with "1 waiting", Left today 17/96, Spend tiles and the History link; nothing running, generation off with the reason, a spend load error with Retry. The counts test now reads the `Counts` tiles by label.
- http.admin.test.ts (3 new): newest first with totals today/30 days/all time over an in-memory log; `limit` 1 and 0, 400 for 501, -1, x, 1.5; empty with no log, 401 without a session.

**Reviews:** spec-checker FAIL on paperwork only (this entry, the Kim check). secrecy: PASS. ui: PASS WITH FIXES; applied tabular figures on the row's cost and saved line and the missing blank line. Not applied: a stable row key (history entries have no id; the list is only replaced whole), reserving space for Running/Limits before the first jobs read, merging the two footnotes.
- Playtest (`GENERATE_FAKE=1`): generate with a failing level, `/admin/history` at 1280 and 360 px (no sideways scroll, newest first), and the overview's three sections at 1280 and 1024 px all pass.

**Notes for next session:**
- F46 adds the Photos step; its drops (no usable photo) will show in History by reason with no change here.
- The overview's Running section only refreshes as fast as the frame's jobs poll (every 2 s while a generation runs, else on page moves).

**How to try it:** `GENERATE_FAKE=1 npm run dev`, sign in at http://localhost:5180/admin on a laptop, generate "Kansai", then open **History** in the header; back on `/admin` the overview shows Running, Left today and Spend.


## F44 — Replace and Add a place (2026-11-08)
**What changed:**
- Server (`server/admin.ts`), on F42's runner: `POST /api/admin/categories/:id/levels/:level/places/:placeId/replace` (`{note?}`) and `POST …/levels/:level/places/add` (`{kind, note?}`) start one-place jobs in the replacement queue (→ `{jobId}`, refusals as the runner's 404/409/429/503/507). `POST /api/admin/jobs/:jobId/undo` puts a finished replacement's old place back under its id (409 otherwise).
- `NOTE_MAX` is now 200 (the spec's Level review), for Replace's and Add's note.
- `client/src/lib/levelJobs.ts` (new), ported from Buzzr's: the jobs the level page follows (started here or seen queued/running in a poll), each card's state (queued with position, running, replaced with Undo, failed, added), the add lines per tab, `ordinal`, and the footer's "2 replacing · 1 adding".
- `adminJobs.ts`: `startReplace`, `startAdd`, `undoReplace`, and `loadJobs(categoryId?)`.
- `AdminLevel.tsx`: per card **Replace** (key **R**) opens a note form (≤ 200, with a counter); while queued or running the card shows "Queued · 2nd" or a pulsing "Writing a new city…" with **Cancel** ("Cancelling…" until it stops), and Edit/Replace/Remove wait. A finished one swaps in with "Replaced ‹old› · Undo"; a failed one says why. **Add a place** per tab (note form, queued/running lines with Cancel, failures), and the new card is marked **Added**. Footer: "N replacements left today (UTC)" (or why it is off), the progress line, and "Can't reach the server" after 3 missed polls. The page polls `GET /jobs?categoryId=` on open and every 2 s while one of its jobs is queued or running, and re-reads the category when one ends done. It is keyed by the level, so leaving it forgets the jobs and every Undo. "Moved from Wikidata" origins are keyed by place id and Q-id, so a replacement under the old id isn't measured from the old pin.
- `adminLevel.ts`: `R` → `replace` in the review keys.

**Decisions:** DECISIONS 52.

**New dependencies:** none.

**Tests:** `npx vitest run client/src/pages/AdminLevel.test.tsx server/http.admin.test.ts`
- AdminLevel.test.tsx (5 new, a stub job server and fake intervals): two replacements with the note → "Queued · 1st/2nd", "2 replacing", 98 left, Edit locked; running; done → the new place in with "Replaced Kyoto", no false "Moved" warning; Undo → the old place back. Cancel a queued one; a failed one on its card. Add a landmark with a note → queued under the list → card marked Added. R opens Replace on the focused card; "Daily limit reached" and off with the reason. `follow` ignores jobs that ended unseen; `ordinal`. The key-map test now expects R → replace (it asserted no action before F44).
- http.admin.test.ts (4 new): replace under the old id with a note, Undo restores it exactly and only once (409), add appends, undo of an add 409 / unknown 404; Undo 404 once the new place was removed; 429 over the replacement limit; 404 unknown place or level, 400 for a 201-character note or unknown kind; 401 on the new routes.
- The runner's replace/add queue, positions and cancel were already covered by F42's jobs.test.ts.

**Reviews:** spec-checker FAIL on paperwork only (this entry, DECISIONS 52, the Kim check); its Should-fix (an HTTP 429 test) was applied. secrecy: PASS; its Should-fixes applied: Undo is once only on the server (a repeat is 409, so it can't overwrite later edits), and a test that Undo answers 404 once the new place was removed. ui: PASS WITH FIXES. Applied: focus goes to the card after Replace (the button is then disabled); Replace's accessible name always names the place, with "(daily limit reached)" or "(off)"; the off reason sits by Add a place too; `scroll-mb-56` for the taller footer; the footer's job line keeps its height before the first read. Not applied: clearing a stale cancel error and dismissing failure alerts (both clear on leaving the level).
- Playtest (`GENERATE_FAKE=1`): Replace with a note (capped at 200), Replaced · Undo, R opening the form and Esc closing it, Add a place and the footer count all pass. "Queued · 2nd" and Cancel were too quick to catch live on the fake (the page tests cover them).

**Notes for next session:**
- F46 adds the Photos step: replace and add go through the same `generateLevel`, so they get it with no change here.
- The admin frame's `useAdminJobs` still polls only while a generation runs; the level page polls its own jobs.

**How to try it:** `GENERATE_FAKE=1 npm run dev`, sign in at http://localhost:5180/admin, generate "Kansai" (Easy 5), open Easy, **Remove** Sapporo (the fake writer only knows five places), then **Replace** Osaka with a note: it becomes Sapporo with "Replaced Osaka · Undo". **Add a place** works the same way once a place is free.

## F43 — Generate page (2026-11-08)
**What changed:**
- `client/src/pages/AdminGenerate.tsx` (new), `/admin/generate`, ported from Buzzr's `AdminGenerate`:
  - The form: name (1–40), optional guidance (≤ 500), Easy/Medium/Hard ticked at 15 places per mode each (5–30). "N levels left today (UTC)". When generation is off, the server's reason is shown and the form is disabled.
  - Progress at `?job=<id>`, polled every second: "Generating ‹name›" (or "Regenerating ‹name› · Hard"), the stage text with "Easy, level 1 of 2", and per level a checklist line (✓ ● ○ ✕, state, "Cities 8/15 · Landmarks 10/15") with a stepped bar (Write, Locate, Check, Photos, and Replace while drops are replaced; the running step shimmers). Also the cost so far, and **Cancel** → **Stop generating**. Opening `/admin/generate` while a generation runs follows it.
  - Done replaces the entry with the category page (a regenerate: the level's review). Failure or cancel shows "Medium failed: ‹why›" or "Cancelled at Easy.", **Review what was saved** (when a level saved) and **Try the rest again**, or **Try again** when nothing saved. After 3 missed polls it says it can't reach the server and keeps trying.
- `client/src/lib/adminJobs.ts` (new): the job fetches, the pure rules (steps, stage text, stop text, unsaved levels, done route, cost, Regenerate's count, why generation is blocked) and `useAdminJobs` (the frame reads `/api/admin/jobs` on each page move and every 2 s while a generation runs, and tells the list to re-read when a job saves a level or ends).
- `Admin.tsx`: the route and the "Generating ‹name›" banner linking to the progress. List badges **Generating** and **Failed** (the newest ended generation failed), with the Generating chip now counting (`adminCategories.ts`).
- `AdminCategory.tsx`: **Regenerate** (confirmed) and **Generate** (missing level) per level. They are disabled with the reason when blocked, and following the job. "Saved short: 12 of 15 landmarks" under a short draft (F41's `shortText`).
- Server: `POST /api/admin/categories/:id/generate` (`generateMoreBodySchema`, the generate body without `name`) runs a generate job into an existing category, for "Try the rest again" after a level saved. `GenerationJob.guidance` is new.
- `index.css`: `.step-shimmer` (still under reduced motion).

**Decisions:** DECISIONS 51.

**New dependencies:** none.

**Tests:** `npx vitest run client/src/pages/AdminGenerate.test.tsx client/src/pages/AdminCategory.test.tsx client/src/pages/Admin.test.tsx server/generate/jobs.test.ts server/http.admin.test.ts`
- AdminGenerate.test.tsx (17, fake timers and a stubbed fetch):
  - form validation; a start with the levels ticked and their counts; a server refusal; off with the reason;
  - resume of a running generation; polling every second through stage, steps (Replace joining), places kept and cost, then the category page; a regenerate to its level; unreachable after 3 misses; a forgotten job;
  - failure with Review what was saved and Try the rest again (`/categories/japan/generate`); Try again by name; a failed regenerate retried; cancel after a confirm;
  - units for steps, stop text, unsaved levels, Regenerate's count, and the Generating/Failed badges and chip.
- AdminCategory.test.tsx: Generate a missing level (15) and follow; Regenerate only after a confirm at its size within 5–30; both disabled with the reason when off; the shortfall line. The level-row text assertion now includes the new buttons.
- Admin.test.tsx: the banner and the Generating badge and chip. The Retry test's catch-all stub now answers `/api/admin/jobs` with a jobs list, since the frame reads it.
- jobs.test.ts and http.admin.test.ts: generate into an existing category (avoid list, guidance on the job, 404, 400).

**Reviews:** spec-checker FAIL on paperwork only (this entry, the Kim check, DECISIONS 51); its Should-fix on F41's `shortText` was applied. secrecy: PASS. ui: PASS WITH FIXES. Applied: the Generating badge no longer pulses its text (contrast); step labels at 16 px, truncating; `aria-valuetext` names the running step; level rows wrap at 360 px; no flash of the finished view before Done navigates; a typed segment map. Not applied: reserving the "levels left" line's space when generation is off (the off state doesn't change while the page is open).
- Playtest (`GENERATE_FAKE=1`): the form, its validation, done → category page, and a real fake failure at Medium with both actions all pass. The live progress and banner were checked on a mocked running job, because the fake finishes in milliseconds.

**Notes for next session:**
- F44 adds the replace and add routes and their queue UI. `useAdminJobs` only polls while a *generation* runs; widen `runningGeneration`/the poll condition if the level page needs queued replacements to refresh the frame.
- F45's overview can read `useAdminJobs` data (running job, `levelsLeft`, `replacementsLeft`) from the frame: pass it to `AdminOverview` as `AdminCategories` gets it.
- F46 adds `'photos'` to `JobStage`. The client already has its step and its text ("Fetching photos").

**How to try it:** `GENERATE_FAKE=1 npm run dev`, sign in at http://localhost:5180/admin (F30's hash in your shell), **Add category**, name "Kansai", Easy 5, **Generate**: it lands on Kansai's category page. **Regenerate** there needs a confirm. The fake fails a second level ("No Medium place passed the checks"), which shows the failure actions.

## F42 — Jobs, queue and limits (2026-11-08)
**What changed:**
- `server/generate/jobs.ts` (new) is ported from Buzzr's `jobs.ts`: `createJobRunner({level, off, store, clock, dailyLimit, replaceDailyLimit, photosFull, onEnded})`.
  - Generate and regenerate run one at a time, and only with no replacement queued or running (409). Replace and add jobs wait in a FIFO queue behind them, with `queuePosition`.
  - Generate makes the category on its first saved level (`saveLevel` with `{name}`); later levels use its `draftBoxAndStyle`, every name in it as `avoid`, and `wikidataIds`.
  - Replace and add run one place of one mode (`only`), then `store.replacePlace` (new: keeps the old id and position) or `store.addPlace`; `job.replaced` holds `{old, new}` for F44's Undo.
  - Cancel: a queued job ends at once and doesn't count; a running one aborts its signal, its in-flight result is thrown away, and its level still counts.
  - `GENERATE_DAILY_LIMIT` and `GENERATE_REPLACE_DAILY_LIMIT` per UTC day, in memory, queued replacements counted ahead (429). The `PHOTOS_MAX_MB` disk guard (`photosOver(DATA_DIR/photos)`) refuses every job (507). Off without a key (503 with the reason).
  - Each ended job goes to the generation history (`onEnded`), with places saved per mode and drops grouped by reason.
- `pipeline.ts`: `LevelRequest.only` (one mode) and `onKept` (places kept per mode after each Check, for the progress view).
- Routes in `server/admin.ts`: `POST /categories/generate`, `POST /categories/:id/levels/:level/regenerate` (both → `{jobId}`), `GET /jobs?categoryId=` (jobs, `off`, `levelsLeft`, `replacementsLeft`), `GET /jobs/:id`, `POST /jobs/:id/cancel`.
- `shared/types.ts`: `GenerationJob`, `JobLevel`, `JobState`, `JobStage`, `AdminJobResponse`, `AdminJobsResponse`.
- `server/index.ts` wires `generatorFor` (fake under `GENERATE_FAKE=1`, real writer and checker with the key; the sign checker rejects until F47), the history file and the runner.

**Decisions:** DECISIONS 50.

**New dependencies:** none.

**Tests:** `npx vitest run server/generate/jobs.test.ts server/http.admin.test.ts server/generate/generator.test.ts server/categoryStore.test.ts`
- jobs.test.ts (23, a hand-answered level function and a fake clock): levels easy→hard with the category made on the first; progress stage and kept counts; regenerate; one generation at a time; no generation while a replacement waits; failure with spend and earlier levels kept; an empty level fails; FIFO queue order and positions; replace under the old id with the note; add; a removed place; cancel queued (no count), cancel running (nothing saved, still counts), an abort rejection is a cancel; cancel of ended/unknown; level and replacement limits reset at UTC midnight; disk guard and `photosOver`; off; the history line.
- http.admin.test.ts (8): generate end to end on the fake generator and fake Wikimedia; the list with limits and a category filter; 429; regenerate and its 404s/400; no levels 400; 409 and cancel; 503 off; 401/403.
- generator.test.ts: `only` and `onKept`. categoryStore.test.ts: `replacePlace`.

**Reviews:** spec-checker: PASS WITH FIXES. secrecy: PASS. Applied: replacements now count as they leave the queue (in `begin`), so the cap and "a cancel still counts" no longer depend on microtask order (the old order happened to hold, so the new back-to-back test documents rather than catches it), a start after the midnight reset, shared limit defaults in `env.ts`, and a `shortcut:` note that `photosOver` reads one level (photos are flat). Not applied: narrowing `plan` to drop one cast.

**Notes for next session:**
- F43 polls `GET /api/admin/jobs/:id` (`GenerationJob`: levels with `state`, `stage`, `kept`; `costUsd`; `error`). The Photos step arrives with M6 (F46 adds `'photos'` to `JobStage`). "Try the rest again" = a new generate for the unsaved levels; for an existing category, the regenerate route.
- F44 adds the replace and add routes on `jobs.start({kind: 'replace' | 'add', …})`, the footer's `replacementsLeft`, and Undo from `job.replaced`.
- F45 reads the history the runner now writes.
- `GET /jobs?categoryId=` can't show a new category's generate before its first level saves (`categoryId` is null until then): the "Generating" banner and chip use the unfiltered list.

**How to try it:** no UI yet. With `GENERATE_FAKE=1 npm run dev` and an admin session, `POST /api/admin/categories/generate` with `{"name":"Kansai","guidance":"","levels":{"easy":{"count":5}}}` (same-origin JSON), then `GET /api/admin/jobs/<jobId>`. No Kim checks.

## F41 — Generation pipeline per level (2026-11-08)
**What changed:**
- `server/generate/pipeline.ts` (new) is ported from Buzzr's `generateLevel`.
  - `generateLevel(request, {generator, wikimedia, onStage, signal})` runs Write → Locate (`createResolver`) → Check (`judge`), then up to `GENERATE_EXTRA_ROUNDS` = 2 top-up rounds for the modes still short. The checker gets `GENERATE_SEARCHES_MAX` (10) minus the searches the level has spent.
  - It returns `places` (cities then landmarks, in the writer's order, trimmed to `count`, with random ids and no `description`), `short`, `dropped` (`{kind, name, reason}`), `usage`, and `box`, `labelStyle` and `emoji`.
  - A first level (`meta: null`) takes the writer's box (an unusable one fails with `NO_BOX`) and emoji. Its label style is inferred from Locate (one country → `city`), and automatic display names are rewritten to it.
  - Drops: the writer's malformed items and facts over 90 characters, every resolver reason, the checker's reasons, and a fact that repeats the name.
  - Errors: any `WikimediaError` becomes "Wikidata isn't answering. Try again later."; writer and checker errors keep their message and add the level's spend; an aborted signal's error passes through.
  - `saveLevel(store, {id} | {name}, level, result)` saves the level as an unreviewed draft, creating a new category first from `{name}`.
- `shared/placeCheck.ts`: `shortText(level)` → `["12 of 15 landmarks"]`.
- `server/generate/generator.test.ts` (F39's writer tests) moved to `writer.test.ts`. `generator.test.ts` now holds the pipeline tests.

**Decisions:** DECISIONS 49.

**New dependencies:** none.

**Tests:** `npx vitest run server/generate/generator.test.ts shared/placeCheck.test.ts`. The pipeline tests run on a scripted writer, a stub checker and the fake Wikimedia client with test-only towns, sites and Busan, so nothing reaches the network:
- drops by reason (not found, outside the box, fact too long, malformed, fact repeats the name, checker drop, settlement as landmark) and duplicates (in the category and twice in a level);
- top-ups only for the short mode, with every written name avoided; at most 2 top-ups, then saved short ("4 of 5 cities") as an unreviewed draft;
- the writer's order trimmed to `count`; at most `ceil(count × 1.25)` located; the searches left passed on; a checker fix kept as the admin's display name;
- first level: the writer's box and emoji, `city` for one country and `cityCountry` for two, a later level keeping its style, `NO_BOX` with the spend, and the new category saved with box, style and emoji;
- the Wikidata failure message with the spend; a checker failure's spend added; a cancel passed through; the whole fake generator end to end;
- `repeatsName`, `inferLabelStyle` and `shortText` units.

**Reviews:** spec-checker: PASS WITH FIXES (this entry, DECISIONS 49). Applied Should-fixes: abort passthrough and `shortText` tests. Not applied: a per-mode writer count; its cost is recorded in DECISIONS 49. secrecy: PASS.

**Notes for next session:**
- F42 builds jobs on `generateLevel` and `saveLevel`:
  - It passes `meta: null` only for a new category's first level. Each later level uses the category's `draftBoxAndStyle`, `avoid` (every place name in the category) and `wikidataIds(category)`.
  - On cancel it aborts the signal and treats a rejection that arrives while `signal.aborted` as cancelled.
  - It records `dropped` grouped by reason, plus `GenerationError.message` only (`cause` may hold place names and SDK text).
- The places-kept counts for the progress view are not reported yet: add an `onKept` hook or count on save.
- F46 adds the Photos step after Check, inside the round loop, before places are accepted.
- F43 shows `shortText` on the job's done view and the category page.

**How to try it:** `npx vitest run server/generate/generator.test.ts`. Nothing is visible yet, and there are no Kim checks.

## F40 — Checker (2026-11-08)
**What changed:**
- `server/generate/checker.ts` (new) is ported from Buzzr's fact checker.
  - `createChecker(client): PlaceChecker` asks `claude-haiku-5-5` with `web_search_20250305` (`max_uses` = the `maxSearches` passed; none left leaves the tool out), a strict `submit_verdicts` tool (`id`, `verdict` ok/fix/drop, optional `fact` and `displayName`, `reason`) and a cached `CHECKER_SYSTEM`.
  - The loop is Buzzr's: a `pause_turn` is resumed with the searches left (the cap is per level), at most 5 times; a reply without verdicts gets one nudge; then a `GenerationError` with the spend. A refusal is a `GenerationError` too; API errors go through F38's `send`, with the abort signal.
  - `checkerPrompt` gives the level's brief and every place (id, kind, name, displayName, Wikidata id, description, country, coordinates, fact) as JSON through `asData`.
  - `CHECKER_SYSTEM` names the spec's drop rules (wrong entity, wrong/disputed/out-of-date fact, level fit, a city name shared with a better-known place, a non-compact landmark, anything offensive) and that a fix can't touch the item, name or coordinates.
  - `judge(items, verdicts)` applies the raw verdicts: `kept` (in order, fixes applied) and `dropped` with reasons. A fix reads only `fact` and `displayName` (a landmark's display name never changes) and must pass the 90/40 limits, else the place drops. A missing verdict drops it.
- `server/generate/writer.ts`: `LEVELS` is exported for the checker's level brief.

**Decisions:** DECISIONS 48.

**New dependencies:** none.

**Tests:** `npx vitest run server/generate/checker.test.ts` (15), all on a stub `StreamingClient`, so nothing reaches the network:
- Haiku 5.5, `max_uses: 10` passed to the API, the strict tool with only the fixable fields, the passed signal; no tool when no searches are left;
- the prompt carries Wikidata id, description, country, coordinates and fact, escaped; the system prompt names every drop rule;
- verdicts returned with searches priced; a paused turn resumed with 6 of 10 searches left; one nudge, then a failure with the spend; too many pauses; a malformed submit; refusal and 401;
- `judge`: a fix cannot change coordinates or the item (lat, lng, wikidataId, name, kind and country in the verdict are ignored); drop reasons kept and trimmed; a left-out field and a landmark's display name kept; no verdict, a bad fix and an empty drop reason; first verdict wins.

**Reviews:** spec-checker: PASS WITH FIXES (this entry, DECISIONS 48, the Kim check, the SPEC-QUESTION comment). secrecy: PASS. Not applied: its optional Should-fixes. One was its own text for a `max_tokens` reply after the nudge; the generic "ended without verdicts" stays. The other was refusing a fixed fact that repeats the name: F41 should check this on writer facts and fixed facts alike (noted below).

**Notes for next session:**
- F41's `real(client)` is `{writer: createWriter(client), checker: createChecker(client), signChecker: …, fake: false}`.
- F41 passes each round's remaining searches (`GENERATE_SEARCHES_MAX` minus `usage.searches` spent so far on the level) as `maxSearches`, builds `CheckItem`s from the resolver's located places with a unique `id` each, and calls `judge`. A kept city whose `displayName` changed gets `autoDisplayName: false`. Record drop reasons as given (history trims them to 300).
- F41 should drop any fact (written or fixed) that repeats the place's name, in one place, after `judge`; neither `writerItemSchema` nor `judge` checks it.
- The fake checker still answers `ok` for every place; `judge` handles its verdicts.

**How to try it:** `npx vitest run server/generate/checker.test.ts`. Nothing is visible yet. The live call is the F40 Kim check.


## F39 — Writer (2026-11-08)
**What changed:**
- `server/generate/writer.ts` (new) is ported from Buzzr's writer.
  - `createWriter(client): PlaceWriter` sends one structured-output request to `claude-sonnet-5-5`, with Buzzr's settings: server-side fallback beta, adaptive thinking, medium effort, 32,000 max tokens and a cached system prompt.
  - It returns the raw `cities` and `landmarks`, plus the priced usage. On a first level only, it also returns the raw `box`, `emoji` and `labelStyle`; on any other level they are dropped even if the reply holds them.
  - A refusal or `max_tokens` throws a `GenerationError` with fixed text and the spend. An API error goes through F38's `send`.
  - A reply that isn't the schema's JSON gives no places and one fixed-text warning, never the reply's text.
- `WRITER_SYSTEM` holds the game, the four fields (fact at most 90 characters, true, specific, timeless and not repeating the name), the settlement rule, the compact-landmark rule, "scaled to the region" and the data-not-instructions line.
- `writerPrompt` puts the data in the user message:
  - `<category>`, `<guidance>` and `<avoid>`, all through Buzzr's `asData` (`<` and `>` become `‹` and `›`). The category name and avoid entries are also collapsed to one line, so a name can't fake an avoid entry.
  - The level brief and the box when there is one.
  - "Give exactly N cities and N landmarks.", with N = `askedCount(count)` = `ceil(count × 1.25)`.
  - On a first level, the request for the box, emoji and label style.
- The JSON schema has the four required item fields, plus `box`, `emoji` and `labelStyle` (enum) on a first level.
- `writerItemSchema` (each field trimmed and non-empty, fact ≤ `FACT_MAX`) and `writerFirstLevelSchema` (`boxSchema`, `categoryEmojiSchema`, `labelStyleSchema`) are exported for F41 to parse the raw reply.

**Decisions:** DECISIONS 47.

**New dependencies:** none.

**Tests:** `npx vitest run server/generate/generator.test.ts` (17), all on a stub `StreamingClient`, so nothing reaches the network:
- the prompt carries the category, guidance and avoid list as escaped data in the user message only, and the system prompt holds none of it;
- names are kept on one line; there is a line for no guidance and an empty avoid list;
- ceil(count × 1.25) for 10, 15 and 4;
- the level brief and the box (also on a first level with a drawn box);
- the level briefs and the compact-landmark and settlement rules are in the system prompt;
- the model, the structured output, and box, emoji and label style only in a first level's schema and prompt;
- an item's exact required fields;
- the item schema trims, rejects long facts (90 ok, 91 not) and missing or empty fields;
- the first-level schema rejects a non-emoji, an unknown style and an inverted box;
- `write` returns raw places, usage and the passed signal;
- box, emoji and label style only on a first level, even when a later reply holds them;
- a bad reply gives no places and a fixed warning;
- refusal, `max_tokens` and a 401 become `GenerationError`s, and a refusal carries its spend.

**Reviews:** spec-checker: PASS WITH FIXES (this entry, DECISIONS 47, the Kim check). secrecy: PASS. Applied Should-fixes: names on one line, the bad-reply warning, and the test for a first level with a box. Not applied: renaming the test file to `writer.test.ts`, since the roadmap names `generator.test.ts`.

**Notes for next session:**
- F40's checker goes in its own `checker.ts` on `send`/`replyUsage` (Buzzr's `checkerParams` and `submit_verdicts` loop). F41's `real(client)` factory is `{writer: createWriter(client), checker: createChecker(client), signChecker: …, fake: false}`.
- F41 must:
  - parse each raw item with `writerItemSchema`, dropping failures with a reason (for example "Fact over 90 characters");
  - parse a first level's extras with `writerFirstLevelSchema`, field by field, so a bad emoji doesn't lose the box;
  - add each accepted `wikidataId` to `existingIds`;
  - log or record only `GenerationError.message`, never `cause`.
- `WriteRequest.count` is one number for both modes. For a top-up where only one mode is short, F41 can pass that mode's shortfall and trim the other mode's extras, or reshape `count` per mode.

**How to try it:** `npx vitest run server/generate/generator.test.ts`. There is nothing visible yet. The live call is the F39 Kim check.

## F38 — Anthropic client, pricing and history (2026-11-08)
**What changed:**
- `server/generate/anthropic.ts` (new):
  - `createAnthropicClient(apiKey)` is the server's only `new Anthropic(...)`. It passes the key explicitly, with `authToken: null`, a fixed base URL and 3 retries, so `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` are never read.
  - It also has `StreamingClient`/`ModelReply` (the one SDK method used, stubbed in tests), `WRITER_MODEL`/`CHECKER_MODEL`, and `replyUsage` (tokens, cache and web searches, priced).
  - `apiErrorMessage` gives a fixed message by status, naming `PINPOINT_ANTHROPIC_API_KEY` on 401/403. `send` throws a `GenerationError` carrying the spend so far.
- `server/generate/pricing.ts` (new) is Buzzr's table (Sonnet 5.5, Sonnet 5, Haiku 5.5), with web search at $10 per 1,000. An unknown model is priced at the dearest known one, by own keys only (Sketchy's fallback). It has `emptyUsage`, `pricedUsage` and `addUsage`.
- `server/generate/generator.ts` (new) holds the interfaces F39/F40/M6 implement: `PlaceWriter` (`WriteRequest` with name, guidance, level, box, count, avoid and `first`), `PlaceChecker` (`CheckItem`, level and `maxSearches`) and `SignChecker` (Commons file, thumbnail, name, country). Each returns raw replies for the caller to zod-parse. It also has `Generator` and `GenerationError`.
- `server/generate/fake.ts` (new):
  - The fake writer gives only the fixture places (Osaka, Kyoto, Sapporo; Himeji Castle, Tokyo Tower), skips the avoid list, caps at `ceil(count × 1.25)`, and proposes Japan's box, 🗾 and `city` on a first level.
  - The fake checker answers `ok` for all. The fake sign checker flags a file name containing "sign".
  - Every usage is zero.
  - `generatorFor(env, real)` answers the fake under `GENERATE_FAKE=1`, else `{generator: null, off: "Generation is off: PINPOINT_ANTHROPIC_API_KEY is not set."}`, else `real(createAnthropicClient(key))`.
- `server/generate/history.ts` (new) is Buzzr's JSONL log. `record(entry)` appends one line to `DATA_DIR/generation-history.jsonl`, one write at a time, making the folder. Reasons and errors are cut to 300 characters, and a failed write only warns. `read(limit, now)` returns the newest first plus `historyTotals` (today, today and the 29 days before, and all time, by the UTC day a job ended). A corrupt line is skipped with one warning.
- `shared/types.ts`: `GenerationJobKind`, `GenerationOutcome`, `GenerationHistoryEntry`, `GenerationHistoryTotals`. `shared/schemas.ts`: `generationHistoryEntrySchema`. `shared/constants.ts`: `HISTORY_TEXT_MAX`.
- `server/env.ts`: `GENERATE_FAKE` is ignored when `NODE_ENV=production`.

**Decisions:** DECISIONS 46.

**New dependencies:** `@anthropic-ai/sdk` ^1.6.0. It is the Claude API client the spec's writer, checker and sign checker run on, already in the planned stack and used by Buzzr and Sketchy.

**Tests:**
- `npx vitest run server/generate/anthropic.test.ts` (11):
  - only the given key is used, with `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` stubbed;
  - built only in `anthropic.ts`, and never bare;
  - no `ANTHROPIC_` env read and no key logged anywhere in `server/`;
  - a reply priced with cache and searches; missing counts are zero;
  - an unknown model (and `toString`) at the dearest price; $10 per 1,000 searches; `addUsage`;
  - `send` passes the params and signal; a 401 becomes the fixed message with the spend so far; the other statuses.
- `npx vitest run server/generate/history.test.ts` (7):
  - append order, the folder made, newest first, the limit (0 too);
  - a missing file; long texts trimmed; corrupt lines skipped with one warning; a failed append warns;
  - the totals' day edges (midnight, the 30th day back, tomorrow).
- `npx vitest run server/generate/fake.test.ts` (8):
  - the writer's avoid list, cap and zero cost; box, emoji and label style only on a first level;
  - every fake place resolves through the real resolver on the fake Wikimedia client, with facts ≤ 90;
  - the checker keeps all; the "sign" flag;
  - `GENERATE_FAKE=1` wins; off with its reason without the key (even with `ANTHROPIC_API_KEY` set); the real factory gets a client holding the Pinpoint key.
- `server/env.test.ts` (+1): `GENERATE_FAKE` is ignored in production.

**Reviews:** spec-checker: PASS WITH FIXES (this entry and DECISIONS 46). secrecy: PASS. Its Should-fixes: the history schema is not in the client bundle (grepped `dist/client`); and F42 must record only `GenerationError.message` and fixed drop reasons, never a raw SDK error (noted below).

**Notes for next session:**
- F39/F40 build the writer and checker on `send`/`replyUsage` in `anthropic.ts` (Buzzr's `writerParams`/`checkerParams` are the pattern) and implement the interfaces in `generator.ts`. They may reshape `WriteResult`/`CheckItem` as the prompts need.
- F42 wires `generatorFor(env, real)` and `openGenerationHistory(env.dataDir)` into `server/index.ts`. It shows `off` to the admin and records one entry per ended job (a fake job's cost is 0). The `error` field must be a `GenerationError.message` only, never a raw SDK error; test that a rejected SDK call leaves no `cause` text in the line.
- The first real call is F39's. Its Kim check should be a live smoke test with the key on the droplet.

**How to try it:** `npx vitest run server/generate`. There is nothing visible yet, and there are no Kim checks.

## F37 — Add by name (2026-11-08)
**What changed:**
- `server/generate/resolver.ts`:
  - `resolve`'s steps 2–7 moved into `check(entity, name, fact, ctx)`.
  - `resolveById(qid, fact, ctx)` (new) runs the same checks on the admin's pick, named by its English label.
  - `searchCandidates(q)` (new) returns up to 7 search hits, each with its label, description, short country name and P625. Country or coordinates are null when Wikidata has none.
- `server/categoryStore.ts`:
  - `addPlace(id, level, place)` appends to the level's draft (forked from live, keeping the reviewed mark) under a random 20-character id. It re-checks the Q-id inside the store's queue and parses the place with `placeSchema`, which also strips the checker-only `description`.
  - `wikidataIds(c)` collects every Q-id in the category.
  - `CategoryStoreError` can now carry 422.
- `server/admin.ts` has two new routes:
  - `GET /api/admin/wikidata/search?q=&categoryId=`: admin only, 30 per IP per minute, then 429.
  - `POST …/levels/:level/places/add-by-id` (`{kind, wikidataId, fact}`) checks against the draft box and the category's Q-ids. A drop answers 422 with its reason.
  - A `WikimediaError` answers 502 with its message.
  - There is no LLM and no daily limit.
- `server/http.ts` takes a `wikimedia` getter. `server/index.ts` builds one shared client (`wikimediaClientFor(env)`) on first use, so a server without `WIKIMEDIA_CONTACT` still starts and the admin sees why.
- `shared/types.ts`: `WikidataCandidate`, `AdminWikidataSearchResponse`.
- `client/src/lib/adminLevel.ts`: `searchWikidata`, `addPlaceById`.
- `client/src/pages/AdminLevel.tsx`: `AddByName` sits at the bottom of each tab panel. Pressing **Add by name** opens a card with these parts:
  - "Name on Wikidata" with **Search** ("Searching…"; "Nothing on Wikidata matches that name."; "n matches").
  - Radio rows (name, Q-id, description, "Country · lat, lng").
  - Fact with an n/90 counter, plus a hint saying why Add is off.
  - **Add ‹name›** and Cancel; Esc also closes.
  
  On success the card closes, "Added ‹name›." is announced and focus returns to the button. A refusal shows its reason and the form stays open.

**Decisions:** DECISIONS 45 covers:
- the search's per-IP limit after sign-in, and `categoryId` (it must exist and doesn't filter);
- the label as the name;
- the draft box and fork;
- 404 for an empty level;
- the 422/502 statuses;
- the shared client made on first use;
- landmarks without a photo until M6 (Publish already refuses them).

**New dependencies:** none. Ids come from `node:crypto`.

**Tests:**
- `npx vitest run server/generate/resolver.test.ts` (+4):
  - search candidates in order with country and coordinates;
  - null country and coordinates, and no hit;
  - `resolveById` with the label, the trimmed fact and cityCountry;
  - six drop reasons on a pick.
- `server/http.admin.test.ts` "admin Add by name" (+5):
  - the search answer, plus 400, 404 and 401;
  - 30 a minute, then 429 until the window passes;
  - an add into a draft forked from live under the draft box, with `description` stripped;
  - nine refusals that change nothing;
  - 502 without Wikimedia.
- `server/categoryStore.test.ts` (+1): `addPlace` id and fork; a racing duplicate, a bad field and an empty level are refused.
- `client/src/pages/AdminLevel.test.tsx` "Level review Add by name" (+2):
  - search, empty answer, pick, fact, add, and the request body;
  - a refusal shown on the Landmarks tab, and Esc.

**Playtest** (`.playtest/F37/`, `GENERATE_FAKE=1`, a throwaway hash, World (dev) Easy), all 8 steps passed:
- sign in;
- the button at the bottom of Cities;
- search "Osaka" gives 2 candidates;
- Add stays off until a pick and a fact;
- Osaka added, with its card and map;
- a second add refused "Already in the category";
- 429 after the 30th search;
- 401 signed out.

**Reviews:**
- spec-checker: PASS WITH FIXES (this entry, DECISIONS 45, the Kim check).
- secrecy: PASS.
- UI: PASS. Applied: "n matches" announced, the reason Add is off, the null-safe coordinates, one wrapper dropped. The duplicate from the store is now 422 like the resolver's.

**Notes for next session:**
- F38/F39's pipeline can reuse `createResolver(...).resolve` and `categories.addPlace`'s id scheme, or `saveDraftLevel`.
- When M6's photo step lands, call it in the add-by-id route for landmarks before `addPlace`.
- "Add a place" (AI, F44) goes beside `AddByName` in the tab panel.

**How to try it:** `GENERATE_FAKE=1 npm run dev` with `ADMIN_PASSWORD_HASH` set in the shell. Open http://localhost:5180/admin → World (dev) → Review on Easy → **Add by name** at the bottom → search "Osaka" (the fake knows Osaka, Kyoto, Sapporo, Himeji Castle and Tokyo Tower; search answers only "Osaka" and "Himeji-jo").

## F36 — Resolver (2026-11-08)
**What changed:**
- `server/generate/resolver.ts` (new): `createResolver(client)` returns `resolve(item, {kind, box, labelStyle, existingIds})`. It answers `{place}` (a `Place` without id or photo, plus Wikidata's English `description` for the checker) or `{drop: reason}`. The steps run in the spec's order:
  1. `entitiesByTitle(enwiki)`. If that finds nothing, `searchEntities(name)`, then the hits' entities, keeping those whose country label (or its short name) matches `country` and whose P625 lies in the box. The most sitelinks wins. Otherwise the item drops: "Not found on Wikidata".
  2. P625: preferred, else the first normal ("No coordinates on Wikidata"). P17: the preferred values, else the normal ones without P582. Exactly one must remain, and it needs an English label ("Disputed or unclear country").
  3. A city is dropped as a sovereign state (P31 Q3624078, checked before the ASK) or when `settlementQuery` answers false ("Not a city"). A landmark is dropped when the ASK answers true ("Is a settlement, not a landmark").
  4. `boxContains`, so a box across the antimeridian works ("Outside the box").
  5. Landmark P2046, converted from km², m², ha, mi² or acres, must not exceed `maxLandmarkAreaKm2(box)` = `(0.01 × S)²` ("Too large to pin").
  6. A Q-id in `existingIds` is dropped ("Already in the category").
  7. `displayName` comes from the store's `autoDisplayName` (DECISIONS 37's 40-character fallback).
  
  External answers are zod-parsed. A failed or malformed answer throws `WikimediaError`, which fails the level. Country labels are cached per resolver.
- `shared/constants.ts`: `COUNTRY_SHORT_NAMES`, keyed by Wikidata English label (for example United States of America → United States, Democratic Republic of the Congo → DR Congo, Czech Republic → Czechia, People's Republic of China → China).

**Decisions:** DECISIONS 44 covers:
- the two drop texts the spec doesn't give;
- the search's country match on the label or the short name, and the tie rule;
- the P2046 rank and units (an unknown unit is not checked);
- the sovereign check before the ASK;
- the per-resolver label cache;
- errors throw;
- the label-keyed override table;
- in-batch duplicates are F39's to add to `existingIds`;
- the drop cases are test-only entities.

**New dependencies:** none.

**Tests:** `npx vitest run server/generate/resolver.test.ts` (23), on the fake client with the F35 fixtures plus test-only entities built in the test (the shared JSON fixtures are unchanged):
- enwiki lookup;
- search fallback by sitelinks; country and box filters (Valencia: Spain dropped, one outside the box dropped, the city over the municipality);
- the short-name country match;
- not found (no hit, or a hit in the wrong country);
- a malformed answer throws;
- the P625 rank choice (deprecated ignored) and no P625;
- the P17 choice: preferred over normal, an ended value ignored; two current countries or none is a drop;
- country labels asked once;
- not a settlement; a sovereign state that is a settlement, with no ASK sent;
- a settlement as a landmark; a landmark keeps its own name in either style;
- outside the box; an antimeridian box keeps Nuku'alofa at −175.2 and drops Guam;
- the size limit for Japan's box (≈ 535 km²): 60,000 ha dropped, Himeji kept, an unknown unit kept, a big city kept;
- the unit conversions;
- a duplicate;
- both label styles, the 40-character fallback, and the override table.

**Reviews:** spec-checker and secrecy both PASS WITH FIXES (this entry and DECISIONS 44, applied).

**Notes for next session:**
- F37 (Add by name) can call `resolve` with the admin's item and the category's Q-ids.
- F39's pipeline should create one resolver per level run, add each accepted place's `wikidataId` to `existingIds`, and give each place a nanoid `id`.
- `description` is not part of `Place`; strip it before saving.
- The photo step (F46) re-reads P18/P373 from the entity; the resolver does not carry them.

**How to try it:** `npx vitest run server/generate/resolver.test.ts`. There is nothing visible yet, and there are no Kim checks.
## F35 — Wikimedia client and fake (2026-11-08)
**What changed:**
- `server/generate/wikimedia.ts` (new) has the `WikimediaClient` interface:
  - `entitiesByTitle` (`wbgetentities sites=enwiki`, normalized), `entitiesById` and `searchEntities` (English, limit 7);
  - `ask` (SPARQL on query.wikidata.org);
  - `searchFiles`, `categoryFiles` (limit 6) and `imageInfo` (url, size, Artist/LicenseShortName/LicenseUrl, 1280 px thumb);
  - `download`.
  
  Answers are raw API JSON for callers to zod-parse.
- `createWikimediaClient({contact, fetch?, now?, sleep?})`:
  - It throws `WikimediaError` while `WIKIMEDIA_CONTACT` is unset.
  - It sends `User-Agent: Pinpoint/1.0 (https://pinpoint.kimnejudne.dev; <contact>)`.
  - It runs one request at a time through a promise queue, at least 100 ms after the previous one ended.
  - It sends `maxlag=5` on Wikidata API calls.
  - It retries 429, 503 and a `maxlag` answer 3 times, on `Retry-After` (seconds or date, at most 60 s), else after 2, 5 and 10 s.
  - Requests time out after 30 s. Downloads come only from `https://upload.wikimedia.org`. Errors carry only the API's `error.code`.
  - It also exports `settlementQuery(qid)`, `depictsSearch(qid)` and `retryAfterMs`.
- `server/generate/fakeWikimedia.ts` (new):
  - `createFakeWikimediaClient(fixtures?)` answers from `server/generate/fixtures/{entities,search,sparql,imageinfo}.json` in the APIs' envelopes: a missing title is `"-1" … missing`, a missing file `missing: true`, and an unknown ASK throws.
  - `download` serves an SVG placeholder (a solid colour and the file's number) for any fixture `url`/`thumburl`, and 404s anything else.
  - `wikimediaClientFor(env)` picks the fake under `GENERATE_FAKE=1`, with no contact needed, else the real client.
- `server/generate/fixtures/` (new, in `.prettierignore` because they are recorded data) is hand-written in the documented shapes:
  - Japan (Q17), Osaka, Osaka Prefecture, Kyoto, Sapporo, Himeji Castle and Tokyo Tower;
  - searches for "Osaka" and "Himeji-jo";
  - depicts searches and categories for both landmarks;
  - six files, among them a GFDL one, `Tokyo Tower sign at entrance.jpg` (for the F47 fake sign check) and a 640 px one.
- `scripts/record-wikimedia.ts <enwiki title>…` (Kim's tool, `WIKIMEDIA_CONTACT` required) records what the resolver and photo step ask:
  - the entity, or the search on the title and every hit's entity;
  - its countries and the settlement ASK;
  - for a non-settlement, the P18/depicts/category candidates (up to 6) and their imageinfo.
  
  Claims are trimmed to P31/P17/P625/P18/P373/P2046, all sitelinks are kept, and the output is merged into the existing files. The core is `recordTitles(client, titles, dir)`.

**Decisions:** DECISIONS 43 covers:
- the gap measured end to start;
- maxlag retried, with a 60 s cap on `Retry-After`;
- where `maxlag` and `formatversion` go;
- the download host check and code-only errors;
- SVG placeholders;
- the hand-written fixtures and which claims are kept.

**New dependencies:** none. The placeholders are SVG, so sharp waits for F46.

**Tests:** `npx vitest run server/generate/wikimedia.test.ts` (15):
- the contact is required (also through `wikimediaClientFor`);
- the User-Agent on every call, `maxlag` only on Wikidata, and the hosts and params;
- four concurrent calls run one at a time, ≥ 100 ms apart, on a fake clock;
- the queue survives a failure;
- 503/429 retried after 2, 5 and 10 s, then given up after 3;
- `Retry-After` in seconds and as an HTTP date;
- maxlag retried, named when exhausted, and other API errors by code;
- a network failure becomes a WikimediaError;
- `retryAfterMs`;
- downloads refused off upload.wikimedia.org with no request sent;
- the fake, with `fetch` stubbed to throw and never called: selected by `GENERATE_FAKE`, entities/search/SPARQL/imageinfo shapes, a numbered placeholder at the thumb size;
- a recorder round trip from the fake into a temp dir reproduces the source fixtures, including search fallbacks.

**Reviews:** spec-checker and secrecy both PASS WITH FIXES. Applied:
- the download host check;
- `error.code` only;
- "maxlag" named on exhaustion;
- the import cycle broken by moving `wikimediaClientFor` to the fake;
- this entry, DECISIONS 43 and the Kim check.

**Notes for next session:**
- F36 (the resolver) parses these answers with zod and uses `settlementQuery`. The sovereign-state exclusion reads P31 from the entity, with no SPARQL.
- F36 adds any fixtures its drop reasons need (no P625, a disputed P17, a too-large area) to the JSON files.
- F46 should cap download size and decide on redirects.
- The fixtures are read from `server/generate/fixtures/` next to the source, so a built server (`dist/`) under `GENERATE_FAKE=1` won't find them. F58's e2e uses `npm run dev`, or else copies them.

**How to try it:** `npx vitest run server/generate`. There is nothing visible yet.

## F34 — Level review: cards, edit, remove and reviewed (2026-11-08)
**What changed:**
- `server/admin.ts` has three new routes on `categoryWrite`, so each needs a session, the same origin and a JSON body, and each body is zod-checked:
  - `PUT …/levels/:level/places/:placeId` (`placeEditBodySchema` → `store.editPlace`);
  - `DELETE` on the same path (→ `removePlace`);
  - `POST …/levels/:level/reviewed` (→ `setReviewed`).
  - `:level` and `:placeId` go through `placeParamSchema`/`levelParamSchema`, and a bad one is 404 "No such level or place". `photoCandidate` answers 400 "Swap photo is not available yet" until F51. `categoryWrite`'s handler now also gets `req.params`.
- `client/src/pages/AdminLevel.tsx` (new) is routed at `categories/:id/:level` in `Admin.tsx`, replacing the placeholder.
  - It has "← ‹category›", the heading "Japan · Medium", and Cities (n) / Landmarks (n) tabs (ARIA tabs, ←/→).
  - There is one card per place: name, "Shown as …", country · Wikidata link, the fact with "n/90", the `PlaceMiniMap`, warnings, **Edit**, and **Remove** (two-press `ConfirmButton`).
  - Edit opens a form in the card: Name, Display name (cities), Fact with counter, Latitude/Longitude, Save/Cancel, Esc.
  - The sticky footer has **Mark ‹level› reviewed** (or "✓ … is reviewed." with **Mark not reviewed**), and the key hint from `lg`.
  - Keys on the document: J/↓, K/↑, E, Delete.
  - After a removal, focus goes to the card now in its place.
- `client/src/components/PlaceMiniMap.tsx` (new) is a 200 px static Leaflet map with the box and a round amber pin (`.admin-pin` in `index.css`). The pin drags only while editing, and a drop outside the box snaps back and reports the refusal. `ConfirmButton.tsx` is copied from Buzzr; armed, it focuses Confirm.
- `client/src/lib/adminLevel.ts` (new) has:
  - `savePlace`, `removePlace` and `setLevelReviewed`;
  - `reviewedContent` (draft, else live);
  - `placeChanges` (only the changed fields);
  - `placeWarnings` (bullseye radius and same display name across same-kind places of every level; "Moved N km from Wikidata");
  - `reviewAction`, `isTyping` and `stepCard` (from Buzzr's `reviewKeys`).

**Decisions:** DECISIONS 42 covers:
- the draft-else-live page;
- the footer for a live-only level, and Unmark;
- which places a warning compares against, and the "(Easy)" suffix;
- the "Moved from Wikidata" origin, kept only per page visit;
- the pin drags only in Edit, with fields as the keyboard way;
- Save sends only the changed fields;
- the keys;
- the 400 for `photoCandidate`.

**New dependencies:** none.

**Tests:** `npx vitest run server/http.admin.test.ts client/src/pages/AdminLevel.test.tsx`
- `http.admin.test.ts` "admin place review" (+5):
  - an edit of name, display name, fact and pin (`coordsSource: 'admin'`, trimmed fact);
  - a live-only edit forks a reviewed draft;
  - refusals: pin outside, lat without lng, fact over 90, blank name, lat 95, `photoCandidate`, an unknown place, a level with no places, an unknown level; nothing changes, and a cross-origin write is 403;
  - remove, then 404 on a second remove, 401 signed out;
  - reviewed true, kept after an edit, then false; 404 without a draft, 400 for a bad body.
- `AdminLevel.test.tsx` (15):
  - tabs and card content;
  - the tab arrow keys;
  - an empty or unknown level;
  - an edit sends only the changed fields;
  - a blank name keeps Save off, and Esc cancels;
  - a pin outside the box is refused, then a pin inside is saved, with "Moved 22 km from Wikidata" while editing and after;
  - a server refusal shows on the card;
  - Remove, Cancel, then Confirm remove; the next card takes focus;
  - mark and unmark;
  - a live-only level's footer, then an edit that forks it;
  - J/K/E/Delete, and typing in a field is not a shortcut;
  - `reviewAction` and `stepCard`;
  - the warnings on cards, and `placeWarnings`/`placeChanges` directly.

**Playtest** (`.playtest/F34/`, dev server with a throwaway hash and the World fixture), all passed:
- tabs and card;
- edit;
- latitude 80 refused;
- a real pin drag saved as admin;
- the same-display-name warning, and the bullseye warning, which clears after the pin is dragged away;
- J/K, E, Esc, and Delete → Confirm remove;
- remove (15 → 14);
- Mark Easy reviewed.

"Moved N km" did not show, because every fixture place is `admin`-sourced; the Vitest cases cover it. The fixture has no landmarks, so only the empty Landmarks tab was seen.

**Review fixes:**
- The Wikidata link is a 48 px target.
- The footer dropped negative margins that would overflow between 768 and 1023 px.
- The mini map attribution is 11 px on phones.
- `<kbd>` uses the body face.

**Notes for next session:**
- F35 (Wikimedia client) is next.
- Landmark cards have no photo, credit, Swap photo or Preview yet (F51).
- Replace, Add a place and the footer's "replacements left today" and queue line come in F44; Add by name in F37. Add them inside `PlaceCard` and `ReviewFooter` in `AdminLevel.tsx`.
- The R key goes in `REVIEW_KEYS` in `adminLevel.ts`.

**How to try it:** `npm run dev` with `ADMIN_PASSWORD_HASH` set in the shell, open http://localhost:5180/admin, then the World (dev) category → Review on Easy.

## F33 — Category page: levels, publish, hide and delete (2026-11-08)
**What changed:**
- `server/admin.ts`: `PUT …/hidden` (`{hidden}`), `PUT …/emoji` (`{emoji: string | null}`, Buzzr's `emojiSchema` as `categoryEmojiSchema`), `POST …/publish` (→ `{category, levels}`, 409 with the store's problems joined by "; ") and `DELETE /api/admin/categories/:id`. All four go through one `categoryWrite` helper: `requireAdmin`, `requireWrite`, a 16 KB JSON body, zod-checked (400 with the first issue). `PUT …/meta` moved onto it. Bodiless writes send `{}`.
- `shared/publish.ts` (new): `draftBoxAndStyle` and `publishProblems` moved out of `server/categoryStore.ts` (which re-exports them), so the store's refusal and the page's disabled button read one rule. `shared/types.ts` gains `AdminPublishResponse`.
- `client/src/pages/AdminCategory.tsx`:
  - The heading row has `CategoryEmojiPicker` (new component: a 48 px button, a popover with a 24-emoji grid, an "Other" field, Remove emoji; Esc and an outside press close it; a pick saves at once).
  - A Levels card: one row per level with Live / Draft / Not generated, live and draft counts per mode, Reviewed / Not reviewed, and **Review** (links to `/admin/categories/:id/:level`, F34). Regenerate and Generate are deliberately left for M5 (generation), as the Done-when bullet says.
  - **Publish ‹name›**, disabled while `publishProblems` finds anything, with the reasons listed under it; on success it goes to `/admin` with "‹name› is live: 3 levels published."
  - **Hide from hosts** / **Show to hosts** and a line saying which, then **Delete**, which opens a field; **Delete ‹name›** is enabled only for the exact (trimmed) name, then `/admin` says "‹name› deleted."
- `client/src/pages/Admin.tsx`: a `Notice` status region above every admin page shows `location.state.notice`. `client/src/lib/adminCategory.ts` gains `publishCategory`, `setCategoryHidden`, `setCategoryEmoji`, `deleteCategory`, `publishedText`, `levelRows`, `countsLine`, `CATEGORY_EMOJI` and `parseOtherEmoji`; `adminCategories.ts` gains a `categoriesChanged` window event, so the list pane reloads after a change on the page. `adminUi.ts` gains `BUTTON_DANGER`.

**Decisions:** DECISIONS 41: the shared Publish rule; one-click Publish; the zero-level Publish text; level row states; `{}` bodies; Hide saves at once with an always-present line (no layout shift); typed-name Delete (trimmed, exact case); the `/admin` notice from router state (stays on a reload of that entry); the list-pane reload event; the emoji grid and "Other" message. "A game already using it plays on" holds because games snapshot their pool and name at start (DECISIONS 37; `categoryStore.test.ts` "leaves a running game's snapshot alone…" hides the category mid-game).

**New dependencies:** none.

**Tests:** `npx vitest run server/http.admin.test.ts client/src/pages/AdminCategory.test.tsx client/src/pages/Admin.test.tsx`
- `http.admin.test.ts` (+5): Publish refused (nothing to publish; unreviewed draft plus a place outside the box, 409 with both, nothing changed); Publish of a reviewed valid draft (levels 1, drafts cleared); hide leaves `/api/categories` and show returns, a bad body 400; emoji set to 🗺️, 🇯🇵 and null, and "ab", "🗾🗾", "" and "x🗾" refused with "Must be a single emoji"; delete refused cross-origin (403), then deleted, gone from the lobby, and a second delete 404.
- `AdminCategory.test.tsx` (+10): level rows and the Review link; Publish disabled with reasons (unreviewed, outside, nothing to publish, a landmark without a photo) and no POST sent; Publish with three reviewed drafts lands on `/admin` with "Japan is live: 3 levels published."; hide/show PUTs and the plays-on line; typed-name delete (wrong case refused, no DELETE sent; exact name deletes and lands on "Japan deleted."); Cancel returns focus to Delete; the emoji grid pick and the "Other" refusal; `parseOtherEmoji`; `publishedText`.
- `Admin.test.tsx` (+1): the notice passed in navigation state shows in the status region.

**Playtest** (`.playtest/F33/`, dev server with a throwaway hash): levels, Review links, Publish disabled with "Nothing to publish.", emoji picker ("abc" refused, 🧭 saved and in `/api/categories`), a label-style change enables Publish and lands on `/admin` with "World (dev) is live: …", hide/show against `/api/categories`, typed-name Delete. The "3 levels published." path needs drafts, which no admin route creates until M4/M5; the unit test covers it.

**Reviews:** spec-checker PASS WITH FIXES (this entry and the Kim check). Secrecy PASS. UI PASS WITH FIXES, all applied: no popover shadow, a 360 px-fitting popover, Cancel refocuses Delete, the notice region stays mounted, `tabular-nums` counts, no layout shift on Hide/Show or Publish.

**Notes for next session:** F34 replaces the "not built yet" level route the Review links point at. `publishProblems` is in `shared/publish.ts` now; import it from there.

**How to try it:** `ADMIN_PASSWORD_HASH=… DATA_DIR=/tmp/pp-data npm run dev`, sign in at http://localhost:5180/admin and open World (dev).

## F32 — Category page: box editor and label style (2026-11-08)
**What changed:**
- `server/admin.ts`:
  - `GET /api/admin/categories/:id` answers `{category}`: the whole stored category, drafts included, or 404 "No such category".
  - `PUT /api/admin/categories/:id/meta` sits behind `requireAdmin` and `requireWrite`, with a 16 KB JSON body. It checks the body against `categoryMetaBodySchema` (400 with the first issue's message), then calls `store.updateMeta` and answers `{category}`.
  - A router error handler maps `CategoryStoreError` to its status and `{error}`, an oversize body to 413 and bad JSON to 400. Later admin writes reuse it.
- `shared/geo.ts`: `boxTooSmall(box)` gives the one refusal text, "The box is too small: scale 100 km, at least 150 km". `updateMeta` and the page both use it. `shared/types.ts` gains `AdminCategoryResponse`.
- `server/categoryStore.ts`: the first write creates the data directory. The playtest found that a fresh dev server's `./.data` was missing, so saves failed with a 500.
- `client/src/pages/AdminCategory.tsx` (new) is at `/admin/categories/:id`. It shows skeletons while loading, an error with Retry, the "‹emoji› ‹name›" heading, the box editor, and the label style.
  - The label style is a radio group: City "Osaka" / City, Country "Lima, Peru". It saves on choice, says "Label style set to …", and the radios stay focusable while saving.
  - `categories/:id/:level` stays "not built yet" until F34.
- `client/src/components/BoxEditor.tsx` (new):
  - A Leaflet map (`useLeafletMap`) fitted to the draft box, with the attribution visible.
  - An amber rectangle with four draggable corner handles: 48 px hit areas around a 20 px square. Dragging moves two edges, rounded to 2 decimals.
  - Every place as a dot: cities round, landmarks square, red and larger when outside. Dots past the antimeridian are drawn on the box's side.
  - South/West/North/East number fields: step 0.01, shown with 2 decimals on blur.
  - The readout "Scale 2,313 km · Bullseye 23 km".
  - A fixed alert slot for why the box can't be saved.
  - "N places outside the box", listed with level and kind.
  - **Save box**, disabled while the box is malformed, under 150 km or unchanged.
  - On a live category: "On a live category the box goes live on Publish."
- `client/src/lib/adminCategory.ts` (new) has `loadCategory` and `saveMeta` (a 401 signs out), and the pure `draftMeta`, `roundBox`, `cornerAt`, `dragCorner`, `boxError`, `scaleReadout` and `boxPlaces`. `boxPlaces` takes each level's draft, else its live level: the places Publish checks.
- `client/src/index.css`: `.admin-box`, `.admin-handle` and `.admin-dot*` (map data, token colours).

**Decisions:** DECISIONS 40 covers:
- the response shape and the 16 KB body limit;
- the shared refusal text, and Save disabled while the box is invalid or unchanged;
- the corner rounding and blur formatting;
- the map fitted once;
- the dots and the outside list from draft-else-live;
- the label style saving at once;
- the `mkdir`.

**New dependencies:** none.

**Tests:** `npx vitest run client/src/pages/AdminCategory.test.tsx server/http.admin.test.ts server/categoryStore.test.ts`
- `AdminCategory.test.tsx` (9):
  - the draft box at 2 decimals and its readout;
  - a numeric edit updates the readout, blur formats it, and Save sends the PUT body;
  - a 100 km box is refused with the exact text and no PUT is sent;
  - a malformed box (south over north, an empty edge);
  - outside places listed and flagged, with 3 dots, 1 square, 1 red and 4 handles, and cleared by widening the box;
  - the server's refusal shown;
  - the label style PUT `{labelStyle: 'cityCountry'}` and checked;
  - `dragCorner`;
  - `boxPlaces` across the antimeridian (east 190).
- `http.admin.test.ts` (+3):
  - GET needs a session and returns the category or 404, `no-store`;
  - meta on a live category goes into `draftMeta` with the live box unchanged;
  - validation:
    - south over north, east before west, a bad style, under 150 km and bad JSON are each a 400 with a message;
    - an unknown id is 404, a foreign origin 403 and no session 401;
    - nothing is saved on a refusal.
- `categoryStore.test.ts` (+1): a missing data directory is created on the first write.

**Playtest** (`.playtest/F32/`, dev server with a throwaway hash and `DATA_DIR=/tmp/pp-data`):
- The editor, fields and readout.
- City dots.
- A field edit changes the readout and formats to `40.00`.
- "17 places outside the box" listed.
- An ~11 km box refused.
- A box saved on the live category.
- City kept after a reload, and City, Country saved.
- No sideways scroll at 360 × 640.
- Console errors: only the expected pre-sign-in 401.

Corner dragging, square landmark dots (the dev data has only cities) and the review's 48 px handle change are in Kim checks.

**Review fixes:**
- 48 px handle hit areas.
- Skeletons while loading.
- The radios no longer disabled while saving (focus stays).
- A fixed error slot.
- A token radius for the handle.
- One "goes live on Publish" line.
- The map label mentions the outside list.
- The saved style is named.
- An antimeridian test.

**Notes for next session (F33):**
- Add Levels, Publish, Hide/Show, Delete and the emoji to `AdminCategory.tsx` under the two cards.
- `onSaved(category)` replaces the page's category, so each write route should answer `{category}`, as meta does.
- The admin router's error handler already maps `CategoryStoreError`.
- For the Publish gates, add `publishProblems(category)` to the GET response, or compute them on the client; the store's function is server-only.
- After Publish or Delete, the list pane re-reads on navigation (to `/admin`).


## F31 — Admin layout and dashboard (2026-11-08)
**What changed:**
- `GET /api/admin/categories` (`server/admin.ts`, behind `requireAdmin`, `no-store` like every admin answer) lists every category, hidden and draft-only ones included, as rows from `adminRow()` (`server/categoryStore.ts`):
  - per level a state: `review` (an unreviewed draft), `draft` (a reviewed one), `live` or `missing`;
  - a `published` flag;
  - city and landmark counts, from the draft when there is one.
  - `shared/types.ts` gains `AdminLevelState`, `AdminLevelRow`, `AdminCategoryRow` and `AdminCategoriesResponse`. `http.ts` passes the store to the admin routes.
- `client/src/pages/Admin.tsx` is now the gate and then the admin frame:
  - The header has **Pinpoint Admin** (home), History, "Signed in until HH:MM" and Logout. Below 1024 px a ⋯ `<details>` menu holds History and "Logout (until HH:MM)", and closes on Escape or an outside tap.
  - From 1024 px the list pane sits beside the open page; below, one pane at a time with "← Categories" on inner pages.
  - Nested routes:
    - index: the overview from 1024 px, the list below;
    - `categories/:id/*`, `generate` and `history`: "This page is not built yet." until F32/F33, F43 and F45;
    - an unknown path.
  - Signing in on an inner page keeps its URL.
- `client/src/components/AdminCategories.tsx` (new) holds `AdminCategories` and `AdminOverview`.
  - The list has **+ Add category** (to `/admin/generate`), skeleton rows while loading, an error with Retry, and "No categories yet: Add category".
  - It has a search box and count chips in the URL (`?filter=&q=`, carried on row links), "No categories match. Clear", and a dot legend.
  - Each row has the emoji, name, three level dots (with title and screen-reader text), "Cities 15/15/12 · Landmarks 15/14/15" and at most one badge.
  - The list is read again on every page move. Below 1024 px a one-line count sits above it.
  - The overview has tiles (Categories, Live, Needs review, Hidden) and the to-review list with the levels to review.
- `client/src/lib/adminCategories.ts` (new) has `loadCategories`, where a 401 signs the page out. It also has the pure rules: `needsReview`, `isLive`, `categoryBadge`, `listOrder` (attention first, then by name), `countsText`, the filters, folded search, `filterCounts` and `filterSearch`.
- `client/src/lib/adminUi.ts` (new) holds the shared class names. `client/src/lib/useMediaQuery.ts` (new, from Buzzr) has `useDesktopLayout` at 1024 px.

**Decisions:** DECISIONS 39 covers:
- the row states, counts source, "–" for missing, and the dot colours and legend size;
- one badge (Needs review over Hidden), with Generating and Failed coming in F42 and the Generating chip at 0 until then;
- Live meaning not hidden with a published level;
- search and the URL filters;
- the overview tiles, the ⋯ menu below 1024 px, and the placeholder pages;
- the static bundle walk.

**New dependencies:** none.

**Tests:** `npx vitest run client/src/pages/Admin.test.tsx scripts/play-bundle.test.ts server/http.admin.test.ts server/categoryStore.test.ts`
- `Admin.test.tsx` (13):
  - not configured;
  - sign in, list, then sign out from the ⋯ menu, which also closes on Escape and an outside tap;
  - wrong password, and Retry;
  - signing in on `/admin/history` opens it;
  - a 401 on the list returns to sign-in;
  - attention-first order;
  - row content: counts with "–", dot text, one badge, the emoji, the link and the phone count line;
  - chips and search, with counts, the URL, folded search, the row link keeping `?q=`, no match, and Clear;
  - the empty state, and a load error with Retry;
  - from 1024 px (matchMedia stubbed): the header in a row, the list pane, the overview tiles and the to-review list, and the open row `aria-current` beside its page.
- `scripts/play-bundle.test.ts`: the static import graph from `client/src/main.tsx` has `Play.tsx` and no admin module. The same walker from `Admin.tsx` does find `adminCategories.ts`, so the check can fail.
- `server/http.admin.test.ts` (+2): the list needs a session; rows include hidden and draft-only categories, with `no-store`.
- `server/categoryStore.test.ts` (+1): `adminRow` (draft over live, the `published` flag, missing as zero).
- Build: admin strings ("Pinpoint Admin", "Add category", `api/admin/categories`, "Admin menu") are only in `Admin-*.js` and absent from `index-*.js`.

**Playtest** (`.playtest/F31/`, dev server with a throwaway hash):
- A wrong password shows its error, and signing in works.
- At 1280 × 800: the header, the list pane with chips and the dev World row, and the overview.
- Search hides the row and clearing brings it back; chips set `aria-pressed` and `?filter=review`.
- At 360 × 640: the ⋯ menu with Logout, and no sideways scroll.
- `/` requests nothing admin.
- Logout returns to the form.
- The only console errors were the expected 401s.

**Review fixes:**
- The empty-state link is a 48 px target.
- The chip row has room for the focus ring.
- The ⋯ menu closes on Escape and an outside tap, and stays open on "Logging out…".
- The open page sits beside the list, not centred.
- Counts and badges are 16 px.
- Sharing one list read between the pane and the overview went to Backlog.

**Notes for next session (F32):** replace the `categories/:id/*` placeholder in `AdminPages` (`Admin.tsx`) with the category page. Add `GET /api/admin/categories/:id` on `adminRoutes`, and `PUT …/meta` behind `requireWrite`, mapping `CategoryStoreError.status` to `{error}`. The list pane reads the list again on every route change, so a saved change shows up after navigation. A page that changes the list in place needs a refresh hook (Buzzr's `onCategoriesChanged`).

## F30 — Admin access (2026-11-08)
**What changed:**
- `server/admin.ts` (new, after Buzzr's `admin.ts` and `adminRoutes.ts`):
  - `verifyAdminPassword` runs scrypt off the main thread and compares with `timingSafeEqual`.
  - `AdminSessions` keeps 12 h sessions in memory, keyed on the token's SHA-256.
  - `adminCookie` reads `pinpoint_admin` from the `Cookie` header.
  - `adminRoutes()` returns the router and `requireAdmin`. It has `POST /login` (5 tries per IP per minute, counted first; 8 KB JSON body), `GET /session` and `POST /logout`. Every answer is `Cache-Control: no-store`.
  - `requireWrite` (exported for F31–F45) refuses a cross-origin `Origin` with 403 and a non-JSON body with 415.
- The cookie is HttpOnly, `SameSite=Strict`, path `/api/admin`, 12 h, and Secure when `req.secure`.
- `server/env.ts`: `ADMIN_PASSWORD_HASH` is parsed into `{N, r, p, salt, hash}`. A malformed value stops the start, naming the variable.
- `server/http.ts` mounts `/api/admin` only with a hash; without one, the `/api` catch-all answers 404.
- `server/index.ts` passes the hash and warns in production when `TRUST_PROXY` is off.
- `scripts/admin-hash.mjs` and `npm run admin:hash` read the password with echo off, or piped, and print `scrypt$32768$8$1$salt$hash` (copied from Buzzr).
- `client/src/lib/adminSession.ts` (new) holds the session state: loading, disabled, failed, signed out or signed in, with an expiry timer. It also has `adminSignIn`, `adminSignOut`, `adminWrite` (a same-origin JSON write) and `adminSessionEnded` for later pages.
- `client/src/pages/Admin.tsx` (new), lazy-loaded at `/admin/*` in its own chunk, shows the session gate:
  - "Checking…";
  - "Admin is not configured on this server.";
  - "Could not reach the server." with Retry;
  - the sign-in form;
  - when signed in, a card with the session end and Logout. F31 replaces this card with the admin layout.
- `shared/constants.ts` gains `ADMIN_COOKIE`, `ADMIN_SESSION_MS` and `ADMIN_SESSION_BYTES`. `shared/types.ts` gains `AdminSessionResponse`.

**Decisions:** DECISIONS 38 (hash format and bounds, error statuses and texts, login limit order, session replacement, no-store, the proxy warning, the interim signed-in card).

**New dependencies:** none.

**Tests:** `npx vitest run server/http.admin.test.ts client/src/pages/Admin.test.tsx`
- `server/http.admin.test.ts` (14):
  - hash parsing, and refusal of a malformed hash, an N that is not a power of 2, and one over 64 MB;
  - `npm run admin:hash` run with a piped password, then parsed and verified (wrong password refused);
  - every route 404 with the hash unset or blank;
  - sign in, session and sign out;
  - the cookie flags, plus Secure over a trusted HTTPS proxy;
  - wrong password 401, bad body 400, oversized body 413;
  - 5 tries a minute, then 429, and open again after the window;
  - cross-origin 403 and form body 415, with the session surviving;
  - expiry at exactly 12 h on a fake clock;
  - a restart forgets the session;
  - a new sign-in replaces the old one;
  - only SHA-256 keys are stored.
- `client/src/pages/Admin.test.tsx` (4): "not configured" on 404; sign in with a same-origin JSON POST, then Logout; a wrong password shows the server's error and clears the field; Retry after a network failure.
- `dist/client/assets/index-*.js` has no admin strings; `Admin-*.js` is its own chunk.

**Playtest** (dev server; `.playtest/F30/scenario.ts`, with `F30_MODE=off` or `on`):
- Hash unset: the routes 404, and `/admin` says not configured.
- Hash set, made with `npm run admin:hash`:
  - a wrong password shows its error;
  - signing in shows the session end and survives a reload;
  - the cookie flags are as the spec says;
  - a foreign-origin logout is 403 and a non-JSON one 415;
  - Logout returns to the form;
  - the 6th try in a minute is 429.
- The only console errors were the expected 404/401 from the session probe.

**Notes for next session (F31):** put admin routes on `adminRoutes().router` behind `requireAdmin`, and writes behind `requireWrite`. Map `CategoryStoreError.status` straight to `{error}`. On the client, call `adminSessionEnded()` on any 401, and replace `SignedIn` in `Admin.tsx` with the layout. The bundle check in F31's tests can assert what was checked by hand here.

## F29 — Category store writes and publish rules (2026-11-07)
**What changed:**
- `server/categoryStore.ts`: `CategoryStore` gains admin writes: `list`, `find`, `create` (slug id, made unique with `-2`), `saveDraftLevel` (for generation), `updateMeta`, `editPlace`, `removePlace`, `setReviewed`, `publish`, `setHidden`, `setEmoji` and `remove`.
  - Changes run one at a time through a queue. Each one writes `categories.json` (temp file, flushed, then renamed; schema-checked first) before it takes effect.
  - Each change replaces the category with a new object, so a running game's read never changes.
  - Refusals throw `CategoryStoreError` with an HTTP `status` (404, 400 or 409) for the admin routes (F32–F34).
  - Rules:
    - Save box refuses `S < 150` km (`MIN_SCALE_KM` in `shared/constants.ts`).
    - A live category's meta goes into `draftMeta`.
    - A label-style change rewrites only `autoDisplayName` cities (`autoDisplayName()` is exported for Locate).
    - Edits to a level with no draft fork it from live.
    - A moved pin must stay in the box and becomes `coordsSource: 'admin'`.
- `publishProblems(c)` lists why Publish would refuse; F33's button can use it. Publish refuses while:
  - a draft level is unreviewed;
  - a place that would be live lies outside the draft box or has no coordinates;
  - a landmark has no photo;
  - there is nothing to publish.

  It makes every draft live at once and returns the level count.
- `cleanUpPhotos` runs at start when the file loaded with at least one category. It logs "Photos: deleting N unreferenced file(s)", then deletes `photos/*.webp` files no live or draft place names.
- The dev fixture is never written: admin writes in development save a file without it.

**Decisions:** DECISIONS 37 (queue and atomic write, error statuses, draft forking, meta into `draftMeta`, auto display name form and its 40-character fallback, create's unchecked box, slug ids, the fixture, the clean-up scope).

**New dependencies:** none.

**Tests:** `npx vitest run server/categoryStore.test.ts` (25 tests). They cover:
- the atomic write (no temp left; a failed rename changes nothing in memory and the queue goes on) and concurrent changes in order;
- unique slugs;
- a box at 144.6 km refused, and one of 150 km or more taken;
- `draftMeta` until Publish;
- the label-style rewrite only for automatic city names, with live-only levels following on Publish, and the 40-character fallback;
- edits forking the draft;
- the pin outside the box refused;
- landmark photo and name;
- remove and reviewed;
- each publish gate, and all drafts published at once;
- hide, show, emoji and delete;
- a game snapshot (`snapshotPool` and the read object) unchanged by edit, meta, publish and hide while the next read sees the change;
- the fixture never written;
- photo clean-up deleting 2 orphans after the log line, and deleting nothing for a missing, empty, unparsable or invalid file.

**Playtest:** none (no UI; F32–F34 add the admin pages and routes).

**Notes for next session:** the admin HTTP routes map `CategoryStoreError.status` straight to the response with `{error: message}`; anything else is a 500. `create` does not check the 150 km rule (DECISIONS 37); the generation pipeline should clamp or refuse a tiny writer box.

## F28 — Finale on the Screen and phones (2026-11-07)
**What changed:**
- `server/views.ts`: `finalView` builds the finale in FINAL with at least one played round, from `game.played` only. It has the podium (held ranks 1–3, tied players on one step), a pass per player in standings order (`rank`, `total`, plus F27's `passStats`) and `travelAwards`. The ScreenView carries it as `final`. The PlayerView gets a new `final: {pass, awards}` with only the viewer's own pass and the awards they share in. Zero rounds gives `final: null` ("No rounds played").
- `shared/types.ts`: `FinalPass` (`bestRound` string, `avgKm`), `Award` and `AwardId` (moved from `shared/awards.ts`, which re-exports them) and `FinalView`. The unused draft `AwardKind` and `creditsUrl` are gone; F50 adds the credits line.
- `client/src/components/ScreenFinale.tsx` (new): stages the podium (2nd · 1st · 3rd; 3rd at 0.6 s, 2nd at 1.8 s, 1st at 3.0 s), the passes in a 4-wide grid from 5.0 s, 150 ms apart, and the award cards (static flap title, winners, stat) from 8.0 s, one per 2.5 s. Everything then stays. Timing runs from the moment the Screen shows FINAL, and a mid-finale view change keeps it. `.finale-in` rises in over 600 ms; reduced motion gives a 150 ms fade. The awards list is `aria-live`.
- `client/src/pages/Screen.tsx` routes FINAL to `ScreenFinale`; `ScreenStandings` is now SCOREBOARD-only. The rematch 3-2-1 still sits over the finale.
- `client/src/components/PlayGame.tsx`: the phone's FINAL card is the player's pass (emoji, name, colour stripe, "1st of 4", points, best round, "Avg … km") plus "Your travel awards".

**Decisions:** DECISIONS 36 covers:
- staging from the Screen's own arrival in FINAL, so a refresh replays it;
- held ranks only on the podium, and a 4+ tie on one step clipping;
- the short place `name` in passes and awards;
- the PlayerView `final` field;
- the deferrals: fanfare F56, credits line F50, BoardingPass and flaps F53/F54.

**New dependencies:** none.

**Tests:** `npx vitest run server/views.test.ts client/src/pages/Screen.test.tsx client/src/pages/Play.test.tsx`
- `views.test.ts`, "finale views" (4 players, 5 rounds):
  - podium `[1: P1]`, `[2: P2, P3]` with no 3rd step;
  - passes in rank order, and the best round "Round 5 · Testville · 2,000" from the ×2 round;
  - awards Pilot "5 bullseyes", Lost Luggage, and a shared Frequent Flyer;
  - no coordinates, Wikidata id, country or fact in any finale JSON;
  - each phone gets its own pass and only its awards;
  - zero rounds gives `final` null on both views.
- The leak test now also asserts `final` is null and that `awards`, `bestRound` and `avgKm` are absent before FINAL. The 2-player standings test checks two steps and no awards.
- `Screen.test.tsx`, "Screen finale" (fake timers):
  - every stage boundary at 1 ms (1799/1800 and so on);
  - the shared 2nd step;
  - passes 150 ms apart and awards 2.5 s apart, all still shown after 60 s;
  - the 2-player podium (two steps, no awards column) and the 3rd step at 0.6 s;
  - a player joining mid-finale doesn't restart the clock;
  - "No rounds played";
  - the rematch 3-2-1 over the finale.
- `Play.test.tsx`: the phone's pass text, its colour stripe and its awards; no awards section without awards.

**Playtest** (Mika as VIP, bots, the Screen), no console errors:
- 0 rounds shows "No rounds played".
- With 4 players, the steps, passes and awards appear at the spec's times.
- The phone shows its own pass and only its award.
- 2 players show two steps and no awards.
- 12 players at 1920 × 1080 and 1280 × 720: three rows of passes fit above the join strip.
- Not driven live: a shared podium step (unit test).

**Notes for next session:**
- On the 284 px wide passes, "Round 1 · Paris · 259" wraps the points onto a second line. F54's BoardingPass can tidy this, for example by putting the points on their own aligned row.
- `.playtest/F28/` has the scenarios (`scenario.ts`, `finale12.ts`).


## F27 — Travel awards (2026-11-07)
**What changed:**
- `shared/awards.ts` (new), pure logic for the finale; nothing is wired into a view yet (F28):
  - `travelAwards(playerIds, rounds)`: Pinpoint Pilot, Lost Luggage, Frequent Flyer, Smooth Landing in that order. Eligible after half the played rounds rounded up (missed rounds don't count, at least 1). Each award goes to the best-ranked player who has not won yet; players tied on its stat share it (in standings order). Pilot needs a bullseye. At most 3; none with fewer than 3 players in `playerIds`. Each `Award` is `{id, title, playerIds, stat}`, with stats "2 bullseyes", "4,812 km from Lima", "18,204 km in total".
  - `passStats(playerId, rounds)`: `bestRound` ("Round 7 · Osaka · 960", highest points, earliest on a tie) and the unrounded `avgKm` over played rounds; both null without a played round.
- `formatKm` moved from `client/src/lib/format.ts` to `shared/geo.ts` (the client re-exports it), so award stats print distances as the reveal rail does.

**Decisions:** DECISIONS 35 covers ties against "always yields 3": ties are shared among new winners only, so a shared award can use up every eligible player and fewer than 3 awards follow. It also covers the at-least-one-round eligibility, the stat texts and the best-round tie.

**New dependencies:** none.

**Tests:** `npx vitest run shared/awards.test.ts client/src/lib/format.test.ts`
- Each award with its stat text; Pilot skipped without a bullseye; the singular "1 bullseye".
- No repeat winner: a player who leads on several stats wins once, and the next best non-winner takes the rest.
- Shared ties in standings order; the stat place from the earliest round.
- Eligibility at 3 of 5 rounds: a late joiner and a player who missed 3 rounds get nothing.
- 2 players → none. A third player who never played still lets the other two win.
- No played rounds → none.
- 500 seeded random games of 3–8 players: no repeats, at least 3 winners, and 3 awards unless every player already won (always 3 when nothing is shared). All-tied 3 players → one shared award.
- `passStats`: best round, earliest on a tie, "1,499" with a comma; the average skips missed rounds; null without a played round.

**Playtest:** none (no UI; pure logic).

**Notes for next session (F28):**
- Build `AwardRound[]` from `game.played` only (revealed rounds), with `placeName` set to the name the reveal showed. `playerIds` is the final standings in standings order.
- Send awards and pass stats only in FINAL, and add `awards`, `bestRound` and `avgKm` to `server/views.test.ts`'s leak test.
- A phone gets `passStats` for its own id only, unless Role views says otherwise.
## F26 — Dev tool: fake players (2026-11-07)
**What changed:**
- `server/devBots.ts` (new): `spawnBots` joins one Socket.IO player per identity, one at a time. Each GUESSING round a bot aims at a uniform point of its view's `region.box` (`randomPointIn`, wrapping a box past 180°) and locks in there after a random share of up to 90% of the time left. A refused lock-in (paused meanwhile) plans again on the next GUESSING state; waiting players sit the round out. `botIdentities` picks "Bot N" names and emoji free in the room, within `MAX_PLAYERS`.
- `server/http.ts`: `createApp({devTools})` mounts `GET /dev/bots/:code?count=N` (default 3, `DEFAULT_BOT_COUNT` in `shared/constants.ts`): `{code, bots}`, 404 for an unknown room, 409 when no bot could join. `devBots.js` is loaded by a dynamic import, so production never loads `socket.io-client`. `/dev/*` otherwise answers a JSON 404 and the SPA fallback skips `/dev/`.
- `server/index.ts` passes `devTools: !env.production`; the dev fixture was already production-gated in `loadCategoryStore` (F08).
- `vite.config.ts` proxies `/dev` to the dev server, so http://localhost:5180/dev/bots/CODE works.

**Decisions:** DECISIONS 34 (server-side bots over Socket.IO, the GET with `?count=`, names and emoji, aim and lock-in timing, rematches, a refresh adding a new batch).

**New dependencies:** none (`socket.io-client` was already installed for the client and the socket tests).

**Tests:** `npx vitest run server/devBots.test.ts server/http.test.ts`
- `http.test.ts`, "dev tools": with `parseEnv({NODE_ENV: 'production'})` wired as `index.ts` does (and a client dir, so the SPA fallback is in play), `/dev/bots/ABCD` and `/dev/anything` are JSON 404s and `/api/categories` is `[]` (no fixture); in development the route is mounted ("No such room.") and the fixture is served.
- `devBots.test.ts`: the route joins Bot 1–3 with distinct emoji next to the human, 409 for a full room, 404 for an unknown one; with a real gateway and hand-fired timers, three bots aim inside the box as GUESSING opens, schedule their lock-ins under the 30 s timer, lock in at their aims when fired, and do it again in round 2; `botIdentities` skips taken names and emoji and stops at the cap; `randomPointIn` stays in the box and wraps the antimeridian.

**Playtest** (Mika as VIP, the Screen, 3 bots), no console errors: unknown room 404; `?count=3` spawned Bot 1–3 onto the Screen lobby; in round 1 the bots locked in on their own and the round revealed with their pins without the human locking in, then moved to round 2; `?count=50` respected the cap; a production server answered `/dev/bots/ABCD` with 404. A live smoke of `dist/` with `NODE_ENV=production` gave the same 404 and `[]` categories.

**Notes for next session:** each call spawns a new batch and the earlier batch keeps playing (DECISIONS 34); a per-room registry that stops the old batch would be the upgrade if that gets in the way.

## F25 — Reconnects and drop-outs end to end (2026-11-07)
**What changed:**
- The reconnect mechanics were already in place (F06 join/leave and VIP away, F10 stored key, F15 `everConnected` and `allLocked`, F17 `myAim`, F19 `initialCentre`). This feature proves them end to end and closes one gap.
- `client/src/components/ScreenGame.tsx`: a disconnected player's row on the standings board (SCOREBOARD and FINAL) is greyed (`opacity-40 grayscale`, DESIGN's disconnected state) and keeps their score, with an `sr-only` "(disconnected)" for screen readers. The tile was already greyed.

**Decisions:** DECISIONS 33 (greying on the standings board only, not the reveal rail; the whole row dims; the sr-only cue).

**New dependencies:** none.

**Tests:** `npx vitest run server/sockets.test.ts client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`
- `sockets.test.ts`, "socket gateway: reconnects":
  - the VIP (with an aim) and a locked-in player drop mid-GUESSING, show greyed on the Screen, rejoin with their keys: the VIP keeps the ★ (the stale `vipGone` does nothing) and `myAim`, the other keeps `myLock`, and the VIP can still lock in;
  - a Screen refreshed during REVEAL gets the same round and reveal back;
  - everyone gone in GUESSING: no `allLocked`, `guessUp` still scores the aim and the opening centre, a player absent all round is missed (no position, 0 points), and the SCOREBOARD keeps all three, disconnected, with their totals;
  - after a restart (empty room store) both `screen:join` and `player:join` get "This game has ended".
- `Play.test.tsx`: a refresh mid-guessing reopens the crosshair on `myAim` and Lock in sends it; a refreshed locked-in phone shows the Locked-in card.
- `Screen.test.tsx`: a disconnected player's standings row is greyed with their score. The missed-round "—" stays covered by F18's rail test ("🐸Ivy—"); room-gone on each role by the existing Screen and Play tests.

**Playtest** (Mika as VIP, Ana, Ben, the Screen), no console errors: Ana offline 2.5 s and reloaded mid-guessing, back to guessing; Ben locked in and reloaded, Locked-in card; the Screen reloaded mid-round and in REVEAL, back to the same view; the VIP reload kept the ★; Ana scored while offline; an unknown code showed "This game has ended" with a link on the Screen and a phone. Not driven in the browser (unit tests): the kept aim, the "—" of a missed round, a real restart.

**Notes for next session:** none.

## F24 — Rematch and back to lobby (2026-11-07)
**What changed:**
- `server/reducer.ts`:
  - `vip:rematch` (FINAL, no countdown, VIP) checks the same settings against the live category the gateway passes in, sets `rematchAt = now + 3 s` and schedules `rematchGo`. Nothing is reset yet.
  - `vip:rematchCancel` clears it and bumps `timerEpoch`.
  - `rematchGo` clears the countdown. With a connected player, and the category still live and big enough, it starts a **New game** with the same players and settings (`newGame`, then `bumpEpoch`, which re-sets a pending `vipGone` for the new game number, then `openRound(1)`). With nobody connected, or the category gone, it only clears the countdown.
  - `vip:backToLobby` (FINAL) clears the game and the countdown (epoch bump), keeps players, settings and `placeUsage`, and clears `waiting`.
  - `archiveGame` adds `{number, revealedPhotoIds}` to `previousGames` at the rematch's New game and at Back to lobby (empty until Picture mode's tokens, F48).
  - Places across games needed no new code: `pickPlace` already prefers places without a `placeUsage` entry, and game numbers keep rising (DECISIONS 23).
- `server/sockets.ts`: `vip:rematch` shares Start's handler (the live category of `settings.categoryId`). `vip:rematchCancel` and `vip:backToLobby` join the plain VIP actions. A `rematchGo` timer is dispatched with the live category read when it fires.
- **Client:**
  - `PausedOverlay` now takes `countdownAt` and a `label`, so the rematch reuses the resume 3-2-1 ("Rematch in 3"). It sits over the final view on the Screen (`Screen.tsx`) and on the phone (`PlayGame.tsx`, where the final card is inert under it).
  - `VipDrawer.tsx` draws **Rematch** (primary, `min-h-16 text-2xl`, one tap, the drawer stays open), **Back to lobby** (two taps: "Tap again to go to the lobby") and, while counting, only **Cancel**. The F21 `shortcut:` comment is gone.
  - `Play.tsx` closes the drawer when the countdown ends.

**Decisions:** DECISIONS 32 covers:
- the live category, read at the tap and again at `rematchGo`;
- the refusal texts;
- no Screen needed for a Rematch;
- the epoch bumps;
- `waiting` cleared in the lobby;
- the `previousGames` entries;
- the drawer staying open for Cancel;
- the armed label.

**New dependencies:** none.

**Tests:** `npx vitest run server/reducer.vip.test.ts server/sockets.test.ts client/src/components/VipDrawer.test.tsx client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`
- `reducer.vip.test.ts`, "vip:rematch and vip:backToLobby":
  - rematch timing, with nothing reset and a second rematch refused;
  - refusals: from a non-VIP, outside FINAL, with a gone category and on a pool shortfall;
  - `rematchGo` into a New game (same players and settings, game number + 1, `previousGames`);
  - cancel, after which the `rematchGo` in flight is ignored;
  - nobody connected, and a category taken down meanwhile;
  - a VIP who dropped during the countdown, still replaced in the new game;
  - back to lobby: keeps players, settings and placeUsage, clears `waiting`, cancels a countdown;
  - placeUsage: after five of six Easy places were used, both a rematch and a lobby Start draw the sixth.
- `sockets.test.ts`: rematch refused while guessing; then rematch, cancel, rematch, `rematchGo` into a New game with the store's category; back to lobby refused from a non-VIP, then allowed.
- `VipDrawer.test.tsx`, "VipDrawer Rematch and Back to lobby": the FINAL list and only Cancel while counting; Rematch keeping the drawer open; Back to lobby taking two taps.
- `Play.test.tsx`: the 3-2-1 over an inert final, Cancel in the open drawer, the drawer closing at the new game's INTRO.
- `Screen.test.tsx`: the 3-2-1 over the final standings.

**Playtest** (Mika as VIP, Ana, the Screen), all passed with no console errors:
- FINAL drawer: Rematch, Back to lobby and Kick;
- "Rematch in N" on all three, with the drawer showing Cancel;
- Cancel cleared it everywhere, and no game started;
- a full rematch started a new game on both phones;
- Back to lobby took two taps and kept "5 ROUNDS · 30 S".

Not driven in the browser (covered by reducer tests): placeUsage across games, `previousGames`, and a rematch with nobody connected.

**Notes for next session:**
- The `shortcut:` comment in `VipDrawer.tsx` is closed: every drawer control is drawn.
- F48: `archiveGame` already reads `photoTokens[*].revealed`, but nothing sets `revealed` yet: set it in `startReveal` when tokens arrive, and test a game archived with a revealed token.

## F23 — Between-round settings (2026-11-07)
**What changed:**
- `server/reducer.ts`: `vip:roundSettings {timerSeconds?, rounds?}`, at SCOREBOARD only, checked against `room.vipId`, refused while paused (`ERRORS.paused`; F20 and F21's carried-over note is now closed). A total at or below the rounds played is refused (`roundsPlayed`). A changed total re-plans the levels with the existing `replan` (played rounds keep theirs) and checks the unplayed rounds against the unused places of the game's snapshot, refusing with the level named: "Japan · Medium has 4 cities left; the rest of the game needs 5." Multipliers needed no new code: `openRound` already takes `escalation(settings.rounds)`, and played rounds carry their own multiplier and points. The timer applies at the next GUESSING.
- `server/placePicker.ts`: `restShortfall` (unused places per level); `shared/placeCheck.ts`: `placeShortfall` now goes through `planShortfall(c, mode, plan, rest)`, which has the "left; the rest of the game needs" wording.
- `server/sockets.ts`: the `vip:roundSettings` handler (schema already existed), rate-limited as a VIP action.
- `client/src/components/VipDrawer.tsx`: the **Round settings** section on SCOREBOARD, Timer 20/30/45 s and Rounds 5/10/15 with the lobby's `Segmented` (now exported from `VipLobby.tsx`, with a `disabled` prop). Counts at or below the rounds played are disabled with "N rounds already played" under them. Each tap sends one change, the drawer stays open, the options are disabled while sending, and a refusal shows under the section. `Play.tsx` passes `settings` and the played count (the SCOREBOARD header's round number).

**Decisions:** DECISIONS 31: the refusal texts, the pool check for every difficulty, the drawer staying open, the gate label (the scoreboard keeps the played round's multiplier; the recomputed one shows from the next INTRO), and no saving to the remembered lobby settings.

**New dependencies:** none.

**Tests:** `npx vitest run server/reducer.vip.test.ts server/sockets.test.ts client/src/components/VipDrawer.test.tsx client/src/pages/Play.test.tsx`
- `reducer.vip.test.ts` "vip:roundSettings": 5 → 10 after 4 played keeps round 4 (×1.5, its points) unchanged, re-plans rounds 5–10, the Screen header reads 5/10 ×1 and 8/10 ×1.5, the new 45 s timer applies, and the game ends after 10 with multipliers 1,1,1,1.5,1,1,1,1.5,1.5,2; 10 → 5 refused at 5 played and allowed at 4; the Mixed refusal (5 of 10 played → 15 needs 5 Medium, 4 left) leaves the room untouched; a timer-only change; refusals outside SCOREBOARD, while paused and from a non-VIP.
- `sockets.test.ts`: an invalid total is refused by the schema, and `notNow` while guessing.
- `VipDrawer.test.tsx` "VipDrawer Round settings": shown on SCOREBOARD only with the current values pressed; counts disabled at or below the played count with the reason; one change per tap, the drawer staying open, options disabled while sending, a refusal under the section. The SCOREBOARD per-phase button list now includes the six segments (fixture update for the new section).
- `Play.test.tsx`: the ★ at the scoreboard after round 5 disables "5" and sends `{rounds: 15}`.

**Playtest** (VIP on a small phone, Ana on a Pixel 7, the Screen; 5 rounds Mixed 20 s), all passed with no console errors: no Round settings in GUESSING or REVEAL; at the first scoreboard 45 s and 10 pressed with the drawer open; the Screen reading "Round 2/10" and the timer starting at 45; rounds 2–5 at x/10; after round 5 "5" disabled with "5 rounds already played". The SCOREBOARD still auto-advances after 6 s while the VIP is in the drawer (spec timing). The pool refusal was not driven in the browser (reducer tests).

**Notes for next session:**
- The `shortcut:` in `VipDrawer.tsx` now names only Rematch, Back to lobby and Cancel (F24); the F21 and F22 notes that list Round settings are superseded.

## F22 — Kick, players list and VIP hand-off UI (2026-11-07)
**What changed:**
- The server side already existed: `vip:kick` (F06) removes the player, their aims, locks and result rows in every round, adds them to `kickedIds` and sends `kicked`; `removePlayer` re-checks `allLocked` (F15); `succeed` sends `fx vipNow` to a new VIP (F06). The kicked screen and the refused rejoin were F10's.
- `client/src/components/VipDrawer.tsx`: the **Players** section, drawn where the server lists `kick` (INTRO, GUESSING, SCOREBOARD, FINAL; not REVEAL). One row per player but the VIP (emoji, name, dimmed when disconnected) with its own two-tap **Kick** ("Tap again to kick", announced as "Tap again to kick Ana"), sending `vip:kick {playerId}`. "No other players" when alone. The sheet now scrolls (`max-h-[85dvh]`). `tap()` is generalised to a key and an emit, so the controls and the rows share the arm, send and refusal path.
- `client/src/pages/Play.tsx`: `VipToast`, "You're the VIP now ★" for 3 s on `fx vipNow`, `--board-panel` with a 1 px amber border at the top of the phone (z 1300). The ★ button is hidden in LOBBY (the server's lobby controls include `kick`, which would now draw it). At the final the ★ now shows, with Players.
- `client/src/components/ScreenGame.tsx`: the ★ (`aria-label="VIP"`) follows the name on the standings rows. The tile badge already followed `isVip`.

**Decisions:** DECISIONS 30: no ★ drawer in the lobby (lobby kick is in the Backlog), the Players list's order, dimming and empty state, a kick closing the drawer, the toast's placement, and the ★ on standings rows only (not the reveal rail).

**New dependencies:** none.

**Tests:** `npx vitest run server/reducer.vip.test.ts client/src/components/VipDrawer.test.tsx client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`
- `reducer.vip.test.ts` "vip:kick mid-game": a kick in GUESSING of the only unlocked player schedules `allLocked`, and the reveal scores only the VIP; a kick at SCOREBOARD drops their played-round rows, their standings row and their tile from the Screen view, and their rejoin is refused with "You were removed from this game". (`reducer.game.test.ts` already covered the GUESSING row removal.)
- `VipDrawer.test.tsx` "VipDrawer Players": the list per phase (none in REVEAL), the two-tap kick arming only its row and sending the id, "No other players".
- `Play.test.tsx`: the toast for exactly 3 s on `fx vipNow`; the ★ and a two-tap kick at the final. The kicked screen and refused rejoin stay covered by F10's "shows the kicked screen with a link home" and "shows a refused rejoin of a kicked player as the kicked screen".
- `Screen.test.tsx`: the ★ moves from Mika's to Sam's standings row and tile when `isVip` moves. The F18 standings row text now includes Mika's ★ (fixture change, not a loosened check).

**Playtest** (four phones and the Screen), all passed with no console errors: two-tap kick of Cy; Cy's phone shows the removal and still does after a reload and rejoin; Cy gone from the Screen; ★ on Mika's tile; Mika's Leave game gives Ana the toast and the ★ button; the ★ on Ana's tile, then on her standings row after her Next. `allLocked` after a kick was not driven in the browser (reducer tests).

**Notes for next session:**
- F21's note "Players (F22) not drawn yet" is closed; the `shortcut:` in `VipDrawer.tsx` now names only Round settings (F23) and Rematch, Back to lobby and Cancel (F24).
- F24: Rematch is drawn above Players at the final; the ★ already shows there.

## F21 — VIP drawer: Next, Skip round and End game (2026-11-07)
**What changed:**
- `server/reducer.ts`: `vip:next`, `vip:skipRound` and `vip:end`, each checked against `room.vipId`.
  - **Next:** REVEAL ends at once (`endReveal`: every row revealed, the round played) into SCOREBOARD, or FINAL after the last round; SCOREBOARD opens the next round. Refused while paused with "The game is paused".
  - **Skip round** (INTRO, GUESSING, REVEAL): bumps `timerEpoch` (new `bumpEpoch`, which `addReason` now shares and which re-schedules a pending `vipGone`), then **open round** with the same number. The voided round is dropped and its place stays in `usedPlaceIds`. "No spare places left at Hard" comes from `openRound`. A pause stays on.
  - **End game** (INTRO to SCOREBOARD): an unrevealed round is voided (`current = null`); a round in REVEAL counts as played (`endReveal(…, final)`). Lifts a pause and clears `screenAwayUntil`.
  - New error `notNow`: "You can't do that now".
- `server/sockets.ts`: the three handlers, rate-limited as VIP actions (the schemas already existed).
- **Client:** `client/src/components/VipDrawer.tsx` is new. It is a bottom sheet on `--board-panel` with a 16 px top radius, above the paused overlay (z 1150/1160). It draws the server's `vip.controls` for Next, Pause/Resume, Skip round and End game.
  - Two-tap confirms ("Tap again to skip", "Tap again to void this round" in REVEAL, "Tap again to end the game") reset after 3 s, and the armed label is announced.
  - An action that lands closes the drawer; a refusal shows inside it. "…" shows while sending.
  - It closes on an outside tap and on Escape, and focus goes back to ★.
- `Play.tsx` TopBar: the amber ★ button (48 px) shows only for the VIP when the drawer has controls. It closes the ⋯ menu and vice versa. The drawer is keyed on the phase, so a new phase starts disarmed.
- **Final with 0 rounds:** the Screen shows "No rounds played" instead of the board; the phone's pass shows it instead of the rank.

**Decisions:** DECISIONS 29 covers:
- the `notNow` text;
- skip keeping a pause, end lifting it;
- the epoch bump on skip;
- End game taking two taps in every phase;
- drawing only the controls whose actions exist (no ★ in LOBBY or FINAL until F22–F24);
- "No rounds played" on both finals.

**New dependencies:** none.

**Notes for next session:**
- `VipDrawer.tsx` has a `shortcut:` comment: Players (F22), Round settings (F23), Rematch, Back to lobby and Cancel (F24) are not drawn yet. Add each to `CONTROLS` with its feature. Once F24 draws Rematch, the ★ shows at the final too, including after "No rounds played".
- F23's `vip:roundSettings` must refuse with `ERRORS.paused` while paused (spec Transitions).
- F48: on skip and on end, drop the voided round's entry from `room.photoTokens`, so its photo stops being served. The drawer's Skip round should read "Skip round (photo missing)" when the photo is gone (spec Provider outages). The credits feature should decide whether a round skipped during REVEAL (its photo was shown) is credited.
- The drawer does not trap Tab: focus can reach the page behind the backdrop. Escape works from anywhere.

**How to try it:** `npx vitest run server/reducer.vip.test.ts client/src/components/VipDrawer.test.tsx server/sockets.test.ts client/src/pages/Play.test.tsx client/src/pages/Screen.test.tsx`. The tests cover:
- **Reducer** (16 tests):
  - next from REVEAL (all revealed, stale reveal timers ignored), from the last REVEAL to FINAL, and from SCOREBOARD to the next round;
  - next refused while paused, in INTRO/GUESSING and from a non-VIP;
  - skip in INTRO, GUESSING and REVEAL: same number, level and multiplier, a fresh place, voided results and locks, both places used, and the old timers stale;
  - skip keeping a pause, re-scheduling `vipGone`, the exhausted Hard pool refusal leaving the room untouched, and the refusal in SCOREBOARD;
  - end in INTRO, GUESSING (voided), REVEAL (played) and SCOREBOARD, while paused (lifted), and its refusals.
- **Gateway:** next refused while guessing, skip refused from a non-VIP, skip then end over sockets.
- **Drawer:** controls per phase and pause state, one-tap send and close, a refusal shown, Escape and outside tap, the two-tap confirms and their 3 s reset.
- **Pages:** ★ opens the drawer (not on its own), Resume sends and closes, focus returns, no ★ for non-VIPs or in the lobby; "No rounds played" on the phone and the Screen.

The playtest used Mika as VIP on a small phone, Ana on a Pixel 7 and the Screen, in a 5-round 20 s game. These passed, with no console errors:
- the drawer closed on arrival, and no ★ for Ana;
- the GUESSING controls;
- the Skip round arm and its 3 s reset;
- skip starting a fresh round;
- REVEAL's controls and Next to the scoreboard;
- the SCOREBOARD controls and Next to the next round's guessing;
- End game's two taps to FINAL.

One step was marked failed, by the probe, not the app: the round number. The phone shows no "Round N" text during guessing; the screenshot shows the next round running. Not seen in the playtest, but covered by reducer tests: the exhausted pool, end from INTRO, and "No rounds played".

## F20 — Pause and resume (2026-11-07)
**What changed:**
- `server/reducer.ts`: `vip:pause` / `vip:resume` and the `screenAway` reason.
  - **Pausing:** the first reason turns `Room.phaseTimers` into `paused.remainingMs` and bumps `timerEpoch`, so every timer in flight goes stale.
    - `Room.phaseTimers` is new: every phase timer's deadline, keyed `revealStep:k` per step, cleared on each phase change.
    - A pending `vipGone` is re-scheduled with the new epoch.
  - **While paused:** a phase timer that comes due (`allLocked` after a disconnect) is only stored, with its full delay. Aims and lock-ins are refused, as before.
  - **Resuming:** clearing the last reason sets `resumeAt` and schedules `resumeGo`. `resumeGo` restarts every stored timer at `now + remaining` and moves `endsAt` forward by `now − since`.
  - **Screen away:** a Screen count of 0 in a timed phase sets `Room.screenAwayUntil` (new) and schedules `screenGone`. If no Screen is back when it fires, the room pauses with `screenAway`; a Screen joining clears it.
  - `screenGone` and `resumeGo` are guarded by their exact `at`.
- `server/sockets.ts`: the `vip:pause` and `vip:resume` handlers, rate-limited as VIP actions.
- `server/views.ts` and `shared/types.ts`: `PausedView.since`.
- **Client:** `client/src/components/PausedOverlay.tsx` is new. It is an 85% `--board-bg` overlay showing the message, or the 3-2-1 in one 240 × 160 flap with a 200 px glyph.
  - **Screen:** the gate label already read "Delayed" in red. The timer stops at `endsAt − since`. A `--delayed` banner, "Delayed · the VIP paused the game", runs along the bottom above the join strip, then the overlay shows the 3-2-1.
  - **Phone:** `PlayGame` wraps every game phase, `inert` while paused, so the overlay covers everything under the top bar: "Delayed · the VIP paused the round" or "Waiting for the Screen…", then the 3-2-1. Both timers stop at `since`.
  - `StartOverlay` now sits above both overlays (z 1200).

**Decisions:** DECISIONS 28 covers:
- pausing only in the four timed phases, and the refusal texts;
- `phaseTimers` and `screenAwayUntil`, and the `at`-match guards;
- a new reason during the 3-2-1 cancels it;
- `PausedView.since`;
- the banner's place and no banner for `screenAway`;
- the phone overlay under the top bar.

**New dependencies:** none.

**Notes for next session:**
- F21 and F23 must refuse `vip:next` and `vip:roundSettings` with `ERRORS.paused` while `room.paused` is set. Those actions don't exist yet, so this Done-when part is carried over to them.
- `vip:skipRound` and `vip:end` must still work while paused (spec Transitions). A phase change while paused already empties `remainingMs` (`enterPhase`), and new phase timers are only stored until the resume. F21 should decide whether skip or end also lifts the pause.
- There is no Pause button yet: the VIP drawer is F21. The playtest drove `vip:pause` from a second socket with the VIP's key.
- The F18 and F19 `shortcut:` comments about the timer counting while paused are gone.

**How to try it:** `npx vitest run server/reducer.pause.test.ts server/sockets.test.ts client/src/pages/Screen.test.tsx client/src/pages/Play.test.tsx`. The tests cover:
- **Reducer** (17 tests):
  - pausing in INTRO, GUESSING, REVEAL (the held step, every remaining step and `revealDone`) and SCOREBOARD;
  - stale timers ignored, and aims and lock-ins refused, through the 3-2-1 too;
  - `endsAt` and `guessUp` moved by the pause, and `allLocked` both held and coming due while paused;
  - the refusals;
  - `screenAway`: set after 3 s, a Screen back in time, a stray second leave not moving the deadline, never in LOBBY or FINAL;
  - both reasons, where only the last one clearing resumes;
  - a pause during the 3-2-1;
  - a VIP who disconnects while paused is replaced and the new VIP resumes;
  - `vipGone` re-scheduled by the epoch bump.
- **Gateway:** pause and resume over sockets, then a Screen disconnect pausing with `screenAway`.
- **Screen:** "Delayed" in red, the timer frozen while the clock moves, the banner, then 3-2-1 → 2; no banner for `screenAway`.
- **Phone:** the cover messages, Lock in disabled, the covered content `inert`, the frozen timer, the top bar outside the overlay, the 3-2-1, and back to play.

The playtest used the Screen, the VIP and a phone. It passed:
- the VIP pause on the phone and on the Screen (the timer held at 20);
- aims and lock-ins refused;
- the 3-2-1, after which the timer resumed at 20;
- `screenAway`, by closing the Screen tab, then the Screen coming back and the countdown running.

There were no console errors. Not seen in the playtest:
- the gate label's colour (covered by unit tests);
- pauses in INTRO, REVEAL and SCOREBOARD (reducer tests).

## F19 — Phone game views (plain) (2026-11-07)
**What changed:**
- `client/src/components/PlayGame.tsx`, routed from Play.tsx for every phase after LOBBY:
  - **Intro:** one map per round on the region box, `inert`, with a centred "Round 3 of 10" card (and "×1.5 Bonus round" / "×2 Final round"). The prompt bar reads the gate label. The same map carries into GUESSING (keyed on the round number).
  - **Guessing:** the prompt bar (name, or a plain thumbnail in Picture mode) with the timer from `endsAt` (red in the last 5 s), the map clamped to `clampBounds(box)` with `maxBoundsViscosity: 1.0` (World: no clamp, `worldCopyJump`), the crosshair and Lock in. Lock in sends once and stays disabled until the ack; a refusal shows over the map. A refreshed participant's map opens on `myAim`.
  - **Locked in:** a pass "Boarding · Locked in" with the timer, the still-guessing emoji ("Everyone has locked in" when none) and a 180 px non-interactive mini map with the player's pin at the zoom they locked in at.
  - **Reveal/Scoreboard:** a face-down card until `myResult` arrives, then the result pass: distance, base points, multiplier above ×1, round points, total, and BULLSEYE / CLOSEST stamps. On the scoreboard it adds the rank and "Next: Round N+1 of T". Missed (or no row on the scoreboard): "Missed this round · 0".
  - **Waiting:** "Next departure · You're in from round N+1. You start at 0." ("from the next game" past the last round). **Final:** own rank and points.
- `MapView`: `maxBounds`, `initialCentre`, `onAim` (one send per 250 ms on `move`, plus every `moveend`, from `getCenter().wrap()`), and `onLockIn` now also gets the zoom. `useLeafletMap`: `maxBounds` option.
- `server/views.ts` / `shared/types.ts`: `myResult` is a `MyResult`, with `closest` and `totalAfter` added.
- `RevealMap.pinIcon` is exported and takes a size (32 px on the phone). `shared/constants.ts`: `AIM_THROTTLE_MS`, `WORLD_ID`. `ordinal` now comes from `shared/scoring.ts` (the client copy is gone).

**Decisions:** DECISIONS 27 covers:
- `closest` and `totalAfter` on `myResult`;
- the rank only from the scoreboard, and World with no `maxBounds`;
- the intro layout, the aim and lock-in behaviour, and the mini map's zoom after a refresh;
- the waiting copy, and the stamp colour on passes.

**New dependencies:** none.

**Notes for next session:**
- Remaining `shortcut:` comments in PlayGame.tsx:
  - F20: the timer keeps counting while paused. Lock in is already disabled while `paused`, but there is no overlay yet.
  - F49: the Picture prompt is a plain thumbnail.
  - F54: plain passes and a plain face-down card, with no flip. F57: the prompt name wraps at 20 px rather than shrinking. F28: the final shows only the own standing, no awards.
- Unlocked players are scored at their last aim (F16), so "Missed this round" appears only for a participant who never connected during GUESSING. A missed row arrives at SCOREBOARD.
- The locked-in zoom lives only in the client. After a refresh the mini map uses the region box's fit.

**How to try it:** `npx vitest run client/src/pages/Play.test.tsx server/views.test.ts`. The new tests cover:
- the intro (inert map, multiplier, padded `maxBounds`);
- the same map kept into guessing, with the prompt and timer;
- World with no clamp;
- the aim throttle with fake timers (5 moves → 1 send, 200 ms → still 1, 250 ms → 2, `moveend` → 3), and no aim in the intro;
- lock-in once, then the locked card with the timer, the still-guessing emoji and a mini map at the zoomed-in lock zoom;
- a refused lock-in;
- face down until `myResult`, then the pass (Closest, ×1.5, total, no rank);
- the scoreboard pass with Bullseye, rank and next round;
- the missed card, the waiting card (both copies) and the final;
- `closest` and `totalAfter` in `views.test.ts`.

The playtest drove a 5-round Name game with three phones, a late joiner and the Screen. Intro, guessing, locked-in card, result card, scoreboard, waiting card and final all passed, with no console errors. Two of its checks failed for reasons that match the spec:
- an aim gap of 165 ms, which is `moveend` following a throttled `move`;
- no "Missed" card, because idle players score at their aim.

The flip timing against the TV is a Kim check.

## F18 — Screen game views (plain) (2026-11-07)
**What changed:**
- `client/src/components/ScreenGame.tsx`, with Screen.tsx routing on the phase:
  - **Intro:** the gate label at the centre ("Round 3/10 · Now boarding"), plus the "×1.5 Bonus round" / "×2 Final round" row on boosted rounds.
  - **Guessing, Name mode:** the gate label top left; the timer top right in whole seconds from `endsAt` on the server clock, red with "Final call" in the last 5 s (`FINAL_CALL_MS`); the display name in 22-cell prompt flaps; player tiles that turn amber with "Locked in".
  - **Reveal:** a band with the name in flaps (after the target lands) and the fact; the map on the left (1340 px) and the rail on the right (580 px).
    - Rail rows: rank chip, emoji, name, distance, points or "×1.5 → 1,218", and the BULLSEYE / CLOSEST / NOT LOCKED IN tags. Missed players come last with "—".
  - **Scoreboard and Final:** rank, emoji tile, name in flaps, round points, total and ▲/▼ movement.
- `client/src/components/RevealMap.tsx`: a non-interactive Leaflet map (the new `interactive: false` option of `useLeafletMap`).
  - It is fitted once to the target and every pin with 80 px padding, never past zoom 11.
  - Pins show from the start, the target from `target`, and a geodesic line for each of the first `revealedCount` rows.
  - Pins are built as DOM elements (no HTML strings) and moved to the target's side of the antimeridian.
- `client/src/components/PlayerTile.tsx`: moved out of Screen.tsx. It gains `lockedIn`, which is guessing only and reserves its label row so tiles never shift.
- `client/src/lib/format.ts`: `flapRows`, `gateLabel`, `multiplierRow` and `formatMovement`. `client/src/lib/useServerNow.ts` re-reads the server clock every 250 ms. `shared/constants.ts`: `FINAL_CALL_MS`.

**Decisions:** DECISIONS 26 covers:
- gate label text, the intro's multiplier row, and the timer's rounding;
- the 22-cell wrap, the band before the target lands, and when missed rows show;
- the rank chip, the boosted points' end state, and the fit including the target from the start;
- rail rows shrinking to 64 px so 12 fit.

**New dependencies:** none.

**Notes for next session:**
- F19 can reuse `gateLabel`, `flapRows`, `useServerNow`, `FINAL_CALL_MS` and `formatKm`.
- Remaining `shortcut:` comments:
  - F20: a paused round's timer keeps counting (`ScreenGuessing`). Stop it while `gate` is `delayed`, and add the banner.
  - F49: the Picture prompt shows a placeholder line; the reveal band's thumbnail and credit are also missing.
  - F54: pins are plain circles anchored at their centre, and the target does not pulse.
  - F53: flaps are static. F55 adds the scoreboard slide. F28 adds the finale.
- A missed row shows on the rail only once every scored row is in. A missed participant is one who never connected during GUESSING; an unlocked player is scored at their aim.

**How to try it:** `npx vitest run client/src/pages/Screen.test.tsx client/src/lib/format.test.ts`. The new tests cover:
- Intro with and without the multiplier row;
- Guessing: gate label, flaps, locked-in tiles, no map;
- the timer from `endsAt` with a 2.5 s clock offset (12 → 5 red "Final call" → 0);
- Reveal: pins first, then the name, fact and target, then rail rows in order with lines, tags, and the missed row last;
- the fit (80 px, zoom 11), the 22-cell wrap, and "+points" at ×1;
- Scoreboard and Final rows with movement;
- format helpers.

Two of my own test fixtures were wrong ("Santiago de Compostela," is 23 cells, and a ×1 single row is also Closest); I corrected the expectations, not the code.

The playtest drove a 5-round game: the Screen at 1920 × 1080, the VIP on a phone, and two socket bots. Intro, the Guessing timer and Final call, Reveal (band, 3 pins and the target, lines 1→3, rail in order), Scoreboard and Final all passed with no console errors. Not seen in the playtest: a "—" row and a boosted intro (both covered by unit tests).


## F17 — Game views and the leak test (2026-11-07)
**What changed:**
- `server/views.ts` fills the game phases of `toView`:
  - `round` (both roles, INTRO on; the last played round in SCOREBOARD and FINAL): number, total (`settings.rounds`), multiplier, `endsAt`, and the prompt. Name mode gives `{kind: 'name', displayName}`. Picture mode gives `/api/photos/<token>` (phones also get `…/thumb`) and a credit that always hides the author until F48.
  - Screen: `gate` (`nowBoarding` / `boarding` / `delayed` when paused) and `lockedIn` ids. Phone: `myLock`, the new `myAim` (own aim only, for the reconnect rule) and `stillGuessing` emoji (INTRO and GUESSING only).
  - `reveal` (Screen, REVEAL only): name, display name, fact, position, full credit and photo URL in Picture mode, every result row, `revealStage`, `revealedCount`.
  - `standings` (SCOREBOARD and FINAL): rank order, round points, total and movement since the last board (0 on the first).
  - `myResult`: in REVEAL only once `revealedCount` is past the viewer's index; from SCOREBOARD on, the viewer's row of the last played round (the missed row included).
  - `final` stays null until F27/F28 (`shortcut:` comment).
- `shared/types.ts`: `PlayerView.round.myAim`.
- `server/sockets.ts`: a SPEC-QUESTION comment on the lock-in's state broadcast (unchanged behaviour).

**Decisions:** DECISIONS 25: the round header past REVEAL, gate, standings order and movement, `myResult` timing, `stillGuessing`, `myAim`, the lock-in's role-filtered state broadcast, and the fail-safe guessing credit until F48.

**New dependencies:** none.

**Notes for next session:**
- F18 and F19 render from these fields. Use `closestIds(reveal.results)` for CLOSEST, show the first `revealedCount` rows on the rail, and put missed rows (`distanceKm === null`) last with "—".
- The phone's "Next: Round N+1 of T" in SCOREBOARD is `round.number + 1` of `round.total`.
- `toView` throws if a round's place is missing from `game.pool`. The reducer never allows that, but the throw would stop a broadcast.
- An aim still sends no state, so `myAim` arrives with the next broadcast (a rejoin always sends one).
- F48 must replace the guessing-credit shortcut with the author rule. The leak test bans 'Jane Doe' before REVEAL in Picture mode, so the F48 fixture needs an author that shares a word with the answer to stay banned, plus one that doesn't for the shown case.
- F20 (pause) gets `gate: 'delayed'` for free.

**How to try it:** `npx vitest run server/views.test.ts server/sockets.test.ts`. The new tests are:
- the leak test, in Name and Picture mode: every Screen, player and VIP view in LOBBY, INTRO, GUESSING, and GUESSING with an aim and two locks. It checks the target's lat and lng at 1–4 decimals (signed and unsigned), `lat,lng`, the Wikidata id, country id and name, fact, place ids, photo id, Commons file, and in Picture mode the name and author. It also checks other players' aims and locks, and proves the fixture is live by finding the secrets once the round reveals;
- own aim and lock only;
- header, gate, prompt and region from INTRO, with the VIP controls;
- lock-ins in GUESSING; the Picture prompt and thumb; Delayed while paused;
- REVEAL: the answer and every row on the Screen, and each player's result appearing exactly at their step, the missed one from SCOREBOARD;
- standings with movement 0 then ▲1 / ▼1, through to FINAL;
- socket: aim and lock-in send other devices only `fx lockedIn` (Screen) and position-free state.

There is no UI yet, so there are no Kim checks.

## F16 — Reducer: scoring, reveal, scoreboard and final (2026-11-07)
**What changed:**
- `shared/scoring.ts`: `revealStepMs(n)` gives STEP `= clamp(round(7500 / n), 600, 1800)`, with n = 0 giving 1800. `closestIds(results)` gives every scored player tied at the smallest distance, which is the **Closest** tag. Closest is derived, not stored.
- `server/reducer.ts`, timers now go through `timer()`, keyed on phase and timer name:
  - `guessUp`, or `allLocked` (re-checked when it fires), runs `startReveal`. It scores every participant:
    - a locked player at their lock;
    - an unlocked one at their last aim, else at `mercatorCentre(game.box)`, with `lockedIn: false`;
    - a participant never connected during GUESSING scores 0 with a null position.
  - `startReveal` sorts the scored rows by distance descending, ties by `joinedAt`, then puts the missed rows after them. It enters REVEAL and schedules `revealTarget` (+1.5 s), `revealStep k` (+3 s + k × STEP, with `k` carried on the timer) and `revealDone` (+3 s + n × STEP + 1.5 s).
  - `revealTarget` sets `revealStage` to `target`. `revealStep k` sets it to `lines`, with `revealedCount = k + 1`.
  - `revealDone` sets the stage to `done` and every row to revealed, pushes the round into `game.played` and sets `current` to null. It then goes to SCOREBOARD (`scoreboardDone` in 6 s), or to FINAL after round `settings.rounds`.
  - `scoreboardDone` opens round last + 1, and waiting players come in at that point.
  - In SCOREBOARD and FINAL, timers carry the last played round's number.
  - Bug fix: `vipGone` no longer checks the round number, only its exact `at`, the game and the epoch. Before, a VIP who dropped mid-game was never replaced once the next round opened.
- `server/sockets.ts` passes `k` back with the timer.

**Decisions:** DECISIONS 24: missed rows go after the scored ones and are never a step; Closest is derived; `k`; when a round counts as played; timer round numbers in SCOREBOARD and FINAL; `vipGone` ignores the round number.

**New dependencies:** none.

**Notes for next session:**
- F17 and later views:
  - Use `closestIds` for the Closest tag.
  - Show only rows below `revealedCount` on the rail, and show a player's `myResult` only past their index. Missed rows become visible at `revealDone`.
  - Extend `server/views.test.ts` with REVEAL at `revealedCount` 0 and at k.
  - Totals change only when the round enters `played` at `revealDone`.
- F21 adds `vip:next` in REVEAL (set `revealedCount` to all, then call `endReveal`) and in SCOREBOARD (open the next round). Neither is handled yet.
- F20 must keep `k` when it re-schedules `revealStep`, and must re-schedule `vipGone` on an epoch bump.
- F24's Back to lobby clears the game, so a pending `vipGone` from the game no longer matches on game number and must be re-scheduled.
- A leave during REVEAL shrinks `results`. Later `revealStep` timers clamp `revealedCount` to the scored rows. There is no test for this yet.

**How to try it:** `npx vitest run server/reducer.game.test.ts shared/scoring.test.ts`. The new tests cover:
- time-up scoring at the lock, at the aim, at the centre, and a missed participant, with the reveal schedule for n = 3;
- reveal order and tied Closest players through `allLocked`, with a late `guessUp` ignored;
- `allLocked` ignored after a reconnect;
- n = 0, where only the target is revealed and the reveal is done at 4.5 s;
- the stage and count advancing, then SCOREBOARD, the next INTRO with the waiting player let in, and round 1's timers stale in round 2;
- a full 5-round game to FINAL (multipliers 1, 1, 1, 1.5, 2; totals 6500 and a shared rank 2 in `toView`);
- `vipGone` across rounds;
- STEP for n = 1, 8, 12 and 0.

There is no UI yet, so there are no Kim checks.

## F15 — Reducer: start, intro and guessing (2026-11-07)
**What changed:**
- `server/reducer.ts`:
  - `vip:start {category}`: VIP and LOBBY only. It needs a connected player, a Screen, a live category and `poolShortfall` to pass. It then runs **New game** (number, category name, emoji, box, `regionScale`, label style, `snapshotPool`, `levelPlan`) and **Open round** (`pickPlace` on `levelPlan[n − 1]`, `rngState`, `usedPlaceIds`, `placeUsage`, the multiplier from `escalation(settings.rounds)`, waiting players let in, INTRO, `introDone` in `INTRO_MS`).
  - `introDone` in INTRO → GUESSING: `startedAt`, `endsAt`, the participants (non-waiting players in join order), `everConnected`, and `guessUp` at `endsAt + GRACE_MS`.
  - `player:aim` stores the aim with no effects. `player:lockIn` stores `{lat, lng, at}` once and sends `fx lockedIn` to the Screens.
  - `allLocked` (at least one connected participant, and every connected one locked) is scheduled in `ALL_LOCKED_MS` when it turns true, on a lock-in, a disconnect, a kick or a leave.
  - A reconnect during GUESSING adds the player to `everConnected`. Kick and leave remove the player's rows from every round.
- `server/sockets.ts`: handlers for `vip:start` (passes `categories.get(room.settings.categoryId)`), `player:aim` (8 per second per socket; over the limit it is dropped with an ok ack, and there is never a state broadcast via `dispatch(…, false)`) and `player:lockIn` (2 per second per socket, "Slow down").
**Decisions:** DECISIONS 23: the refusal texts and their order, the game number across Back to lobby, `allLocked` needing a connected participant, and the aim ack and no broadcast.
**New dependencies:** none.
**Notes for next session:**
- F16 handles `guessUp` and `allLocked` in GUESSING. Today the `timer` case ignores them (the `shortcut:` comment), so a game stays in GUESSING.
- The `allLocked` handler must re-check `allLocked(d)` and ignore the timer when it is false. A reconnect does not cancel a pending one, and a duplicate can be scheduled after a reconnect.
- F16's Open round for round 2 onwards reuses `openRound(d, n, now, fx)`, which already lets waiting players in. The reducer test for "waiting players join at the next Open round" belongs with F16's full-game test, because nothing reaches round 2 yet.
- F20 bumps `timerEpoch`. F48 adds `photoToken` and the missing-photo drop before `snapshotPool` (both `shortcut:` comments).
- The client still shows the bare phase name after Start: the views are F17 and F18/F19.
**How to try it:** `npx vitest run server/reducer.game.test.ts`, 20 tests:
- start runs New game and Open round;
- refusals: no Screen, no connected player, too few places (named), no category, non-VIP, outside LOBBY;
- introDone → GUESSING with clock, participants, everConnected and guessUp;
- a reconnect adds to everConnected;
- the aim is silent;
- the lock is final and goes to Screens only;
- outside GUESSING and while paused;
- allLocked after the last lock, ignoring the disconnected, after the only unlocked player disconnects, is kicked or leaves, and not when everyone disconnects;
- stale round, game and epoch timers ignored, and introDone ignored in GUESSING;
- a join in INTRO plays and a join in GUESSING waits.

`server/sockets.test.ts` adds:
- Start over a real socket with and without a Screen;
- aims produce no events and 9+ per second are dropped;
- the lock-in limit and `lockedIn` to Screens only.

No UI and no Kim checks.

## F14 — Place picker (2026-11-07)
**What changed:**
- `server/placePicker.ts` (new, pure): `mulberry32(state) → {value, state}`; `snapshotPool(category, mode, plan)` deep-copies the live places of the mode's kind for every level in the plan (the future `game.pool`); `pickPlace(levelPool, usedPlaceIds, placeUsage, rngState) → {place, rngState} | null` skips used places, prefers places with no `placeUsage` entry, then the lowest game number, and breaks ties with one PRNG draw; `poolShortfall(categoryName, pool, mode, difficulty, rounds)` gives the Start and Rematch refusal on the snapshot ("Japan · Hard has 8 landmarks; this game needs 10.") through `shared/placeCheck.ts` `placeShortfall`.
- Nothing calls it yet: no reducer, gateway or UI change.
**Decisions:** DECISIONS 22: one PRNG draw per pick; no entry counts as game −∞; the caller chooses the level and records the pick; snapshot is a deep copy of the mode's kind; the check runs on the snapshot and ignores `placeUsage`.
**New dependencies:** none.
**Notes for next session:** F15 (New game / rounds) builds `levelPlan` with `shared/scoring.ts`, calls `snapshotPool` (in Picture mode, the gateway first drops places whose photo file is missing and passes the filtered category or pool in the action), refuses with `poolShortfall` when it returns text, then per round calls `pickPlace(game.pool[levelPlan[n − 1]], game.usedPlaceIds, room.placeUsage, room.rngState)` and stores the new `rngState`, appends to `usedPlaceIds` and sets `placeUsage[id] = game.number`. A Skip picks again the same way. Reuse `mulberry32` from here rather than adding a third copy (`server/codes.test.ts` has its own). The mid-game round-count refusal ("fewer unused places left than remaining rounds") is the round-count feature's, built on the same pool and `usedPlaceIds`.
**How to try it:** `npx vitest run server/placePicker.test.ts` (12 tests: mulberry32 pure step; snapshot keeps the mode's kind per needed level and ignores later edits; no repeat across 10 draws on a pool of 6 then null; unused first; then LRU; deterministic for a seed and ties vary across seeds; returned state advances; refusals for a single level, Mixed 10 (3 · 4 · 3), earlier-used places still available and drawable, singular noun). No UI and no Kim checks.

## F13 — VIP lobby settings and category picker (2026-11-07)
**What changed:**
- `shared/placeCheck.ts` (new): `placeShortfall(category, mode, difficulty, rounds)` returns null or the spec's refusal ("Japan · Hard has 8 landmarks; this game needs 10.", singular "1 landmark"), checking each level's share of `levelPlan` (Mixed 5 = 2 · 1 · 2). `categoryOffered` (some level has `MIN_PLACES_TO_OFFER` places in the mode) and `levelCount` are exported too. The lobby uses it now; F15's Start and F24's Rematch must call it for their refusals.
- Reducer `vip:settings` (VIP only, LOBBY only): rejects a `categoryId` not in `liveIds` ("That category is not available"), else merges into `room.settings`. The gateway handles `vip:settings` through `asVip` and passes `categories.summaries()` ids. `attachSockets` takes `categories` (a `CategoryStore`, wired in `server/index.ts`).
- Views: `categoryName` and `hasCategories` in every role, and `vip.categories` (the live list) and `vip.screenCount` in the VIP's. `ViewContext` carries `categories`.
- `client/src/components/VipLobby.tsx` (new): the settings card above the practice map. It has category cards (emoji, name, per-level counts in the mode, greyed "Not enough cities yet"), a search box over 8 categories, Mode, Difficulty, Rounds and Timer segmented controls (unavailable ones disabled, with their reasons under them), and Start ▶ with its reason (no destinations, "Open the Screen first", "Pick a category", the place count). Every tap sends `vip:settings`; the card renders only the server's settings. Refusals show in red under Start.
- `client/src/lib/vipSettings.ts` (new): the remembered settings under `pinpoint:vipSettings`, validated field by field on read. `initialSettings` keeps the remembered category only while it is live, else World (id `world`) or the first by name. The card applies them once per mount when the room has no live category, and saves the room's settings whenever they name a live category.
- `lib/format.ts` `settingsLine(view)` gives "WORLD · NAME · MIXED · 10 ROUNDS · 30 S", with no category segment before one is picked, plus `NO_DESTINATIONS`. The Screen lobby shows the row under the tiles (40 px board face) and the phone shows it under the waiting line. With no live category both show "No destinations yet. Check back soon." as body text. The VIP phone shows that line only in the card, and its "You're the VIP ★" line is replaced by the card.
**Decisions:** DECISIONS 21: `vip:settings` checks only the category; the new view fields; the greying rules and reason order; World is id `world`; when the remembered settings are applied and saved; Start sends `vip:start` with no handler yet; the surfaces inside the card; no text on `--amber-dim`.
**New dependencies:** none.
**Notes for next session:** F14's `server/placePicker.ts` can reuse `placeShortfall` for its refusal text instead of a second copy. F15 adds the `vip:start` gateway handler and reducer case: Start ▶ already emits `vip:start {}` and shows a refused ack under the button. Until then a tap does nothing. `vip:settings` stores any mode, difficulty and round count for a live category, so Start must run `placeShortfall`. The ★ VIP drawer button is F21's. Review items left: the reason lines mount and unmount under their controls (a small layout shift), and Difficulty and Rounds reasons do not repeat the option name (the text names the level and the count already). Leak test: when it gains category fixtures, avoid a category named like one of its places.
**How to try it:** `npm test` (shared/placeCheck.test.ts 4: single level, Mixed shares, singular noun, offering; server/reducer.lobby.test.ts `vip:settings` 3: stores, unknown or hidden category rejected, VIP and lobby only; server/views.test.ts category fields per role; server/sockets.test.ts `vip:settings` over a real socket against the dev fixture; client/src/components/VipLobby.test.tsx 12: World first, first by name, remembered settings applied and saved, a dead remembered category and junk ignored, a set-up room left alone, taps and refusal, greyed rounds with reasons, greyed category, levels and Mixed in Picture mode, Start reasons and `vip:start`, empty state, search over 8; Screen.test.tsx settings row and empty line; Play.test.tsx no-destinations line on a non-VIP phone). `npm run dev`, then **Show** on http://localhost:5180 and join at http://<laptop-ip>:5180/play/CODE from a phone. The first phone gets the card with World (dev) picked, and changes appear on the Screen's row. Playtest: `.playtest/F13/scenario.ts` (defaults, World preselected, Screen row, Start enabled once a Screen is open, changes reach the Screen, remembered settings in a new room, no card on a second phone) and `picture.ts` (Picture mode greying on the fixture, which has no landmarks).

## F12 — Crosshair map and practice (2026-11-07)
**What changed:**
- `client/src/lib/tiles.ts`: `loadTileConfig` fetches `/api/config` once per page into the `useTiles` Zustand store. `shouldUseFallback`/`createTileWatch` hold the switch rule: 4 or more CARTO tile errors in the last 10 s with no CARTO tile loaded in that window. One page-wide watch (`reportTileLoad`/`reportTileError`) flips `fallback`, so every map on the page moves to the fallback until a reload. `currentLayer` picks CARTO, or the fallback when switched or when there is no key.
- `client/src/lib/useLeafletMap.ts` (Leaflet directly, no react-leaflet) returns a callback `ref`, the `map`, the current `layer` and `fallback`. Maps are built once per element and fitted to the `box`, with `maxZoom` 13, `worldCopyJump` optional, and Leaflet's zoom and attribution controls off. The tile layer gets `maxNativeZoom` from the config, `keepBuffer: 1` and `updateWhenZooming: false`. CARTO tile load and error events feed the watch.
- `components/MapView.tsx` puts the map in a container with `role="application"` and "Map. Pan to aim the crosshair.", where Enter on the focused map locks in. It adds `Crosshair` (44 px amber cross, 8 px gap, 2 px `--board-bg` outline, `pointer-events: none`), + and − buttons at 48 px on the right edge, the "Simplified map" badge on the fallback, and an 11 px attribution line that is always visible. **Lock in** (64 px, full width minus 16 px) sends `map.getCenter().wrap()`. The optional `result` prop takes Lock in's place.
- In the phone lobby (`pages/Play.tsx`), "Practice: find 0°, 0°" and `PracticeMap` add `MapView` on `WORLD_BOX` (unclamped, `worldCopyJump`). Lock in emits `player:practice`. The result line "1,240 km from 0°, 0°" (`lib/format.ts` `formatKm`, one decimal under 10 km) or a refusal shows with **Try again** for 3 s.
- `pages/Screen.tsx`: `fx practice` wiggles that player's tile for 600 ms. CSS `tile-wiggle` rotates ±8°; with reduced motion it shows a 600 ms amber outline instead.
- Server: the reducer's `player:practice` (LOBBY only, and the sender must be a player) sends `fx practice {playerId}` to Screens and `fx practiceResult {distanceKm}` to that player only. Nothing is stored. The gateway limits it to 1 per 2 s per player (`practiceLimiter`, keyed by code and player, "Slow down"). New constants in `shared/constants.ts`: `WORLD_BOX`, `PRACTICE_TARGET`, `MAP_MAX_ZOOM`, `TILE_ERROR_LIMIT`, `TILE_ERROR_WINDOW_MS`, `PRACTICE_RESULT_MS`.
**Decisions:** DECISIONS 20: the limit lives in the gateway and runs before the reducer; the World box; the 3 s result and Try again; the attribution line and when the badge shows; the literal 4-error switch (a phone at world zoom that requests only 3 CARTO tiles stays blank until the player zooms or pans); and the wiggle.
**New dependencies:** `leaflet` and `@types/leaflet` (dev, like the other client libraries Vite bundles): the stack's map library, used directly as the spec asks (no react-leaflet).
**Notes for next session:** `useLeafletMap` builds the map once per element, so a new box needs a new `MapView` (key it on the round). F13 puts the VIP settings card above the practice map in `Lobby`. The round map (F14 onwards) adds `maxBounds` from `clampBounds` with `maxBoundsViscosity: 1`, `minZoom` fitting the padded box, the `player:aim` throttle on `move`/`moveend`, and the Screen-size attribution (16 px); `MapView` is phone-only for now. Review items left: the Screen tile keeps its `tile-wiggle` class after the animation until the next fx, so a remount replays it; Leaflet's own pan and zoom animation ignores reduced motion; the phone page has no `h1`.
**How to try it:** `npm test` (client/src/lib/tiles.test.ts 4 tests on the switch rule; client/src/components/MapView.test.tsx 4: crosshair and zoom buttons, Lock in and Enter send the centre, the CARTO-to-fallback switch with badge and attribution, fallback without a key; Play.test.tsx practice flow; Screen.test.tsx wiggle; server/reducer.lobby.test.ts practice effects and refusals; server/sockets.test.ts 1 per 2 s per player). Run `npm run tiles:fallback` once, then `npm run dev`. Click **Show** on http://localhost:5180, then join on a phone on the same Wi-Fi at http://<laptop-ip>:5180/play/CODE, pan, and press Lock in. Playtest: `.playtest/F12/scenario.ts` (map UI, practice result and wiggle, 3 s clear, Try again and the rate limit, pan and lock in, and the tile-error switch after a zoom with an unreachable CARTO host).

## F11 — Map config and fallback tiles (2026-11-07)
**What changed:**
- `GET /api/config` (`server/http.ts`, built by `tileConfig` in `server/fallbackTiles.ts`): `{tiles, fallbackTiles}` as `ConfigResponse`/`TileLayerConfig` in `shared/types.ts`. `tiles` is CARTO `dark_nolabels` with `PINPOINT_CARTO_KEY` URL-encoded into `?key=` (maxNativeZoom 20, "© OpenStreetMap contributors © CARTO"), or null without the key. `fallbackTiles` is `/tiles/fallback/{z}/{x}/{y}.png` (maxNativeZoom 6, "Made with Natural Earth"). `Cache-Control: no-store`, since the body carries the key. `index.ts` passes `env.cartoKey` in as the `cartoKey` option.
- `GET /tiles/fallback/:z/:x/:y.png` serves `{z}/{x}/{y}.png` from `fallbackTilesDir` (default `server/assets/fallback-tiles`, relative to the working directory) with `Cache-Control: public, max-age=2592000, immutable`. A valid address with no file gets the shared `water.png`. Anything outside zoom 0–6 or the zoom's grid, or anything that isn't digits, is a 404, as is any request when nothing has been rendered. A read error other than not-found goes to the error handler instead of quietly serving sea.
- `npm run tiles:fallback` (`scripts/render-fallback-tiles.ts`) renders `world-atlas` `countries-10m.json` with `topojson-client`, `d3-geo` (Web Mercator) and `@resvg/resvg-js` in the spec's colours: water `#0A0B0D`, land `#17181B`, coastline mesh `#3A3D44` at 1 px, country-border mesh `#4A4E57` at 0.75 px. The output is 3,295 tiles plus one `water.png` (22 MB, about 6 minutes) in the gitignored `server/assets/fallback-tiles/`.
**Decisions:** DECISIONS 19 (CARTO maxNativeZoom and attribution, the tiles folder and its layout, the water fallback, the render shortcuts, Docker layer advice).
**New dependencies (all dev):** `world-atlas` (the Natural Earth 10m TopoJSON the spec names), `topojson-client` (TopoJSON to GeoJSON and meshes), `d3-geo` (Web Mercator projection and clipping to SVG paths), `@resvg/resvg-js` (SVG to PNG without a browser), and `@types/topojson-client` and `@types/d3-geo` for their types.
**Notes for next session:** F12 (MapView) reads `/api/config`; use `tiles ?? fallbackTiles`, plus the client switch after 4 errors in 10 s. Run `npm run tiles:fallback` once in a fresh worktree, or the fallback route returns 404s. F60's Dockerfile must render the tiles in the build stage, in a layer that depends only on the script and the lockfile (it takes 6 minutes), and copy `server/assets/fallback-tiles/` to the runtime image at the same path relative to `WORKDIR`. Gotchas: resvg loads system fonts by default, which costs about 6 s per tile, so it is turned off; d3's resampling runs before the clip, so it is turned off too. A few Maldives islets in the 10m data are wound inside out and get reversed.
**How to try it:** `npm test` (server/http.test.ts: config with and without the key, key never logged, three-tile fixture, cache headers, water fallback, 404s out of range and when nothing is rendered; scripts/render-fallback-tiles.test.ts: zoom 0 is a 256 × 256 PNG, open sea returns null). Then run `npm run tiles:fallback`, then `npm run dev`. `curl -s localhost:3010/api/config` gives `tiles: null`, or the CARTO URL when `PINPOINT_CARTO_KEY=x` is in the environment. Open http://localhost:3010/tiles/fallback/0/0/0.png (the world) and …/6/33/22.png (Switzerland). There is no UI yet and there are no Kim checks (the real CARTO key is already DECISIONS 6's F60 check).

## F10 — Player join and lobby (2026-11-07)
**What changed:**
- `pages/Play.tsx` replaces the placeholder. **Join form**: name (16 max), a 6 × 4 grid of radio emoji (taken ones disabled at 30%, first free pre-selected), **Join** (shows "Join…" until the taken list arrives). Refusals come back inline under the name with the fields kept ("That name is taken", "That emoji is taken", "This game is full (12 players)", the join limit). **Phone lobby**: top bar (emoji, name, "0 · 1st of 3", connection dot green/amber/red with "Reconnecting"/"Offline" text, ⋯ menu with **Change name** in LOBBY only and **Leave game**), "Waiting for ★ Mika to start" (the VIP sees "You're the VIP ★"), and the read-only settings row "NAME · MIXED · 10 ROUNDS · 30 S". Full-screen **kicked** ("You were removed from this game") and **room gone** ("This game has ended") screens link home. Wake Lock while in the room. Other phases show the bare phase name (`shortcut:` comment).
- `lib/playerIdentity.ts` (ported from Sketchy): `newPlayerKey` (21 characters from `crypto.getRandomValues`), `savePlayer`/`loadPlayer`/`clearPlayer` under `pinpoint:player:CODE`. A stored identity rejoins silently. The identity is saved on the join's `{ok: true}` and after a rename, and cleared on Leave game or a refused stored rejoin. The device keeps one key across retries.
- `lib/roomStore.ts` gains `connection`. `useRoomSocket` sets it on `connect`/`disconnect` (`socket.active` decides amber or red), maps `kicked` to `KICKED_ERROR`, and returns its socket ref for page events. `FakeSocket` has `connected` and `active`.
- `GET /api/rooms/:code/exists` also returns `takenEmoji`. `KICKED_ERROR` is in `shared/constants.ts` (the reducer uses it).
**Decisions:** DECISIONS 18 (`takenEmoji`, which refusals go back to the form, storage timing, Leave without a confirm, name-only rename, dot colours, category segment and VIP card deferred to F13).
**New dependencies:** none.
**Notes for next session:** F12 puts the practice map into `Lobby` in `Play.tsx`. F13 replaces the VIP's "You're the VIP ★" with the settings card, adds the category name to `settingsLine` (and the Screen's row), and adds the ★ VIP drawer button to `TopBar`. Later phases replace the phase-name placeholder in `PlayerRoom`. The aria-live announcements are still to come with the round phases. Review items left: Leave game has no two-tap confirm and no destructive border (it sits in a menu), and the rename form opens inline under the top bar rather than as a sheet.
**How to try it:** `npm test` (client/src/pages/Play.test.tsx 14 tests: join form and taken emoji, join and storage, name taken, full, silent rejoin, refused stored identity, rename, menu outside lobby, leave, kicked, kicked rejoin, room gone, connection dot, ordinals; client/src/lib/playerIdentity.test.ts 3; server/http.test.ts exists with `takenEmoji`). `npm run dev`, then **Show** on http://localhost:5180 on a laptop, and on a phone on the same Wi-Fi open http://<laptop-ip>:5180/play/CODE. Playtest: `.playtest/F10/scenario.ts` (8 steps, all pass: form, join and storage, taken emoji and name, refresh rejoin, rename on phone and Screen, 13th player full, leave, unknown code).

## F09 — Landing page and Screen lobby (2026-11-07)
**What changed:**
- Client routing (`client/src/App.tsx` `AppRoutes`, `BrowserRouter` in `main.tsx`): `/` Landing, `/screen/:code` Screen, `/play/:code` a placeholder for F10. `client/src/lib/`: `socket.ts` (WebSocket-only `createSocket`), `roomStore.ts` (Zustand: `view`, `clockOffset = serverNow − Date.now()`, `error`, `fx`; `serverNow()`), `useRoomSocket.ts` (joins on every connect; `state`/`fx`/`room:closed` into the store; a refused join's text becomes `error`), `useWakeLock.ts`, `fullscreen.ts`, `audio.ts` (all adapted from Buzzr).
- `pages/Landing.tsx`: wordmark flaps, the line, **Join a game** (letters only, upper-cased, 4 max; `GET /api/rooms/:code/exists`; "No game with that code") and **Show a game on this screen** (`POST /api/rooms` → `/screen/:code`) with the hint; `md:grid-cols-2`, no admin link.
- `pages/Screen.tsx`: a 1920 × 1080 stage scaled by `stageScale` and letterboxed; **Click to start** overlay (`StartOverlay`: unlocks audio, fullscreen, Wake Lock); lobby with the room code in 200 px flaps, the QR (`qrcode.react`, the view's `joinUrl` = `PUBLIC_URL/play/CODE`), the join URL, player tiles (emoji, 4 px colour border, name, ★ VIP; disconnected dimmed, waiting dashed) or "Waiting for the first player: they'll be the VIP", the 48 px join strip; any refused join or `room:closed` shows the text ("This game has ended") with a link home. `components/SplitFlap.tsx` is static (F53 animates it).
- `RoomExistsResponse` moved from `server/http.ts` to `shared/types.ts`; `GAME_ENDED_ERROR` in `shared/constants.ts` (the gateway's `roomGone`).
**Decisions:** DECISIONS 17 (code input, full rooms pass the landing, error texts, stage scaling brought forward from F55, audio unlock until F56, static flaps, settings row deferred).
**New dependencies:** `react-router` (the stack's routing), `zustand` (the stack's snapshot store), `qrcode.react` (the roadmap's QR to `/play/:code`), `jsdom` + `@testing-library/react` + `@testing-library/dom` (dev: the stack's component tests; `@testing-library/dom` is the React library's peer). All client libraries are devDependencies like React, since Vite bundles them.
**Notes for next session:** F10 replaces `pages/Play.tsx` and reuses `useRoomSocket` with a `player:join` `JoinRoom`; add a `kicked` listener there (the Screen never gets one). `client/src/test/fakeSocket.ts` drives pages in tests (`makeSocket` prop). The Screen renders only the bare phase name outside LOBBY (`shortcut:` comment) until the round features land. The VIP lobby feature adds the settings departures row under the tiles. F55 keeps its stage-scale and keys tests; `stageScale` is exported from `Screen.tsx`. F56 replaces `lib/audio.ts` with Howler's unlock.
**How to try it:** `npm test` (client/src/pages/Landing.test.tsx 8 tests, Screen.test.tsx 9: lobby with 0 and 3 players, VIP star, ended on `room:closed` and on a refused join, clock offset, overlay fullscreen, Wake Lock and audio, stage scale). `npm run dev`, open http://localhost:5180 on a laptop, press **Show**, click the overlay; in a phone browser on the same Wi-Fi open http://<laptop-ip>:5180 and type a wrong code ("No game with that code"). Playtest: `.playtest/F09/scenario.ts` (8 steps, all pass, including no sideways scroll at 360 px).

## F08 — Category store (read) and dev fixture (2026-11-07)
**What changed:**
- `server/categoryStore.ts`: `loadCategoryStore({dataDir, production})` reads `DATA_DIR/categories.json` through `categoriesFileSchema` (missing file = no categories; a bad file throws `Invalid <path>: …`, and `index.ts` awaits it at top level, so the server stops). `CategoryStore.summaries()` → `CategorySummary[]` (id, name, emoji, box, labelStyle, `counts[level] = {city, landmark}` for published levels only), `get(id)` → the live, visible `Category` with places. Hidden and draft-only categories are invisible to both.
- `server/fixtures/dev-world.json`: "World (dev)" (`world-dev`, 🌍, `cityCountry`), 15 cities per level, two-decimal coordinates, placeholder Wikidata ids. Served in memory when the file holds no categories and `NODE_ENV !== 'production'`; read at runtime, so it is not in `dist/`.
- `GET /api/categories` in `server/http.ts` (`categories` option on `createApp`, empty by default).
**Decisions:** DECISIONS 16 (missing file, live-visible rule, counts, fixture details, landmarks deferred to M6).
**New dependencies:** none.
**Notes for next session:** The VIP lobby feature fills `vip.categories` in `views.ts` from `store.summaries()` (pass the store into `toView`) and applies the World-first default; New game snapshots `store.get(id).live[level].places` filtered by kind (`city` for Name, `landmark` for Picture). The admin write feature extends `CategoryStore` (it keeps the full list, drafts and hidden included, in `categories`). Picture mode (M6) adds 15 landmarks per level with generated placeholder photos to the fixture.
**How to try it:** `npm test` (server/categoryStore.test.ts 5 tests, server/http.test.ts 2 new). `npm run dev`, then `curl -s localhost:3010/api/categories` → one "World (dev)" with 15 cities per level. With `NODE_ENV=production` and no file it returns `[]`; a broken `categories.json` stops the server naming the path. No UI, no Kim checks.

## F07 — Socket gateway and lobby views (2026-11-07)
**What changed:**
- `server/sockets.ts` (adapted from Buzzr): `attachSockets(httpServer, {rooms, publicUrl, clock, trustProxy, roomLookupLimiter, playerJoinLimit, setTimer})` → `{io, dispatch, closeRooms}`. Every payload goes through `clientEventSchemas` in `handle()` (ack `{ok}` / `{ok: false, error}`; a missing ack or garbage cannot throw). Sockets join `room:<code>` plus `room:<code>:screen` or `room:<code>:player:<id>`; `dispatch` reduces, stores, sends every socket a fresh `state`, then runs effects (`fx` to Screens or one player, `schedule` → timeout → `{type: 'timer', at, timer, round, game, epoch}`, `kicked` → emit and disconnect). Handlers now: `screen:join`, `player:join`, `player:rename`, `player:leave` (sockets unjoined, may rejoin as new), `vip:kick`, and disconnect (`screen:leave`, or `player:connection false` once the player's last socket drops).
- Limits: new-player joins 30 per IP per minute (known key not counted; IP via `proxy-addr` with the same `trust proxy` as `req.ip`), `screen:join` in the shared `roomLookupLimiter` (created once in `index.ts`, also passed to `createApp`), `vip:*` 10 per second per socket, `maxHttpBufferSize` 16 KB (disconnect).
- `server/views.ts`: `toView(room, role, playerId, {now, publicUrl})` builds the lobby ScreenView (join URL `PUBLIC_URL/play/CODE`) and PlayerView field by field with `serverNow`; totals and competition ranks from `game.played`; the VIP's view adds `{categories: [], players, controls}`; `vipControls(phase, paused, rematchCounting)` is the spec's table. Round, reveal, standings, finale and `myResult` are null for now (`shortcut:` comment).
- `index.ts` wires the gateway and `startRoomSweeper(..., gateway.closeRooms)` → `room:closed {reason: 'expired'}` then disconnect. `ServerToClientEvents` in `shared/types.ts`, `ClientToServerEvents` in `shared/schemas.ts`.
**Decisions:** DECISIONS 15 (gateway refusal texts, wall-clock `now`, refused joins still count, WebSocket only, lobby controls).
**New dependencies:** `socket.io` (the stack's realtime layer); `proxy-addr` + `@types/proxy-addr` (the socket join limit needs the client IP exactly as Express's `req.ip` computes it behind Caddy; already a transitive Express dependency); `socket.io-client` (dev: the gateway tests now, the client later).
**Notes for next session:** Register new events with `handle(socket, '<event>', …)`; VIP events go through `asVip` (limiter + `by` from the socket), player events through `asPlayer`. Not registered yet: `player:practice`/`aim`/`lockIn` (need their per-socket limiters: aim dropped silently, lockIn 2/s, practice 1 per 2 s per player) and every `vip:*` except kick. The categories feature fills `vip.categories` in `views.ts` and must pass the category store into `toView`. F10+ fill `round`/`reveal`/…: extend `views.test.ts` into the spec's full leak test (coordinates, Wikidata id, country, fact, photo id, Commons file, Picture-mode name) when `round` first carries a prompt. The credits route must use the same `roomLookupLimiter` from `index.ts`. Errors are logged by message only.
**How to try it:** `npm test` (server/sockets.test.ts 13 tests over a real Socket.IO server, server/views.test.ts 5). Manual: `npm run build && PORT=3011 PUBLIC_URL=http://localhost:3011 npm start`, `curl -s -X POST localhost:3011/api/rooms`, then a `socket.io-client` script emitting `screen:join {code}` receives a ScreenView. No UI yet, so no Kim checks (the tests use a real local Socket.IO server).

## F06 — Reducer: lobby, players and VIP (2026-11-07)
**What changed:**
- `server/reducer.ts`: pure `reduce(room, action, now) → {room, effects, error?}` (structuredClone; a refusal returns the given room, no effects and the spec's text from `ERRORS`). Actions: `player:join` (first free `PALETTE` colour, name unique ignoring case, unique emoji, 12-player cap, kicked ids refused; a known key reconnects to the same id keeping its name and emoji; `waiting` in GUESSING/REVEAL/SCOREBOARD/FINAL), `player:rename` (LOBBY only), `player:leave`, `player:connection {playerId, connected}` (`connectedSince`), `vip:kick` (VIP only, not self; `kickedIds`, effect `kicked`), `screen:join`/`screen:leave` (`screenCount` 0…4), `timer`. Effects: `schedule {at, timer, round, game, epoch}`, `fx` to `'screens'` or `{playerId}`, `kicked`.
- `playerIdentity(code, key)`: id = first 16 chars of base64url SHA-256 of code + key; `keyHash` = hex SHA-256 of the key; the key is never stored.
- VIP: the first player; on the VIP's disconnect `vipAwayUntil = now + VIP_AWAY_MS` and `vipGone` is scheduled; succession goes to the connected player with the earliest `connectedSince` on leave, on `vipGone`, or on any connect once the deadline has passed; with nobody connected `vipId` stays until someone connects. A move emits `fx vipNow` to the new VIP. Every timer is checked against round, game and `timerEpoch` (`isStale`).
- `Room.vipAwayUntil` added to `shared/types.ts` and `createRoom`.
**Decisions:** DECISIONS 14 (error texts, `vipAwayUntil` and the echoed `at`, ties, VIP leaving with nobody connected, no toast on a fresh join, FINAL joiners wait, timers are not activity).
**New dependencies:** none.
**Notes for next session:** The gateway dispatches `{type: 'timer', ...scheduleEffect}` (all fields, including `at`) and computes `playerIdentity` itself to map the socket to the id; `by` must come from the socket, never the payload. Features that bump `timerEpoch` (F20 pause, F24 rematch) or change round/game must re-schedule `vipGone` at `vipAwayUntil` while it is set, or a pending succession is lost. `removePlayer` removes only the player: F15 adds the `allLocked` re-check after a leave, kick or disconnect in GUESSING, F22 removes the kicked player's round rows (see the `shortcut:` comment). Views must build `PublicPlayer` field by field (`keyHash` never leaves the server).
**How to try it:** `npm test` (server/reducer.lobby.test.ts, 28 tests). No UI yet.

## F05 — HTTP server, rooms and codes (2026-11-07)
**What changed:**
- `server/codes.ts`: 4-letter codes from `ROOM_CODE_ALPHABET` (no I, L, O), retried on collision and on Buzzr's blocked-word list (copied), up to `ROOM_CODE_MAX_ATTEMPTS` (100).
- `server/rateLimit.ts`: Buzzr's sliding-window limiter with an injectable clock; every limit uses `RATE_LIMITS`.
- `server/roomStore.ts`: `createRoom(code, now, rngState)` (empty LOBBY, default settings), in-memory `RoomStore`, `startRoomSweeper` deleting rooms idle 3 h (`ROOM_IDLE_TTL_MS`, swept every 5 min); wired in `server/index.ts`.
- `server/http.ts`: `POST /api/rooms` → 201 `{code}` (10 per IP per hour → 429); `GET /api/rooms/:code/exists` → `{exists, phase, full}` (shared `roomLookupLimiter`, 30 per IP per minute → 429); CSP, `Referrer-Policy`, `nosniff` on every response; one log line per request with `key=` redacted (not `/healthz`); a JSON error handler that logs only the redacted URL; the SPA fallback now passes `root` so it works under a dot directory (the worktree lives in `~/.cache`).
**Decisions:** DECISIONS 13 (new room's empty `categoryId` and defaults, full CSP, log format, error replies).
**New dependencies:** none.
**Notes for next session:** The credits route and `screen:join` must reuse the same `roomLookupLimiter` instance: create it in `index.ts`, pass it to `createApp` and to the socket gateway. `startRoomSweeper`'s `onExpired` is a no-op for now; the socket gateway should disconnect a swept room's sockets and the photo feature should drop its tokens there. The seed for `createRoom` comes from the injected `rng` (`Math.random` by default; not a secret).
**How to try it:** `npm test` (server/codes.test.ts, rateLimit.test.ts, roomStore.test.ts, http.test.ts); `npm run build && PORT=3011 npm start`, then `curl -si -X POST localhost:3011/api/rooms` and `curl -s localhost:3011/api/rooms/<CODE>/exists`.

## F04 — Scoring module (2026-11-07)
**What changed:**
- `shared/scoring.ts`: `basePoints(d, S)` (`FALLOFF` 8, 1000 when `d ≤ b`, else `floor`), `points(base, multiplier)` (`Math.round` after the multiplier), `escalation(rounds)` (multipliers per round − 1), `levelPlan(choice, rounds)` (Mixed thirds with `easy = hard = round(N / 3)`; a fixed level fills every round), `replan(old, played, fresh)` (the recompute for unplayed rounds, for levels and multipliers alike), `competitionRanks(totals)` (1, 2, 2, 4), `ordinal` and `rankText(rank, of, shared)` ("3rd of 8", "=2nd of 8").
**Decisions:** none new.
**New dependencies:** none.
**Notes for next session:** The reducer calls `replan(game.levelPlan, played.length, levelPlan(choice, n))` and the same with `escalation`, where the count is rounds already revealed (a skipped round is not played); round results keep their own `multiplier` and `points`, so played rounds never change. The round-count refusal (too few unused places at a level for the new plan) needs the pool and belongs to the reducer. `rankText`'s `shared` flag is the caller's: true when another player has the same rank. `competitionRanks` returns ranks only; the `joinedAt` display order for ties is the caller's.
**How to try it:** `npm test` (shared/scoring.test.ts, 15 tests).

## F03 — Geo module (2026-11-07)
**What changed:**
- `shared/geo.ts`: `haversineKm` (R = 6371.0088 km), `regionScale` (`S` = √(h × w) capped at 20,000), `bullseyeRadius` (0.01 × S), `boxContains` (edges included; `lng` or `lng + 360` in [west, east]), `mercatorCentre` (half way in Mercator x and y, longitude wrapped into [−180, 180)), `clampBounds` (box padded 25% each side, latitude clamped to ±`MAX_LAT`) and `geodesic` (64 segments, 65 points, both ends included).
- `normalizeLng` moved from `shared/schemas.ts` to `shared/geo.ts`; `schemas.ts` re-exports it.
**Decisions:** DECISIONS 12 (clamp latitude limit, continuous longitudes, antipodal geodesic, where `normalizeLng` lives).
**New dependencies:** none.
**Notes for next session:** `geodesic(a, b)` returns longitudes continuous from `a.lng`, so its last point may be `b.lng ± 360`; the reveal line should start at the pin or target that is drawn on the same world copy. `clampBounds` is for every box; the World category skips the horizontal clamp in the client (`worldCopyJump`). `mercatorCentre(box)` is the unlocked player's default aim (Points formula). The admin's S ≥ 150 km check can use `regionScale`. Scale and bullseye are unrounded; round only for display.
**How to try it:** `npm test` (shared/geo.test.ts, 24 tests).

## F02 — Shared types, schemas and constants (2026-11-07)
**What changed:**
- `shared/types.ts`: every Data model type (stored categories, Room state) plus the role views (`ScreenView`, `PlayerView`, `PublicPlayer`, prompts, reveal, standings, final passes, awards, `CategorySummary`), `fx` payloads and `Ack`.
- `shared/schemas.ts`: one zod schema per client event in `clientEventSchemas` (with `ClientPayload<E>`), the coordinate rule (`lat` within ±85.0511, `lng` finite and wrapped into [−180, 180) by `normalizeLng`), names (trimmed 1–16, no invisible characters), room codes (trimmed, upper-cased), the 21-char `playerKey`, every admin HTTP body and route parameter, and `categoriesFileSchema` for `categories.json`.
- `shared/constants.ts`: tokens, palette (the spec's list, untested until `palette.test.ts`), 24 emoji, room-code alphabet, settings menus and defaults, the eight timers plus the reveal timeline numbers, `RATE_LIMITS` (the limits table), player/screen caps, socket size, field limits, `MIN_PLACES_TO_OFFER`.
- Path alias `#shared/*` (package.json `imports`); `server/env.ts` and `shared/schemas.test.ts` use it. `npm start` and the deploy kit's Dockerfile CMD now pass `--conditions=dist`.
**Decisions:** DECISIONS 9 (limits the spec leaves open, `photoCandidate` = Commons file name), 10 (alias via Node subpath imports with a `dist` condition), 11 (views are types, not schemas; their layout is a first cut).
**New dependencies:** none.
**Notes for next session:** The built server needs `node --conditions=dist`; without it `#shared/*` points at the `.ts` sources and Node fails (F60's Dockerfile must keep the kit's CMD). The alias is proven in tsx (`server/env.ts` via `npm run dev`/tests), Vitest, tsc under both bundler (`tsconfig.json` includes `shared/*.test.ts`) and NodeNext resolution, the built server (`PORT=3011 npm start`), and a throwaway client import in a `vite build`; no committed client file imports `#shared` yet. `ScreenView.reveal.results` carries every row from REVEAL start because all pins drop at once; the views feature must still keep `myResult` until the reveal reaches the player. `photoSchema.author` may be empty: the credit builder must handle it. The box's S ≥ 150 km check belongs to the admin box editor.
**How to try it:** `npm test` (shared/schemas.test.ts, 25 tests); `npm run build && PORT=3011 npm start`, then `curl -s localhost:3011/healthz`.

## F01 — Project skeleton, tooling and CI (2026-11-07)
**What changed:**
- One npm package (no workspace): Express 5 server (`server/http.ts` `createApp()` with `/healthz`, `dist/client` with an SPA fallback that never swallows `/api`, `/socket.io` or `/tiles`; `server/index.ts` stops on SIGTERM within 3 s), `server/env.ts` parsing the spec's Environment table with zod (blank = unset; `TRUST_PROXY` as off, hop count, boolean or trust string), `.env.example` with every variable empty.
- React 19 + Vite client: a placeholder landing page ("PINPOINT" in flap cells, the one-liner) on the DESIGN.md tokens, defined in Tailwind 4 `@theme static` as `--color-*` with DESIGN.md-name aliases in `:root` (DECISIONS 8); JetBrains Mono 800 (latin) and Inter variable self-hosted via Fontsource; `.board-face` utility class; amber `:focus-visible` ring; SVG favicon.
- Tooling from Sketchy: tsconfigs (client/shared bundler; node for server/shared/scripts; build emits `dist/server`, `dist/shared`), eslint flat config, prettier; Playwright harness `scripts/playtest/` (one context per role; devices tv, tv 720p, laptop, Pixel 7, iPhone 13, small phone 360×640, large phone 430×932; default URL `http://localhost:5180`).
- Root `../.github/workflows/ci.yml`: `pinpoint-changes` and `pinpoint` jobs appended from `docs/deploy-kit/ci-jobs.yml` (format, lint, typecheck, test, build); nothing else changed.
**Decisions:** DECISIONS 4 (container data at `/data`), 5 (dev ports 3010/5180), 8 (token names). `.env.example` is written by shell: the `Read(./.env.*)` deny rule also blocks the Write tool on it, so sessions cannot edit it; ask Kim when a variable is added.
**New dependencies:** express, zod (env and later every schema; spec). Dev: react, react-dom, vite, @vitejs/plugin-react, tailwindcss + @tailwindcss/vite (tokens; spec), @fontsource/jetbrains-mono + @fontsource-variable/inter (self-hosted fonts; spec), typescript, tsx, concurrently, vitest, eslint + @eslint/js + typescript-eslint + eslint-plugin-react-hooks + globals + eslint-config-prettier, prettier, @types/node@24, @types/express, @types/react, @types/react-dom, playwright (playtest harness). Client libraries live in devDependencies, as in Sketchy: they are bundled at build time.
**Notes for next session:** npm's allowScripts blocked esbuild's postinstall (a binary check only); tsx, Vite and Vitest all work. Imports use relative paths with `.js` (`../shared/constants.js`) as in Sketchy; no path alias yet (F02 may add one if it pays). `shared/constants.ts` holds only the ports for now. Playwright uses its cached Chromium (falls back to `/usr/bin/chromium`).
**How to try it:** `npm run dev`, open http://localhost:5180 (phones on the LAN: `http://<laptop IP>:5180`); `curl -s localhost:5180/healthz` → `{"ok":true}`. `npm run playtest -- scripts/playtest/smoke.ts` with the dev server running. `npm run build && PORT=3010 npm start` serves the built app.

