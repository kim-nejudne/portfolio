import { useEffect, useRef } from 'react';
import { DEFAULT_INK_SIZE } from '../../../../shared/constants.js';
import {
  createInkStack,
  pushStroke,
  visibleStrokes,
  type InkStroke,
} from '../../../../shared/ink.js';
import type { InkBatch } from '../../../../shared/types.js';
import { createInkSender, toGrid } from '../../ink/inkSender.js';
import { drawStroke, redrawPicture } from '../../lib/ink.js';
import { createPointerGate } from '../../lib/phone.js';

/** The pad's backing store never goes past this, whatever the phone's pixel ratio. */
const MAX_BACKING_PX = 2048;
/** v0: black pen only (colour 0). Colours, sizes, eraser, undo and clear come with their feature. */
// SPEC-QUESTION: the toolbar (8 colours, S/M/L, eraser, undo, clear) is F32; v0 draws black at M (DECISIONS 30).
const PEN_COLOR = 0;

interface Props {
  turnId: number;
  /** The pad's side in CSS px (Drawer layout). */
  size: number;
  /** Sends one batch over `/ink`. */
  send: (batch: InkBatch) => void;
  /** While true (paused), the stroke in hand ends and new ones don't start. */
  disabled: boolean;
  label: string;
}

/**
 * The drawer's square pad. Pointer Events, first pointer only (captured), so a second finger or a
 * palm is ignored until it lifts; `pointercancel` ends the stroke (Stopping scroll and zoom).
 * Strokes go to `inkSender` on the 1024 grid and into the pad's own action stack (`shared/ink.ts`),
 * drawn with the Screen's `drawStroke`. The pad draws every point at once; the Screen gets the
 * filtered, simplified line, within a few grid units of it. One sender per turn: a new `turnId`
 * starts a blank pad.
 */
export function DrawPad({ turnId, size, send, disabled, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The latest `send`, so a new callback doesn't restart the turn.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Canvas setup and drawing, per turn. The size is read through a ref so a resize repaints
  // without dropping the turn's strokes or its sender.
  const sizeRef = useRef(size);
  const repaintRef = useRef<() => void>(() => {});
  const disabledRef = useRef(disabled);
  const endStrokeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const sender = createInkSender({ turnId, send: (b) => sendRef.current(b) });
    // F32: the toolbar's undo and clear call `sender.undo()`/`clear()` and also `popAction` or
    // `pushClear` on this stack, then `repaint()`, so the pad and the Screen stay the same picture.
    const stack = createInkStack();
    const drawn = new Map<number, number>();
    const gate = createPointerGate();
    let stroke: InkStroke | null = null;
    let pointerId = -1;
    // Read once per stroke: a layout read per coalesced point is slow on budget phones.
    let rect = canvas.getBoundingClientRect();
    let px = 0;
    let frame = 0;

    const paint = () => {
      frame = 0;
      if (px === 0) return;
      for (const stroke of visibleStrokes(stack)) {
        const from = drawn.get(stroke.id) ?? 0;
        if (from < stroke.points.length / 2 - 1 || !drawn.has(stroke.id))
          drawn.set(stroke.id, drawStroke(ctx, stroke, px, from));
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };

    const repaint = () => {
      const side = sizeRef.current;
      const next = Math.min(MAX_BACKING_PX, Math.round(side * (window.devicePixelRatio || 1)));
      if (next !== px) px = canvas.width = canvas.height = next;
      drawn.clear();
      for (const [id, from] of redrawPicture(ctx, stack, px)) drawn.set(id, from);
    };
    repaintRef.current = repaint;
    repaint();

    const gridPoint = (e: PointerEvent): [number, number] => {
      return [toGrid(e.clientX - rect.left, rect.width), toGrid(e.clientY - rect.top, rect.height)];
    };

    const addPoint = (stroke: InkStroke, [x, y]: [number, number]) => {
      const p = stroke.points;
      // The local line keeps every new point (no radial filter or RDP); `inkSender` filters and
      // simplifies what it sends.
      if (p[p.length - 2] === x && p[p.length - 1] === y) return;
      p.push(x, y);
      sender.move(x, y);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (disabledRef.current || !gate.down(e.pointerId)) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      pointerId = e.pointerId;
      rect = canvas.getBoundingClientRect();
      const [x, y] = gridPoint(e);
      const id = sender.begin(PEN_COLOR, DEFAULT_INK_SIZE, x, y);
      stroke = pushStroke(stack, id, PEN_COLOR, DEFAULT_INK_SIZE, x, y);
      schedule();
    };
    const onMove = (e: PointerEvent) => {
      if (!stroke || !gate.owns(e.pointerId)) return;
      e.preventDefault();
      // Fast strokes on a 60 Hz event stream: the coalesced points keep curves round.
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      for (const ev of events.length > 0 ? events : [e]) addPoint(stroke, gridPoint(ev));
      schedule();
    };
    const endStroke = (id: number) => {
      if (!stroke || !gate.up(id)) return;
      stroke.ended = true;
      stroke = null;
      sender.end();
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    const onEnd = (e: PointerEvent) => endStroke(e.pointerId);
    endStrokeRef.current = () => endStroke(pointerId);
    // Background tabs throttle timers: send what is pending before the page hides.
    const onHide = () => {
      if (document.visibilityState === 'hidden') sender.flush();
    };
    const onPageHide = () => sender.flush();

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);
    canvas.addEventListener('lostpointercapture', onEnd);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('pointercancel', onEnd);
      canvas.removeEventListener('lostpointercapture', onEnd);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      if (frame) cancelAnimationFrame(frame);
      // The turn is over (or the pad is gone): send the stroke in hand, then stop.
      sender.end();
      sender.dispose();
      repaintRef.current = () => {};
      endStrokeRef.current = () => {};
    };
  }, [turnId]);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) endStrokeRef.current();
  }, [disabled]);

  useEffect(() => {
    sizeRef.current = size;
    repaintRef.current();
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-label={label}
      style={{ width: size, height: size }}
      className="block touch-none rounded-lg bg-white select-none [-webkit-touch-callout:none]"
    />
  );
}
