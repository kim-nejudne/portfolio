// Big-primary button for BAYAD / LISTA / RECORD A PAYMENT.
// 4px radius, generous height, ink-on-paper by default; utang and bayad variants.
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'ink' | 'bayad' | 'utang' | 'outline';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function BigButton({ variant = 'ink', children, style, disabled, ...rest }: Props) {
  const palette = (() => {
    switch (variant) {
      case 'bayad':
        return { bg: 'var(--color-bayad)', fg: 'var(--color-paper)' };
      case 'utang':
        return { bg: 'var(--color-utang)', fg: 'var(--color-paper)' };
      case 'outline':
        return { bg: 'transparent', fg: 'var(--color-ink)' };
      case 'ink':
      default:
        return { bg: 'var(--color-ink)', fg: 'var(--color-paper)' };
    }
  })();

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      style={{
        minHeight: 56,
        padding: '0 20px',
        background: disabled ? 'transparent' : palette.bg,
        color: disabled ? 'var(--color-muted)' : palette.fg,
        border: variant === 'outline' ? '1px solid var(--color-ink)' : '1px solid transparent',
        borderRadius: 'var(--radius-tap)',
        fontFamily: 'var(--font-mono)',
        fontSize: 16,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
