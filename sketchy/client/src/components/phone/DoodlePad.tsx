import { useEffect, useRef, useState } from 'react';
import { visibleStrokes, type InkStroke } from '../../../../shared/ink.js';
import { createPhoneDoodle, loadDoodle, saveDoodle, type PhoneDoodle } from '../../ink/doodle.js';
import { toGrid } from '../../ink/inkSender.js';
import type { Translate } from '../../lib/copy.js';
import { drawStroke, redrawPicture } from '../../lib/ink.js';
import { createPointerGate } from '../../lib/phone.js';
import { DEFAULT_TOOL } from '../../lib/tools.js';
import { ColourSwatches, SizeButton } from './DrawToolbar.js';

/** The pad's backing store never goes past this, whatever the phone's pixel ratio. */
const MAX_BACKING_PX = 1536;

interface Props {
  /** sessionStorage key for this room and player (`doodleKey`). */
  storageKey: string;
  t: Translate;
}

/**
 * The lobby doodle pad (F55): "Warm up: doodle while you wait!" and a square pad. Same pointer
 * handling as the drawer's pad (first pointer only, captured, `pointercancel` ends the stroke,
 * `touch-action: none` so a stroke never scrolls the lobby). It stays on the phone: nothing is
 * sent. Undo takes the last stroke off. The drawer's colours and size button, but no Eraser or
 * Clear: the doodle's 20 KB counts every stroke, so only Undo makes room, which keeps the cap
 * simple (DECISIONS 53, 78).
 * Optional and pointer-only: nothing waits on it. A stroke in hand when the game starts is dropped
 * with the pad.
 */
export function DoodlePad({ storageKey, t }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [full, setFull] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const doodleRef = useRef<PhoneDoodle | null>(null);
  const repaintRef = useRef<() => void>(() => {});
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const toolRef = useRef(tool);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!box || !canvas || !ctx) return;

    const doodle = createPhoneDoodle(loadDoodle(storageKey));
    doodleRef.current = doodle;
    setCanUndo(doodle.canUndo());
    const drawn = new Map<number, number>();
    const gate = createPointerGate();
    let stroke: InkStroke | null = null;
    let rect = canvas.getBoundingClientRect();
    let px = 0;
    let frame = 0;

    const repaint = () => {
      drawn.clear();
      if (px > 0)
        for (const [id, from] of redrawPicture(ctx, doodle.stack, px)) drawn.set(id, from);
    };
    const paint = () => {
      frame = 0;
      if (px === 0) return;
      for (const s of visibleStrokes(doodle.stack)) {
        const from = drawn.get(s.id) ?? 0;
        if (from < s.points.length / 2 - 1 || !drawn.has(s.id))
          drawn.set(s.id, drawStroke(ctx, s, px, from));
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };
    repaintRef.current = repaint;
    const resize = () => {
      // The pad's size and place follow the lobby around it (a name wraps, an avatar row grows),
      // even mid-stroke: the next point maps through the new box.
      rect = canvas.getBoundingClientRect();
      const side = box.clientWidth;
      const next = Math.min(MAX_BACKING_PX, Math.round(side * (window.devicePixelRatio || 1)));
      if (next > 0 && next !== px) {
        px = canvas.width = canvas.height = next;
        repaint();
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    resize();

    const gridPoint = (e: PointerEvent): [number, number] => [
      toGrid(e.clientX - rect.left, rect.width),
      toGrid(e.clientY - rect.top, rect.height),
    ];

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!gate.down(e.pointerId)) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      rect = canvas.getBoundingClientRect();
      const [x, y] = gridPoint(e);
      stroke = doodle.begin(toolRef.current.color, toolRef.current.size, x, y);
      setCanUndo(false);
      schedule();
    };
    const onMove = (e: PointerEvent) => {
      if (!stroke || !gate.owns(e.pointerId)) return;
      e.preventDefault();
      // Moved without resizing (a toast, a row above it wrapping)? Map through where it is now.
      rect = canvas.getBoundingClientRect();
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const p = stroke.points;
      for (const ev of events.length > 0 ? events : [e]) {
        const [x, y] = gridPoint(ev);
        if (p[p.length - 2] !== x || p[p.length - 1] !== y) p.push(x, y);
      }
      schedule();
    };
    const onEnd = (e: PointerEvent) => {
      if (!stroke || !gate.up(e.pointerId)) return;
      const done = stroke;
      stroke = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const result = doodle.end(done);
      // The simplified line replaces the raw one (or a full doodle drops it).
      repaint();
      saveDoodle(storageKey, doodle.stack);
      setFull(result === 'full');
      setCanUndo(doodle.canUndo());
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);
    canvas.addEventListener('lostpointercapture', onEnd);
    return () => {
      doodleRef.current = null;
      repaintRef.current = () => {};
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('pointercancel', onEnd);
      canvas.removeEventListener('lostpointercapture', onEnd);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [storageKey]);

  const undo = () => {
    const doodle = doodleRef.current;
    if (!doodle?.undo()) return;
    repaintRef.current();
    saveDoodle(storageKey, doodle.stack);
    setFull(false);
    setCanUndo(doodle.canUndo());
  };

  return (
    <section className="flex flex-1 flex-col gap-1.5">
      <h2 className="text-base leading-tight text-soft">{t('doodleWarmUp')}</h2>
      {/* The pad takes the height the lobby leaves (never under 7.5rem), and stays 2rem narrower than
          the column, so a thumb can still scroll the lobby beside it. */}
      <div className="flex min-h-30 flex-1 justify-center [container-type:size]">
        <div
          ref={boxRef}
          className="aspect-square w-[min(100cqw_-_2rem,100cqh)] rounded-md border-2 border-dashed border-soft bg-paper/70"
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={t('doodlePad')}
            className="block size-full cursor-crosshair touch-none select-none [-webkit-touch-callout:none]"
          />
        </div>
      </div>
      {/* Size and Undo beside the colours (one row of 8 where they fit, else two rows of 4), so the
          tools take no row of their own. */}
      <div className="@container flex w-full items-center justify-center gap-2">
        <div className="flex shrink-0 flex-col gap-1">
          <SizeButton tool={tool} onTool={setTool} t={t} look="paper" />
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="sketch-border min-h-11 min-w-11 bg-paper px-2 text-lg leading-none whitespace-nowrap text-ink hover:bg-none disabled:opacity-40"
          >
            {t('doodleUndo')}
          </button>
        </div>
        <ColourSwatches
          tool={tool}
          onTool={setTool}
          t={t}
          look="paper"
          className="grid grid-cols-4 justify-items-center @min-[28rem]:grid-cols-8"
        />
      </div>
      {/* The note under the pad (the canvas's label says it to screen readers), or "full". */}
      <p className="min-h-[1.25em] text-center text-[15px] leading-tight text-soft">
        <span aria-hidden="true">{full ? '' : t('doodlePad')}</span>
        <span role="status" className="text-ink">
          {full ? t('doodleFull') : ''}
        </span>
      </p>
    </section>
  );
}
