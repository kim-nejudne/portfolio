import { useEffect, useRef } from 'react';
import { drawStroke, redrawPicture, type ScreenInk } from '../../lib/ink.js';

/** Backing stores stop here, so a 4K TV at DPR 2 doesn't allocate a huge canvas. */
const MAX_BACKING_PX = 2048;

/**
 * The live drawing: the largest white square that fits its box, sized in device pixels (capped)
 * so lines stay sharp. New points are drawn on the next animation frame; undo, clear, a new turn
 * and a resize repaint everything from the picture (Canvas and drawing tools, Rendering).
 */
export function InkCanvas({ ink, label }: { ink: ScreenInk; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!box || !canvas || !ctx) return;

    let px = 0;
    // Per stroke, the point index its next incremental draw starts from.
    let drawn = new Map<number, number>();
    let dirty = new Set<number>();
    let redraw = true;
    let frame = 0;

    const paint = () => {
      frame = 0;
      if (px === 0) return;
      const pic = ink.picture();
      if (redraw) {
        drawn = redrawPicture(ctx, pic, px);
      } else if (pic) {
        for (const id of dirty) {
          const stroke = pic.byId.get(id);
          if (stroke) drawn.set(id, drawStroke(ctx, stroke, px, drawn.get(id) ?? 0));
        }
      }
      redraw = false;
      dirty = new Set();
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(paint);
    };

    const resize = () => {
      const side = Math.floor(Math.min(box.clientWidth, box.clientHeight));
      canvas.style.width = canvas.style.height = `${side}px`;
      const next = Math.min(MAX_BACKING_PX, Math.round(side * (window.devicePixelRatio || 1)));
      if (next !== px) {
        px = canvas.width = canvas.height = next;
        redraw = true;
        paint();
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    resize();

    const unsubscribe = ink.subscribe((change) => {
      if (change.redraw) redraw = true;
      for (const id of change.dirty) dirty.add(id);
      schedule();
    });
    return () => {
      unsubscribe();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ink]);

  return (
    <div ref={boxRef} className="grid h-full w-full place-items-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block rounded-[1vmin] bg-white shadow-2xl"
        aria-label={label}
      />
    </div>
  );
}
