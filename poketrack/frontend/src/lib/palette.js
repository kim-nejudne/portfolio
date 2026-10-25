// Story-point badges and assignee avatars. Like lib/types.js, these return
// var() references into index.css rather than hex.

const POINT_STEPS = [1, 2, 3, 5, 8];

// Fibonacci points outside the palette (13, or anything a project invents)
// take the nearest step, ties going to the larger one.
export function pointBadge(points) {
  const n = Number(points) || 0;
  const step = POINT_STEPS.reduce((best, s) =>
    Math.abs(s - n) <= Math.abs(best - n) ? s : best, POINT_STEPS[0]);
  return { background: `var(--pts-${step}-bg)`, color: `var(--pts-${step}-ink)` };
}

const AVATAR_HUES = ["blue", "pink", "violet", "mint", "peach"];

// FNV-1a over the user id: stable across sessions and devices, so a person
// keeps their colour everywhere they appear.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function avatarColors(userId) {
  const hue = AVATAR_HUES[hash(String(userId || "")) % AVATAR_HUES.length];
  return { background: `var(--avatar-${hue}-bg)`, color: `var(--avatar-${hue}-ink)` };
}
