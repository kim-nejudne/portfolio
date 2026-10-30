// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardDomId, useCurrentCard } from './useCurrentCard.js';

type Callback = (entries: { target: Element; isIntersecting: boolean }[]) => void;
let callback: Callback | null = null;
const observed: Element[] = [];

beforeEach(() => {
  observed.length = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: Callback) {
        callback = cb;
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {
        observed.length = 0;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  callback = null;
});

function Cards({ ids }: { ids: string[] }) {
  const current = useCurrentCard(ids);
  return (
    <>
      <p data-testid="current">{current ?? 'none'}</p>
      {ids.map((id) => (
        <div key={id} id={cardDomId(id)} />
      ))}
    </>
  );
}

const cardOf = (id: string) => document.getElementById(cardDomId(id))!;
const see = (id: string, isIntersecting: boolean) =>
  act(() => callback!([{ target: cardOf(id), isIntersecting }]));
const current = () => screen.getByTestId('current').textContent;

describe('useCurrentCard', () => {
  it('watches every card and is the first one in view, in list order', () => {
    render(<Cards ids={['a', 'b', 'c']} />);
    expect(observed.map((el) => el.id)).toEqual(['card-a', 'card-b', 'card-c']);
    expect(current()).toBe('none');
    see('c', true);
    expect(current()).toBe('c');
    see('b', true);
    expect(current()).toBe('b');
    see('b', false);
    expect(current()).toBe('c');
  });

  it('keeps the last card while none is in view', () => {
    render(<Cards ids={['a', 'b']} />);
    see('b', true);
    see('b', false);
    expect(current()).toBe('b');
  });

  it('watches the cards again when the list changes', () => {
    const { rerender } = render(<Cards ids={['a']} />);
    rerender(<Cards ids={['a', 'b']} />);
    expect(observed.map((el) => el.id)).toEqual(['card-a', 'card-b']);
  });

  it('stays null without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Cards ids={['a']} />);
    expect(current()).toBe('none');
  });
});
