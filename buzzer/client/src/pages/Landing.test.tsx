// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { Landing } from './Landing.js';

afterEach(cleanup);

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderLanding() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
  return {
    input: screen.getByLabelText<HTMLInputElement>('Room code'),
    join: screen.getByRole<HTMLButtonElement>('button', { name: 'Join' }),
  };
}

describe('Landing', () => {
  it('upper-cases the typed code', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'wxyz' } });
    expect(input.value).toBe('WXYZ');
  });

  it('keeps only room-code alphabet letters, at most 4', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'a1 iLob-cdEF' } });
    expect(input.value).toBe('ABCD');
  });

  it('disables Join until the code has 4 letters', () => {
    const { input, join } = renderLanding();
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(join.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(join.disabled).toBe(false);
  });

  it('submitting a code navigates to /play/<CODE>', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'qrst' } });
    fireEvent.submit(input.form!);
    expect(screen.getByTestId('path').textContent).toBe('/play/QRST');
  });

  it('does not navigate on submit with an incomplete code', () => {
    const { input } = renderLanding();
    fireEvent.change(input, { target: { value: 'qr' } });
    fireEvent.submit(input.form!);
    expect(screen.queryByTestId('path')).toBeNull();
  });

  it('offers Host a game and links My question sets to /sets', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: 'Host a game' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'My question sets' }).getAttribute('href')).toBe(
      '/sets',
    );
  });
});
