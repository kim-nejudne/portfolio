import type { ReactNode } from 'react';

export type ActionProps =
  | { variant: 'link'; href: string; children: ReactNode }
  | {
      variant: 'button';
      onPress: () => void;
      disabled?: boolean;
      children: ReactNode;
    };

export function Action(props: ActionProps) {
  if (props.variant === 'link') {
    return <a href={props.href}>{props.children}</a>;
  }
  return (
    <button type="button" onClick={props.onPress} disabled={props.disabled}>
      {props.children}
    </button>
  );
}
