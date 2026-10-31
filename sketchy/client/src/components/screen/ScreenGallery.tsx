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
import { Tape } from '../sketch/Tape.js';
import { InkCanvas } from './InkCanvas.js';

type Drawing = ScreenView['gallery'][number];

interface Drawer {
  name: string;
  color: string;
}

/**
 * FINAL's gallery (UI by role and phase, Final): every drawing of the game in turn order, each a
 * taped white sheet with its word and drawer under it (F66), filling the height the final's right
 * page leaves in one or two rows and scrolling sideways past that. Each frozen drawing comes from the store (`ink:get`); one the room no longer
 * keeps shows "Drawing not kept". Tapping one opens it large; ← → page through (opening the first
 * or last when none is open) and Esc closes, except during a rematch countdown, where Esc is the
 * host's Cancel.
 */
export function ScreenGallery({
  view,
  gallery,
  t,
}: {
  view: ScreenView;
  gallery: GalleryStore;
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
  hidden,
  onOpen,
  t,
}: {
  drawings: Drawing[];
  drawers: Map<string, Drawer>;
  gallery: GalleryStore;
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

  // Two rows from five drawings, so a full night's gallery shows more at once, when the page
  // leaves the height for two rows of legible sheets; otherwise one.
  const boxRef = useRef<HTMLDivElement>(null);
  const [roomForTwo, setRoomForTwo] = useState(true);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setRoomForTwo(box.clientHeight >= 2 * sheetHeight(TWO_ROW_SQUARE_VMIN));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const rows = drawings.length > 4 && roomForTwo ? 2 : 1;
  const arrow =
    'sketch-border grid size-[max(6vmin,44px)] place-items-center bg-paper pb-[0.6vmin] text-[max(5.5vmin,30px)] leading-none shadow-[0.35vmin_0.35vmin_0_var(--color-ink)] focus-visible:outline-4 focus-visible:outline-pen disabled:opacity-30';
  return (
    <section
      aria-labelledby="gallery-title"
      data-gallery
      inert={hidden}
      className="flex min-h-0 w-full flex-1 flex-col gap-[1vmin]"
    >
      <div className="flex shrink-0 items-center gap-[2vmin]">
        <h2
          id="gallery-title"
          className="font-num text-[max(2.2vmin,12px)] font-black tracking-[0.14em] text-soft uppercase"
        >
          {t('galleryTitle')}
        </h2>
        <span
          className="h-0 flex-1 border-t-[length:max(1.5px,0.2vmin)] border-dashed border-dot"
          aria-hidden="true"
        />
        <span className="hidden text-[max(2.2vmin,13px)] text-soft [@media(pointer:fine)]:inline">
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
      {/* A size container: each sheet is as tall as its row allows, its caption included. */}
      <div ref={boxRef} className="min-h-0 flex-1 [container-type:size]">
        <ul
          ref={stripRef}
          className="grid h-full snap-x grid-flow-col gap-x-[2.4vmin] gap-y-[2vmin] overflow-x-auto overflow-y-hidden px-[1vmin] pt-[12px] [scrollbar-width:none]"
          style={{
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            gridAutoColumns: sheetWidth(rows),
            ['--caption' as string]: CAPTION,
          }}
        >
          {drawings.map((d) => {
            const drawer = drawers.get(d.drawerPid);
            return (
              <li
                key={d.turnId}
                id={`gallery-${d.turnId}`}
                data-sheet
                className="min-w-0 snap-start"
              >
                <button
                  type="button"
                  onClick={() => onOpen(d.turnId)}
                  className="relative flex w-full flex-col gap-[0.3vmin] border-[length:max(2px,0.28vmin)] border-ink bg-canvas p-[0.8vmin] pb-[0.4vmin] text-left text-ink shadow-[0.4vmin_0.4vmin_0_var(--color-ink)] hover:bg-none hover:outline-2 hover:outline-ink/40 focus-visible:outline-4 focus-visible:outline-pen"
                  aria-label={
                    drawer ? t('galleryDrawing', { word: d.word, name: drawer.name }) : d.word
                  }
                >
                  <Tape place="top" />
                  <span className="block aspect-square w-full">
                    <Picture entry={gallery.get(d.turnId)} t={t} small />
                  </span>
                  <span className="block truncate text-center text-[length:var(--caption)] leading-[1.15]">
                    {d.word}
                  </span>
                  {drawer && (
                    <span
                      className="block truncate text-center text-[length:var(--caption)] leading-[1.15]"
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
      </div>
    </section>
  );
}

/** A sheet's caption size (word, then "by Mika"). */
const CAPTION = 'max(3.5vmin, 14px)';
/** The smallest drawing two rows of sheets may have; under it the strip keeps one row. */
const TWO_ROW_SQUARE_VMIN = 15;

/**
 * A row's height in px for a sheet whose drawing is `squareVmin` wide: the drawing, the two caption
 * lines, the padding and border, the row gap, and its share of the tape's room.
 */
function sheetHeight(squareVmin: number): number {
  const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
  const caption = Math.max(3.5 * vmin, 14);
  return squareVmin * vmin + 2 * 1.15 * caption + 2.2 * vmin + 2 * vmin + 6;
}

/**
 * A sheet's width in a strip of `rows` rows: its row's height (the strip's, less the tape's room
 * and the gaps) less the two caption lines, the padding and the border, so the drawing is square;
 * never under 8 vmin, and at most a third of the strip's width, so three sheets always show.
 */
export function sheetWidth(rows: number): string {
  const row = `(100cqh - 12px - ${rows - 1} * 2vmin) / ${rows}`;
  return `max(8vmin, min(33cqw, calc(${row} - 2 * 1.15 * ${CAPTION} - 2.2vmin)))`;
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
        className={`grid h-full w-full place-items-center bg-paper p-[1vmin] text-center text-soft ${
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
      <span className="block h-full w-full bg-desk/50 motion-safe:animate-pulse" />
    );
  }
  return <InkCanvas ink={ink} label={label} />;
}

/**
 * A drawing opened large, on a dot-grid paper sheet over the whole book (and over a rematch
 * countdown, until it ends): the drawing taped on, the word, "by Mika", "2 of 5" and the arrows.
 */
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
    'sketch-border grid size-[max(8vmin,48px)] place-items-center bg-paper pb-[0.6vmin] text-[max(6.5vmin,34px)] leading-none text-ink shadow-[0.4vmin_0.5vmin_0_var(--color-ink)] focus-visible:outline-4 focus-visible:outline-pen disabled:opacity-30';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={trapTab}
      data-viewer
      // Over the whole desk, a paper sheet framed like the book, with the code strip's room under
      // it free for the host bar.
      className="fixed inset-0 z-[15] bg-desk px-[3vmin] pt-[3vmin] pb-[max(8vmin,2.5rem)] text-ink"
    >
      <div
        className="paper-dots flex size-full flex-col items-center gap-[3vmin] rounded-[0.6vmin] border-[length:max(2px,0.28vmin)] border-ink bg-paper p-[4vmin] pt-[max(5vmin,24px)] shadow-[0.8vmin_1vmin_0_var(--color-ink)] [@media(min-aspect-ratio:6/5)]:flex-row"
        style={{ backgroundSize: '3.3vmin 3.3vmin' }}
      >
        <div className="flex min-h-0 w-full flex-1 items-center justify-center [container-type:size] [@media(min-aspect-ratio:6/5)]:h-full">
          <div className="relative aspect-square w-[min(100cqw,100cqh)] border-[length:max(2px,0.28vmin)] border-ink bg-canvas shadow-[0.8vmin_1vmin_0_var(--color-ink)]">
            <Tape place="tl" />
            <Tape place="tr" />
            <Picture entry={entry} label={label} t={t} />
          </div>
        </div>
        <div className="flex w-full min-w-0 shrink-0 flex-col items-center gap-[2vmin] text-center [container-type:inline-size] [@media(min-aspect-ratio:6/5)]:w-[max(36vmin,200px)]">
          {/* Spaces may wrap; the longest single word must fit the column (a Patrick Hand letter
            is under 0.6 em), and a word that still doesn't breaks rather than run off the TV. */}
          <p
            className="leading-tight [overflow-wrap:anywhere]"
            style={{
              fontSize: `min(max(8vmin, 36px), calc(100cqw / ${longestWord(d.word) * 0.6}))`,
            }}
          >
            {d.word}
          </p>
          {drawer && (
            <p className="text-[max(4.5vmin,22px)]" style={{ color: drawer.color }}>
              {t('galleryBy', { name: drawer.name })}
            </p>
          )}
          <p className="font-num text-[max(3vmin,16px)] font-black text-soft tabular-nums">
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
              className={button}
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
    </div>
  );
}

/** Letters in the longest space-separated part, at least 5 (a short word keeps the full size). */
export function longestWord(word: string): number {
  return Math.max(5, ...word.split(/\s+/).map((part) => [...part].length));
}
