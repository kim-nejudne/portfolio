import L from 'leaflet';
import type { PublicPlayer } from '#shared/types.js';

/** A teardrop's height over its width: the circle's radius plus the rotated corner's half-diagonal. */
export const PIN_HEIGHT = 0.5 + Math.SQRT1_2;

/**
 * A pin marker (spec "Look and tokens"): a teardrop `size` px wide in the player's colour with a
 * 3 px `--board-bg` outline and their emoji at 60% of the width; the anchor is the tip. With
 * `dropDelayMs` it drops in (450 ms, 4 px bounce) after that delay.
 */
export function pinIcon(
  player: Pick<PublicPlayer, 'color' | 'emoji'>,
  { size = 40, dropDelayMs }: { size?: number; dropDelayMs?: number } = {},
) {
  const height = size * PIN_HEIGHT;
  const root = document.createElement('span');
  root.className = 'pin-marker';
  if (dropDelayMs !== undefined) {
    root.classList.add('pin-drop');
    root.style.animationDelay = `${dropDelayMs}ms`;
  }
  root.style.width = `${size}px`;
  root.style.height = `${height}px`;
  const body = document.createElement('span');
  body.className = 'pin-marker-body';
  body.style.width = body.style.height = `${size}px`;
  body.style.background = player.color;
  const emoji = document.createElement('span');
  emoji.className = 'pin-marker-emoji';
  emoji.style.width = emoji.style.height = `${size}px`;
  emoji.style.fontSize = `${size * 0.6}px`;
  emoji.textContent = player.emoji;
  root.append(body, emoji);
  return L.divIcon({
    className: '',
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    html: root,
  });
}

/** The true location: a 28 px amber ring, a 6 px dot, and a ring pulsing every 1.2 s. */
export function targetIcon() {
  const html = document.createElement('span');
  html.className = 'reveal-target';
  return L.divIcon({ className: '', iconSize: [28, 28], html });
}
