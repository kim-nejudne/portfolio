// The 18 Pokémon types, as pastel pills. The colours live in index.css
// (--type-<name>-bg / -ink); these helpers only name them, so every type
// colour on screen comes from the same place as the rest of the theme.
export const TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

const known = (type) => (TYPES.includes(type) ? type : "normal");

export function typeColor(type) {
  return `var(--type-${known(type)}-bg)`;
}

export function typeInk(type) {
  return `var(--type-${known(type)}-ink)`;
}

// A type colour at reduced strength, for glows and rays. color-mix keeps this
// working on a var(), where appending a hex alpha would not.
export function typeTint(type, pct) {
  return `color-mix(in srgb, ${typeColor(type)} ${pct}%, transparent)`;
}
