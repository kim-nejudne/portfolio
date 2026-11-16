// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartOverlay } from './StartOverlay.js';

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, 'matchMedia');
});

function stubCoarse(coarse: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: coarse && query === '(pointer: coarse)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

describe('StartOverlay', () => {
  it('says Click to start with a mouse', () => {
    stubCoarse(false);
    render(<StartOverlay onStart={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Click to start' })).toBeTruthy();
  });

  it('prints the word in wide capitals on the teal pass, the small print under the ink bar (F146)', () => {
    stubCoarse(false);
    render(<StartOverlay onStart={() => {}} />);
    const word = screen.getByText('Click to start');
    expect(word.className).toContain('bg-accent');
    expect(word.className).toContain('uppercase');
    expect(word.className).toContain('group-hover:bg-accent-2');
    // The focus ring is on the word, in ink, since the button fills the window.
    expect(word.className).toContain('group-focus-visible:outline-ink');
    expect(screen.getByText('Turns on sound and fullscreen').className).toContain(
      'border-t-4 border-ink',
    );
  });

  it('says Tap to start on a touch screen, and a tap starts the Screen (FND-08)', () => {
    stubCoarse(true);
    const onStart = vi.fn();
    render(<StartOverlay onStart={onStart} />);
    expect(screen.getByRole('dialog', { name: 'Tap to start' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('Click');
    fireEvent.click(screen.getByRole('button', { name: /Tap to start/ }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
