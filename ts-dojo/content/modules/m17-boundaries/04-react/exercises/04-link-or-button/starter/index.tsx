import type { ReactNode } from 'react';

// One loose object: a link without an href, or a button with one, both compile.
export type ActionProps = {
  variant: 'link' | 'button';
  href?: string;
  onPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
};

export function Action({
  variant,
  href,
  onPress,
  disabled,
  children,
}: ActionProps) {
  if (variant === 'link') {
    return <a href={href}>{children}</a>;
  }
  return (
    <button type="button" onClick={onPress} disabled={disabled}>
      {children}
    </button>
  );
}
