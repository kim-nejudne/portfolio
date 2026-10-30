import { useEffect, useRef, useState } from 'react';
import { DEFAULT_INK_SIZE } from '../../../../shared/constants.js';
import { visibleStrokes, type InkStroke } from '../../../../shared/ink.js';
import {
  createPhoneDoodle,
  loadDoodle,
  saveDoodle,
  type DoodleResult,
  type PhoneDoodle,
  type SendDoodle,
} from '../../ink/doodle.js';
import { toGrid } from '../../ink/inkSender.js';
import type { Translate } from '../../lib/copy.js';
import { drawStroke, redrawPicture } from '../../lib/ink.js';
import { createPointerGate } from '../../lib/phone.js';

/** The pad's backing store never goes past this, whatever the phone's pixel ratio. */
const MAX_BACKING_PX = 1536;
/** v0: black pen at M, as the drawer's pad until the toolbar (F32). */
const PEN_COLOR = 0;

interface Props {
  /** sessionStorage key for this room and player (`doodleKey`). */
  storageKey: string;
  send: SendDoodle;
  t: Translate;
}

/**
 * The lobby doodle pad (Lobby doodles): "Doodle yourself while you wait!" and a square pad. Same
 * pointer handling as the drawer's pad (first pointer only, captured, `pointercancel` ends the
 * stroke, `touch-action: none` so a stroke never scrolls the lobby). Each finished stroke goes to
 * the Screens as one batch; it never comes back to any phone. Undo takes the last stroke off.
 * Optional and pointer-only: nothing waits on it. A stroke in hand when the game starts is dropped
 * with the pad.
 */
export function DoodlePad({ storageKey, send, t }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  const [note, setNote] = useState<DoodleResult | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const doodleRef = useRef<PhoneDoodle | null>(null);
  const repaintRef = useRef<() => void>(() => {});

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!box || !canvas || !ctx) return;

    const doodle = createPhoneDoodle(loadDoodle(storageKey), (ops) => sendRef.current(ops));
    doodleRef.current = doodle;
    setCanUndo(doodle.canUndo());
    const drawn = new Map<number, number>();
    const gate = createPointerGate();
    let stroke: InkStroke | null = null;
    let rect = canvas.getBoundingClientRect();
    let px = 0;
    let frame = 0;
    let live = true;

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
      stroke = doodle.begin(PEN_COLOR, DEFAULT_INK_SIZE, x, y);
      setCanUndo(false);
      schedule();
    };
    const onMove = (e: PointerEvent) => {
      if (!stroke || !gate.owns(e.pointerId)) return;
      e.preventDefault();
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
      const sent = doodle.end(done);
      // The simplified line replaces the raw one.
      repaint();
      void sent.then((result) => {
        saveDoodle(storageKey, doodle.stack);
        if (!live) return;
        if (result !== 'ok') repaint();
        setNote(result === 'full' ? 'full' : null);
        setCanUndo(doodle.canUndo());
      });
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);
    canvas.addEventListener('lostpointercapture', onEnd);
    return () => {
      live = false;
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
    const sent = doodle?.undo();
    if (!doodle || !sent) return;
    repaintRef.current();
    setNote(null);
    setCanUndo(false);
    void sent.then(() => {
      saveDoodle(storageKey, doodle.stack);
      if (doodleRef.current !== doodle) return;
      repaintRef.current();
      setCanUndo(doodle.canUndo());
    });
  };

  return (
    <section className="flex flex-col items-center gap-2">
      <div className="flex w-full items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('doodleYourself')}</h2>
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo}
          className="min-h-11 min-w-11 shrink-0 rounded-xl bg-white/15 px-3 font-bold text-white disabled:opacity-40"
        >
          {t('doodleUndo')}
        </button>
      </div>
      {/* Narrower than the column, so a thumb can still scroll the lobby beside it. */}
      <div ref={boxRef} className="aspect-square w-full max-w-[min(100%_-_3rem,38dvh)]">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t('doodlePad')}
          className="block size-full touch-none rounded-lg bg-white select-none [-webkit-touch-callout:none]"
        />
      </div>
      <p role="status" className="min-h-[1.5em] text-center text-base text-[#FFD166]">
        {note === 'full' ? t('doodleFull') : ''}
      </p>
    </section>
  );
}
