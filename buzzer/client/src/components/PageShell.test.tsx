// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { Placeholder } from '../pages/Placeholder.js';
import { PageShell } from './PageShell.js';

afterEach(cleanup);

const frame = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('PageShell', () => {
  it.each([
    ['narrow', 'max-w-md'],
    ['content', 'max-w-3xl'],
    ['wide', 'max-w-6xl'],
  ] as const)('maps the %s width to %s', (width, maxWidth) => {
    const { container } = render(<PageShell width={width}>Body</PageShell>);
    expect(frame(container).className.split(' ')).toContain(maxWidth);
    expect(frame(container).dataset.width).toBe(width);
  });

  it('defaults to the content width', () => {
    const { container } = render(<PageShell>Body</PageShell>);
    expect(frame(container).className.split(' ')).toContain('max-w-3xl');
  });

  it('has gutters that grow from md, and aligns content to the top', () => {
    const { container } = render(<PageShell>Body</PageShell>);
    const classes = frame(container).className.split(' ');
    expect(classes).toEqual(expect.arrayContaining(['px-4', 'md:px-8', 'py-6', 'md:py-10']));
    expect(classes).not.toContain('justify-center');
  });

  it('puts the children in the main landmark, and the header slot above it', () => {
    render(
      <PageShell header={<a href="/">Back</a>} className="items-center">
        <h1>Title</h1>
      </PageShell>,
    );
    const main = screen.getByRole('main');
    expect(main.textContent).toBe('Title');
    expect(main.className).toContain('items-center');
    const header = screen.getByRole('banner');
    expect(header.textContent).toBe('Back');
    expect(header.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no header without the slot', () => {
    render(<PageShell>Body</PageShell>);
    expect(screen.queryByRole('banner')).toBeNull();
  });
});

describe('Placeholder', () => {
  it('sits in a narrow page shell', () => {
    const { container } = render(
      <MemoryRouter>
        <Placeholder title="Page not found" />
      </MemoryRouter>,
    );
    expect(frame(container).dataset.width).toBe('narrow');
    expect(screen.getByRole('main').textContent).toContain('Page not found');
    expect(screen.getByRole('link', { name: 'Back to start' }).className).toContain('min-h-11');
  });
});
