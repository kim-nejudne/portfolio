// Slurs and hate terms, English and Tagalog (spec: Guess feed and rude guesses). A wrong guess with
// one of these never reaches a Screen as typed, whatever `guessFeed` says: it shows as `•••`. Kim
// reviews this list (Kim checks, F15).
//
// Entries are lowercase letters, matched by `server/profanity.ts` on normalised words after letter
// swaps (`@`→a, `1`→i, `0`→o, …): `word` is the whole word, `stem*` any word starting with it,
// `*part*` any word containing it. Each is also tried against the whole guess with its spaces
// removed, so "n i g g a" is caught too.
//
// Left out on purpose, because they are everyday words or drawable answers: "bakla" (also the
// community's own word), "paki" (Tagalog "please"), "unggoy" (monkey), "intsik" and "bumbay"
// (listed as questions for Kim in DECISIONS 38).

export const SLURS: readonly string[] = [
  // English
  '*nigger*',
  '*nigga*',
  'faggot*',
  'fag',
  'fags',
  'faggy',
  'chink*',
  'spic',
  'spics',
  'spick*',
  'wetback*',
  'gook*',
  'kike*',
  'tranny',
  'trannies',
  'shemale*',
  'retard',
  'retards',
  'retarded',
  'dyke',
  'dykes',
  'coon',
  'coons',
  'beaner*',
  'towelhead*',
  'raghead*',
  'cameljockey',
  'sandnigger*',
  'jigaboo*',
  'porchmonkey*',
  'golliwog*',
  'mongoloid*',
  'spastic',
  'heeb',
  'wop',
  'wops',
  'gyppo*',
  'pikey*',
  'zipperhead*',
  // Tagalog (and Bisaya heard in Manila)
  'negro',
  'negra',
  'baluga',
  'tsekwa',
  'tsikwa',
  'chekwa',
  'bayot',
  'abnoy',
  'mongoloyd',
];
