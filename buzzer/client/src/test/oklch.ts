import tokensCss from '../tokens.css?raw';

/** The `oklch(L% C H)` value of a `--color-<name>` token in tokens.css. */
export function tokenOklch(name: string): [number, number, number] {
  const match = new RegExp(
    `--color-${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\);`,
  ).exec(tokensCss);
  if (!match) throw new Error(`no oklch --color-${name} in tokens.css`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
}

/** OKLCH to linear sRGB, each channel clamped to 0..1 (Björn Ottosson's OKLab matrices). */
function toLinearRgb([l, c, h]: [number, number, number]): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb: [number, number, number] = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return rgb.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

/** A token as `#rrggbb`, for places that cannot read oklch (the favicon, theme-color). */
export function tokenHex(name: string): string {
  return `#${toLinearRgb(tokenOklch(name))
    .map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** WCAG 2 contrast ratio between two tokens. */
export function contrast(fg: string, bg: string): number {
  const luminance = (name: string) => {
    const [r, g, b] = toLinearRgb(tokenOklch(name));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
