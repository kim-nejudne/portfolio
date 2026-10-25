import type { ReactNode } from 'react';

export type NoticeProps = {
  title: string;
  tone?: 'info' | 'warn' | 'error';
  children: ReactNode;
};

export function Notice({ title, tone = 'info', children }: NoticeProps) {
  return (
    <section className={`notice notice-${tone}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
