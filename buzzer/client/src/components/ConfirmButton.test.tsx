// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUTTON_DANGER, BUTTON_SMALL } from '../lib/ui.js';
import { ConfirmButton } from './ConfirmButton.js';

afterEach(cleanup);

const classes = (name: string) => screen.getByRole('button', { name }).className.split(' ');

describe('ConfirmButton', () => {
  it('reads as destructive before it is armed, with the danger style (FND-07)', () => {
    render(
      <ConfirmButton
        label="Delete"
        confirmLabel="Confirm delete"
        onConfirm={() => {}}
        className={BUTTON_DANGER}
        cancelClassName={BUTTON_SMALL}
      />,
    );
    expect(classes('Delete')).toContain('text-buzz');
  });

  it('still takes two presses to act, and its Cancel wears the neutral style', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton
        label="Delete"
        confirmLabel="Confirm delete"
        onConfirm={onConfirm}
        className={BUTTON_DANGER}
        cancelClassName={BUTTON_SMALL}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(classes('Cancel')).not.toContain('text-buzz');
    expect(classes('Confirm delete')).toContain('border-buzz');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('gives Cancel the button style when no Cancel style is given', () => {
    render(
      <ConfirmButton
        label="Leave"
        confirmLabel="Confirm leave"
        onConfirm={() => {}}
        className="x"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(classes('Cancel')).toEqual(['x']);
  });
});
