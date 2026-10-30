// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverflowMenu } from './OverflowMenu.js';

afterEach(cleanup);

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderMenu() {
  const duplicate = vi.fn();
  const remove = vi.fn();
  render(
    <MemoryRouter initialEntries={['/sets']}>
      <Routes>
        <Route
          path="/sets"
          element={
            <>
              <OverflowMenu
                label="More actions for Pub quiz"
                trigger="⋯"
                triggerClassName=""
                items={[
                  { label: 'Open', to: '/sets/pub' },
                  { label: 'Duplicate', onSelect: duplicate },
                  { label: 'Export JSON', onSelect: vi.fn(), disabled: true },
                  { label: 'Delete', confirmLabel: 'Confirm delete', onSelect: remove },
                ]}
              />
              <button type="button">Elsewhere</button>
            </>
          }
        />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
  return { duplicate, remove };
}

const trigger = () => screen.getByRole('button', { name: 'More actions for Pub quiz' });
const item = (name: string) => screen.getByRole('menuitem', { name });
const open = () => fireEvent.click(trigger());

describe('OverflowMenu', () => {
  it('is closed until its trigger is pressed, then lists its items and focuses the first', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu', { name: 'More actions for Pub quiz' });
    expect(trigger().getAttribute('aria-controls')).toBe(menu.id);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((el) => el.textContent),
    ).toEqual(['Open', 'Duplicate', 'Export JSON', 'Delete']);
    expect(document.activeElement).toBe(item('Open'));
  });

  it('Esc closes it and returns focus to the trigger', () => {
    renderMenu();
    open();
    fireEvent.keyDown(item('Open'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('arrow keys, Home and End move through the items, wrapping round', () => {
    renderMenu();
    open();
    fireEvent.keyDown(item('Open'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Duplicate'));
    fireEvent.keyDown(item('Duplicate'), { key: 'End' });
    expect(document.activeElement).toBe(item('Delete'));
    fireEvent.keyDown(item('Delete'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Open'));
    fireEvent.keyDown(item('Open'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Delete'));
    fireEvent.keyDown(item('Delete'), { key: 'Home' });
    expect(document.activeElement).toBe(item('Open'));
  });

  it('ArrowDown on the trigger opens it; ArrowUp opens it on the last item', () => {
    renderMenu();
    fireEvent.keyDown(trigger(), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Delete'));
    fireEvent.keyDown(item('Delete'), { key: 'Escape' });
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('Open'));
  });

  it('choosing an item runs it, closes the menu and returns focus to the trigger', () => {
    const { duplicate } = renderMenu();
    open();
    fireEvent.click(item('Duplicate'));
    expect(duplicate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('a link item follows its route', () => {
    renderMenu();
    open();
    fireEvent.click(item('Open'));
    expect(screen.getByTestId('path').textContent).toBe('/sets/pub');
  });

  it('a disabled item says so and does nothing', () => {
    renderMenu();
    open();
    expect(item('Export JSON').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(item('Export JSON'));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('a destructive item is red, and asks again in place before it acts', () => {
    const { remove } = renderMenu();
    open();
    expect(item('Delete').className).toContain('text-buzz');
    expect(item('Duplicate').className).not.toContain('text-buzz');
    fireEvent.click(item('Delete'));
    expect(remove).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(item('Confirm delete'));
    expect(item('Cancel').className).not.toContain('text-buzz');
    fireEvent.click(item('Confirm delete'));
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Cancel puts the destructive item back and focuses it', () => {
    const { remove } = renderMenu();
    open();
    fireEvent.click(item('Delete'));
    fireEvent.click(item('Cancel'));
    expect(screen.queryByRole('menuitem', { name: 'Confirm delete' })).toBeNull();
    expect(document.activeElement).toBe(item('Delete'));
    expect(remove).not.toHaveBeenCalled();
  });

  it('a press outside closes it, and so does the trigger again', () => {
    renderMenu();
    open();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).toBeNull();
    open();
    open();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closing it disarms the destructive item', () => {
    renderMenu();
    open();
    fireEvent.click(item('Delete'));
    fireEvent.keyDown(item('Confirm delete'), { key: 'Escape' });
    open();
    expect(item('Delete')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Confirm delete' })).toBeNull();
  });
});
