// Central palette + helpers driven by the 18 canonical Pokémon types.
export const TYPE_HEX = {
  normal:   "#A8A77A",
  fire:     "#EE8130",
  water:    "#6390F0",
  electric: "#F7D02C",
  grass:    "#7AC74C",
  ice:      "#96D9D6",
  fighting: "#C22E28",
  poison:   "#A33EA1",
  ground:   "#E2BF65",
  flying:   "#A98FF3",
  psychic:  "#F95587",
  bug:      "#A6B91A",
  rock:     "#B6A136",
  ghost:    "#735797",
  dragon:   "#6F35FC",
  dark:     "#705746",
  steel:    "#B7B7CE",
  fairy:    "#D685AD",
};

export function typeColor(type) {
  return TYPE_HEX[type] || "#6390F0";
}

export function readableInk(hex) {
  const c = String(hex || "").replace("#", "");
  if (c.length < 6) return "#F7F7FB";
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? "#0B0D10" : "#F7F7FB";
}

export function partnerGradient(types) {
  const [a, b] = types || [];
  const A = typeColor(a || "water");
  const B = typeColor(b || a || "water");
  return `linear-gradient(135deg, ${A} 0%, ${B} 100%)`;
}
