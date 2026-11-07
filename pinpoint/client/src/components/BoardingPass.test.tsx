// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardingPass, PassFlip, Stamp } from './BoardingPass.js';

function reducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query === '(prefers-reduced-motion: reduce)',
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('BoardingPass', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('has the stripe, emoji, heading and aside above a notched tear line, the body below', () => {
    render(
      <BoardingPass
        label="Your result"
        color="#E85830"
        emoji="🦊"
        heading={<h1>Mika</h1>}
        aside={<Stamp tone="bullseye">Bullseye</Stamp>}
      >
        <p>412 km</p>
      </BoardingPass>,
    );
    const pass = screen.getByRole('region', { name: 'Your result' });
    expect(pass.className).toContain('rounded-pass');
    expect(pass.className).toContain('bg-pass-bg');
    expect(pass.querySelector<HTMLElement>('[data-stripe]')!.style.background).toBe(
      'rgb(232, 88, 48)',
    );
    expect(pass.textContent).toBe('🦊MikaBullseye412 km');
    const tear = pass.querySelector<HTMLElement>('[data-tear]')!;
    expect(tear.className).toContain('border-dashed');
    expect(tear.className).toContain('border-line');
    const notches = [...tear.children].map((n) => n.className);
    expect(notches).toHaveLength(2);
    expect(notches.join(' ')).toContain('-left-3');
    expect(notches.join(' ')).toContain('-right-3');
    for (const n of notches) expect(n).toContain('size-6 rounded-full bg-board-bg');
    // The tear sits between the head and the body.
    expect(tear.previousElementSibling!.textContent).toBe('🦊MikaBullseye');
    expect(tear.nextElementSibling!.textContent).toBe('412 km');
  });

  it('has no tear line without a body, and no stripe without a colour', () => {
    render(<BoardingPass label="Your result" heading={<h1>Missed this round · 0</h1>} />);
    const pass = screen.getByRole('region', { name: 'Your result' });
    expect(pass.querySelector('[data-tear]')).toBeNull();
    expect(pass.querySelector('[data-stripe]')).toBeNull();
  });

  it('renders as a list item for the finale grid', () => {
    render(
      <ol>
        <BoardingPass as="li" size="screen" label="Noor's boarding pass" heading="Noor">
          1st
        </BoardingPass>
      </ol>,
    );
    expect(screen.getByRole('listitem', { name: "Noor's boarding pass" }).textContent).toBe(
      'Noor1st',
    );
  });

  it('stamps BULLSEYE in --delayed ink and CLOSEST in the pass ink, both rotated −8°', () => {
    render(
      <>
        <Stamp tone="bullseye">Bullseye</Stamp>
        <Stamp tone="closest">Closest</Stamp>
      </>,
    );
    const bullseye = screen.getByText('Bullseye').className;
    const closest = screen.getByText('Closest').className;
    for (const c of [bullseye, closest]) {
      expect(c).toContain('-rotate-8');
      expect(c).toContain('border-2');
      expect(c).toContain('board-face');
    }
    expect(bullseye).toContain('bg-delayed text-board-bg');
    expect(closest).toContain('border-pass-text text-pass-text');
  });
});

describe('PassFlip', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  const back = <p role="status" aria-label="Face down" />;

  it('turns a face-down card over to the pass, hiding the back from assistive tech', () => {
    const { container, rerender } = render(
      <PassFlip up={false} back={back}>
        {null}
      </PassFlip>,
    );
    const flip = container.querySelector<HTMLElement>('.pass-flip')!;
    expect(flip.dataset.up).toBe('false');
    expect(screen.getByRole('status', { name: 'Face down' })).toBeTruthy();

    rerender(
      <PassFlip up back={back}>
        <section aria-label="Your result">412 km</section>
      </PassFlip>,
    );
    // The same element turns, so the 500 ms CSS transition runs.
    expect(container.querySelector('.pass-flip')).toBe(flip);
    expect(flip.dataset.up).toBe('true');
    expect(screen.getByRole('region', { name: 'Your result' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Face down' })).toBeNull();
  });

  it('shows a card that was already face up without flipping', () => {
    const { container } = render(
      <PassFlip up back={back}>
        <section aria-label="Your result" />
      </PassFlip>,
    );
    expect(container.querySelector('.pass-flip')).toBeNull();
    expect(screen.getByRole('region', { name: 'Your result' })).toBeTruthy();
  });

  it('fades the pass in over 150 ms under reduced motion', () => {
    reducedMotion(true);
    const { container, rerender } = render(
      <PassFlip up={false} back={back}>
        {null}
      </PassFlip>,
    );
    expect(container.querySelector('.pass-flip')).toBeNull();
    expect(screen.getByRole('status', { name: 'Face down' })).toBeTruthy();
    rerender(
      <PassFlip up back={back}>
        <section aria-label="Your result" />
      </PassFlip>,
    );
    expect(screen.queryByRole('status', { name: 'Face down' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Your result' }).parentElement!.className).toContain(
      'flap-fade',
    );
  });
});
