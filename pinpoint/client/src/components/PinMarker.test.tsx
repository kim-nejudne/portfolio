// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { PIN_HEIGHT, pinIcon, targetIcon } from './PinMarker.js';

const parts = (icon: ReturnType<typeof pinIcon>) => {
  const root = icon.options.html as HTMLElement;
  return {
    root,
    body: root.querySelector<HTMLElement>('.pin-marker-body')!,
    emoji: root.querySelector<HTMLElement>('.pin-marker-emoji')!,
  };
};

describe('pinIcon', () => {
  it("fills the teardrop with the player's colour and centres their emoji at 60% of the width", () => {
    const { root, body, emoji } = parts(pinIcon({ color: '#00A0F8', emoji: '🦊' }));
    expect(root.className).toBe('pin-marker');
    expect(body.style.background).toBe('rgb(0, 160, 248)');
    expect([body.style.width, body.style.height]).toEqual(['40px', '40px']);
    expect(emoji.textContent).toBe('🦊');
    expect(emoji.style.fontSize).toBe('24px');
  });

  it('anchors at the tip: bottom centre, one radius plus a half-diagonal below the top', () => {
    expect(PIN_HEIGHT).toBeCloseTo(1.2071, 4);
    for (const size of [40, 32]) {
      const icon = pinIcon({ color: '#44BB99', emoji: '🐸' }, { size });
      expect(icon.options.iconSize).toEqual([size, size * PIN_HEIGHT]);
      expect(icon.options.iconAnchor).toEqual([size / 2, size * PIN_HEIGHT]);
      const { root, emoji } = parts(icon);
      expect(parseFloat(root.style.height)).toBeCloseTo(size * PIN_HEIGHT, 3);
      expect(emoji.style.fontSize).toBe(`${size * 0.6}px`);
    }
  });

  it('drops in after its stagger delay only when asked', () => {
    const still = parts(pinIcon({ color: '#44BB99', emoji: '🐸' })).root;
    expect(still.classList.contains('pin-drop')).toBe(false);
    expect(still.style.animationDelay).toBe('');
    const dropping = parts(pinIcon({ color: '#44BB99', emoji: '🐸' }, { dropDelayMs: 120 })).root;
    expect(dropping.classList.contains('pin-drop')).toBe(true);
    expect(dropping.style.animationDelay).toBe('120ms');
    const first = parts(pinIcon({ color: '#44BB99', emoji: '🐸' }, { dropDelayMs: 0 })).root;
    expect(first.classList.contains('pin-drop')).toBe(true);
  });
});

describe('targetIcon', () => {
  it('is the 28 px amber target, centred on the true location', () => {
    const icon = targetIcon();
    expect((icon.options.html as HTMLElement).className).toBe('reveal-target');
    expect(icon.options.iconSize).toEqual([28, 28]);
    expect(icon.options.iconAnchor).toBeUndefined(); // Leaflet centres it
  });
});
