import type { ReactNode } from 'react';

// Too loose: tighten these props to the ones the prompt lists.
export type NoticeProps = {
  title: string | number;
  tone?: string;
  children?: ReactNode;
};

export function Notice({ title, tone = 'info', children }: NoticeProps) {
  return (
    <section className={`notice notice-${tone}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
