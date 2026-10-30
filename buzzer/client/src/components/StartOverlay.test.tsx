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
