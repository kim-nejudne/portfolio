import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { Translate } from '../../lib/copy.js';
import {
  galleryKey,
  type GalleryEntry,
  type ScreenGallery as GalleryStore,
} from '../../lib/gallery.js';
import { staticInk } from '../../lib/ink.js';
import { InkCanvas } from './InkCanvas.js';

type Drawing = ScreenView['gallery'][number];

interface Drawer {
  name: string;
  color: string;
}

/**
 * FINAL's gallery (UI by role and phase, Final): every drawing of the game in turn order, word and
 * drawer under each. Each frozen drawing comes from the store (`ink:get`); one the room no longer
 * keeps shows "Drawing not kept". Tapping one opens it large; ← → page through (opening the first
 * or last when none is open) and Esc closes, except during a rematch countdown, where Esc is the
 * host's Cancel.
 */
export function ScreenGallery({
  view,
  gallery,
  large,
  t,
}: {
  view: ScreenView;
  gallery: GalleryStore;
  /** Bigger drawings, when the scores above leave the room for them. */
  large: boolean;
  t: Translate;
}) {
  const drawings = view.gallery;
  useSyncExternalStore(gallery.subscribe, gallery.version, gallery.version);
  const [open, setOpen] = useState<number | null>(null);
  const openIndex = open === null ? -1 : drawings.findIndex((d) => d.turnId === open);
  const counting = view.rematchInMs !== null;

  // A drawer who left is still named from the night's totals, when there are any.
  const drawers = useMemo(() => {
    const byPid = new Map<string, Drawer>();
    for (const row of view.tonight ?? []) byPid.set(row.pid, row);
    for (const p of view.players) byPid.set(p.pid, p);
    return byPid;
  }, [view.players, view.tonight]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      const action = galleryKey(e.key, openIndex, drawings.length, counting);
      if (action === null) return;
      e.preventDefault();
      setOpen(action === 'close' ? null : drawings[action.open]!.turnId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawings, openIndex, counting]);

  // The strip follows the viewer, and closing it puts focus on the last drawing seen (once the
  // strip is no longer inert), so a remote or a keyboard carries on from there.
  const lastOpen = useRef<number | null>(null);
  useEffect(() => {
    if (open !== null) {
      lastOpen.current = open;
      document
        .getElementById(`gallery-${open}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } else if (lastOpen.current !== null) {
      document.querySelector<HTMLElement>(`#gallery-${lastOpen.current} button`)?.focus();
      lastOpen.current = null;
    }
  }, [open]);

  if (drawings.length === 0) return null;
  return (
    <>
      <GalleryStrip
        drawings={drawings}
        drawers={drawers}
        gallery={gallery}
        large={large}
        hidden={openIndex >= 0}
        onOpen={setOpen}
        t={t}
      />
      {openIndex >= 0 && (
        <GalleryViewer
          drawings={drawings}
          index={openIndex}
          drawers={drawers}
          entry={gallery.get(drawings[openIndex]!.turnId)}
          onPage={(i) => setOpen(drawings[i]!.turnId)}
          onClose={() => setOpen(null)}
          t={t}
        />
      )}
    </>
  );
}

function GalleryStrip({
  drawings,
  drawers,
  gallery,
  large,
  hidden,
  onOpen,
  t,
}: {
  drawings: Drawing[];
  drawers: Map<string, Drawer>;
  gallery: GalleryStore;
  large: boolean;
  /** Behind the open viewer: out of the tab order and the accessibility tree. */
  hidden: boolean;
  onOpen: (turnId: number) => void;
  t: Translate;
}) {
  const stripRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const update = () =>
      setEdges({
        start: strip.scrollLeft <= 1,
        end: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    strip.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      strip.removeEventListener('scroll', update);
    };
  }, [drawings.length]);

  const page = (direction: 1 | -1) => {
    const strip = stripRef.current;
    if (!strip) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollBy({
      left: direction * strip.clientWidth * 0.8,
      behavior: smooth ? 'smooth' : 'auto',
    });
  };

  const arrow =
    'grid size-[max(6vmin,44px)] place-items-center rounded-full bg-white/10 pb-[0.4vmin] text-[max(5vmin,26px)] leading-none font-bold disabled:opacity-30';
  return (
    <section
      aria-labelledby="gallery-title"
      inert={hidden}
      className="flex w-full shrink-0 flex-col gap-[1vmin]"
    >
      <div className="flex items-center gap-[2vmin]">
        <h2 id="gallery-title" className="font-display text-[max(4vmin,20px)] font-bold">
          {t('galleryTitle')}
        </h2>
        <span className="h-px flex-1 bg-white/20" aria-hidden="true" />
        <span className="hidden text-[max(2.2vmin,13px)] text-white/60 [@media(pointer:fine)]:inline">
          {t('galleryHint')}
        </span>
        <button
          type="button"
          className={arrow}
          disabled={edges.start}
          onClick={() => page(-1)}
          aria-label={t('galleryPrev')}
        >
          ‹
        </button>
        <button
          type="button"
          className={arrow}
          disabled={edges.end}
          onClick={() => page(1)}
          aria-label={t('galleryNext')}
        >
          ›
        </button>
      </div>
      <ul
        ref={stripRef}
        className="flex snap-x gap-[2vmin] overflow-x-auto overflow-y-hidden pb-[0.5vmin] [scrollbar-width:none]"
      >
        {drawings.map((d) => {
          const drawer = drawers.get(d.drawerPid);
          return (
            <li
              key={d.turnId}
              id={`gallery-${d.turnId}`}
              className={`shrink-0 snap-start ${large ? 'w-[max(28vmin,96px)]' : 'w-[max(17vmin,96px)]'}`}
            >
              <button
                type="button"
                onClick={() => onOpen(d.turnId)}
                className="flex w-full flex-col gap-[0.5vmin] rounded-[1vmin] text-left hover:bg-none hover:outline-2 hover:outline-white/40 focus-visible:outline-4 focus-visible:outline-[#FFD166]"
                aria-label={
                  drawer ? t('galleryDrawing', { word: d.word, name: drawer.name }) : d.word
                }
              >
                <span className="block aspect-square w-full">
                  <Picture entry={gallery.get(d.turnId)} t={t} small />
                </span>
                <span className="truncate text-[max(3.5vmin,16px)] font-bold">{d.word}</span>
                {drawer && (
                  <span
                    className="-mt-[0.5vmin] truncate text-[max(3vmin,14px)]"
                    style={{ color: drawer.color }}
                  >
                    {t('galleryBy', { name: drawer.name })}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One drawing: the frozen ink, a blank square while it loads, or "Drawing not kept". */
function Picture({
  entry,
  label = '',
  t,
  small = false,
}: {
  entry: GalleryEntry | undefined;
  /** None on a thumbnail: its button already names it. */
  label?: string;
  t: Translate;
  small?: boolean;
}) {
  const stack = entry?.status === 'ready' ? entry.stack : null;
  const ink = useMemo(() => staticInk(stack), [stack]);
  if (entry?.status === 'notKept') {
    return (
      <span
        className={`grid h-full w-full place-items-center rounded-[1vmin] bg-white/10 p-[1vmin] text-center text-white/70 ${
          small ? 'text-[max(2.2vmin,12px)]' : 'text-[max(4vmin,20px)]'
        }`}
      >
        {t('galleryNotKept')}
      </span>
    );
  }
  if (!stack) {
    return (
      // Dim, so a drawing still on its way never looks like an empty one.
      <span className="block h-full w-full rounded-[1vmin] bg-white/10 motion-safe:animate-pulse" />
    );
  }
  return <InkCanvas ink={ink} label={label} className={small ? 'rounded-[1vmin]' : undefined} />;
}

/** A drawing opened large, over the final scores (and over a rematch countdown, until it ends). */
function GalleryViewer({
  drawings,
  index,
  drawers,
  entry,
  onPage,
  onClose,
  t,
}: {
  drawings: Drawing[];
  index: number;
  drawers: Map<string, Drawer>;
  entry: GalleryEntry | undefined;
  onPage: (index: number) => void;
  onClose: () => void;
  t: Translate;
}) {
  const d = drawings[index]!;
  const drawer = drawers.get(d.drawerPid);
  const label = drawer ? t('galleryDrawing', { word: d.word, name: drawer.name }) : d.word;
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus moves in on open (the gallery puts it back on close) and Tab stays inside.
  useEffect(() => closeRef.current?.focus(), []);
  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:enabled')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const button =
    'grid size-[max(8vmin,48px)] place-items-center rounded-full bg-white/15 pb-[0.5vmin] text-[max(6vmin,30px)] leading-none font-bold disabled:opacity-30';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={trapTab}
      className="absolute inset-0 z-[15] flex flex-col items-center gap-[3vmin] bg-[#1D1B22] p-[4vmin] [@media(min-aspect-ratio:6/5)]:flex-row"
    >
      <div className="min-h-0 w-full flex-1 [@media(min-aspect-ratio:6/5)]:h-full">
        <Picture entry={entry} label={label} t={t} />
      </div>
      <div className="flex w-full min-w-0 shrink-0 flex-col items-center gap-[2vmin] text-center [container-type:inline-size] [@media(min-aspect-ratio:6/5)]:w-[max(36vmin,200px)]">
        {/* Spaces may wrap; the longest single word must fit the column (a Fredoka letter is
            about 0.6 em), and a word that still doesn't breaks rather than run off the TV. */}
        <p
          className="font-display leading-tight font-bold [overflow-wrap:anywhere]"
          style={{ fontSize: `min(max(8vmin, 36px), calc(100cqw / ${longestWord(d.word) * 0.6}))` }}
        >
          {d.word}
        </p>
        {drawer && (
          <p className="text-[max(4.5vmin,22px)] font-semibold" style={{ color: drawer.color }}>
            {t('galleryBy', { name: drawer.name })}
          </p>
        )}
        <p className="text-[max(3vmin,16px)] text-white/70 tabular-nums">
          {t('galleryCount', { n: index + 1, total: drawings.length })}
        </p>
        <div className="flex items-center gap-[2vmin]">
          <button
            type="button"
            className={button}
            disabled={index === 0}
            onClick={() => onPage(index - 1)}
            aria-label={t('galleryPrevOne')}
          >
            ‹
          </button>
          <button
            ref={closeRef}
            type="button"
            className={`${button} focus-visible:outline-4 focus-visible:outline-[#FFD166]`}
            onClick={onClose}
            aria-label={t('galleryClose')}
          >
            ✕
          </button>
          <button
            type="button"
            className={button}
            disabled={index === drawings.length - 1}
            onClick={() => onPage(index + 1)}
            aria-label={t('galleryNextOne')}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

/** Letters in the longest space-separated part, at least 5 (a short word keeps the full size). */
export function longestWord(word: string): number {
  return Math.max(5, ...word.split(/\s+/).map((part) => [...part].length));
}
