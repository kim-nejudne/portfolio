import { monogramFor } from '../lib/monogram';

interface Props {
  name: string;
  size?: number;
}

export function MonogramChip({ name, size = 44 }: Props) {
  const m = monogramFor(name);
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        background: m.bg,
        color: m.fg,
        fontFamily: 'var(--font-mono)',
        fontSize: size * 0.36,
        fontWeight: 500,
        letterSpacing: '0.02em',
        flex: '0 0 auto',
        borderRadius: 'var(--radius-tap)',
      }}
    >
      {m.letters}
    </span>
  );
}
