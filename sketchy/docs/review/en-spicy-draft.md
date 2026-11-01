# `en-spicy` draft, for Kim's review

These are the candidate words for the English spicy pack (spec: Word pack format). F73 builds `data/packs/en-spicy.json` from the rows that are left after review, exactly as written here, and then deletes this file. Nothing here is in the game yet, and the Spicy setting adds nothing until F73 ships.

**Tone (spec):** adult-ish party humour. Drinking, dating, hangover and party jokes. Nothing explicit, and nothing that targets groups of people. No brand names, nothing that needs letters or numbers to draw, and only words people anywhere would know.

## How to review

1. Delete a row, or strike its word (`~~bar fight~~`), to drop it. F73 skips struck rows.
2. Edit a level or the alternates in place if you like. Each word can have up to 6 alternates. Regular plurals (`+s`, `+es`) are accepted without being listed.
3. F73 needs **at least 60 rows left**. The draft has 74, so up to 14 can go without adding words.
4. Then run `node .claude/scripts/roadmap.mjs mark F73 todo`, so the next autopilot run builds the pack.

**Level:** 1 easy (one object), 2 medium, 3 hard (a scene, an action or an idea), as in the family packs.

**Checked:** no word or alternate is the same as a family-pack word or alternate (with or without a plural `s`/`es`), none repeats inside the draft, none is "close" to a dev bot's decoy guess, and every row is plain ASCII with 30 characters or fewer.

**Rows to look at first** (the closest calls either way): `love bite`, `walk of shame`, `throwing up` and `beer goggles` for tone; `dad dancing` and `beer belly` as jokes about people; `crush`, `friend zone` and `drunk`, which may be too much an idea or a feeling to draw; and `last train home`, `dad dancing` and `red cup`, which some countries may not know.

## Drinks and the bar (27)

| Word | Level | Alternates | Note |
| --- | --- | --- | --- |
| beer | 1 | pint, lager | a glass with froth on top |
| beer can | 1 | can of beer | |
| wine glass | 1 | glass of wine, wineglass, wine | |
| cocktail | 1 | mixed drink | |
| shot glass | 1 | shot, shotglass | |
| champagne | 1 | bubbly, prosecco, sparkling wine | a bottle with the cork popping |
| keg | 1 | beer keg, beer barrel | |
| red cup | 1 | party cup, plastic cup | the plastic party cup |
| bar stool | 1 | barstool | |
| martini | 1 | martini glass | the glass with an olive |
| hip flask | 1 | flask | |
| bottle opener | 1 | opener | |
| margarita | 2 | frozen margarita | salt on the rim |
| tequila shot | 2 | tequila, lime and salt, salt and lime | |
| boxed wine | 2 | box of wine, wine box | |
| cheers | 2 | toast, clinking glasses, raising a glass | |
| beer belly | 2 | beer gut | |
| bartender | 2 | barman, barmaid, mixologist | |
| chugging | 2 | chug, downing a drink | |
| drunk | 2 | tipsy, wasted, drunken | |
| wine stain | 2 | red wine stain, spilled wine, spilt wine | |
| on the rocks | 3 | whiskey on the rocks, whisky on the rocks | |
| happy hour | 3 | | |
| bar crawl | 3 | pub crawl | |
| last call | 3 | last orders, closing time | |
| designated driver | 3 | sober driver | |
| bar fight | 3 | bar brawl, brawl | |

## Clubs and parties (23)

| Word | Level | Alternates | Note |
| --- | --- | --- | --- |
| disco ball | 1 | mirror ball, mirrorball, glitter ball | |
| glow stick | 1 | glowstick | |
| DJ | 1 | deejay, disc jockey | decks and headphones |
| limo | 1 | limousine, stretch limo | |
| nightclub | 2 | club, clubbing, disco | |
| dance floor | 2 | dancefloor | |
| bouncer | 2 | doorman | |
| slow dance | 2 | slow dancing | |
| conga line | 2 | conga | |
| house party | 2 | houseparty | `party` alone stays the alternate of the family `birthday party` |
| flip cup | 2 | flipcup | |
| beer pong | 2 | beerpong, cup pong | |
| dance-off | 3 | dance off, dance battle | |
| dad dancing | 3 | dad dance | |
| party animal | 3 | partygoer, partier | |
| party crasher | 3 | gatecrasher, gate crasher | |
| after party | 3 | afterparty | |
| bachelor party | 3 | stag do, stag party, bachelorette party, hen do, hen party | US and UK both ways |
| noise complaint | 3 | angry neighbor, angry neighbour | |
| truth or dare | 3 | | |
| spin the bottle | 3 | | |
| drinking game | 3 | | |
| keg stand | 3 | kegstand | |

## The morning after (8)

| Word | Level | Alternates | Note |
| --- | --- | --- | --- |
| hangover | 2 | hung over, hungover | moved out of the family packs in DECISIONS 68 |
| passed out | 2 | pass out, out cold | |
| throwing up | 2 | vomit, vomiting, puke, puking | |
| walk of shame | 3 | | |
| beer goggles | 3 | | |
| drunk text | 3 | drunk texting, drunk dial | `texting` alone is a family word |
| last train home | 3 | last train | |
| greasy breakfast | 3 | hangover breakfast | |

## Dating (16)

| Word | Level | Alternates | Note |
| --- | --- | --- | --- |
| kiss | 1 | kissing, smooch | |
| wink | 1 | winking | |
| lipstick mark | 1 | lipstick kiss, kiss mark | `lipstick` alone is a family word |
| love letter | 2 | | |
| first date | 2 | | `date night` is a family word, so no bare `date` alternate |
| crush | 2 | secret crush | |
| dating app | 2 | online dating, swipe right | |
| holding hands | 2 | hand in hand | |
| blind date | 3 | set up | |
| speed dating | 3 | speed date | |
| wingman | 3 | wing man, wingwoman | |
| third wheel | 3 | | |
| friend zone | 3 | friendzone, friendzoned | |
| heartbreak | 3 | broken heart, heartbroken | |
| breakup | 3 | break up, breaking up, dumped | |
| love bite | 3 | hickey | |
