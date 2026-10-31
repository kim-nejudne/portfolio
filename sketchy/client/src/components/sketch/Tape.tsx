/** Where a strip of tape sits on its (relatively positioned) parent. */
export type TapePlace = 'tl' | 'tr' | 'br' | 'top' | 'wide';

const PLACES: Record<TapePlace, string> = {
  tl: 'h-[22px] w-[74px] -top-[9px] -left-[22px] -rotate-[38deg]',
  tr: 'h-[22px] w-[74px] -top-[9px] -right-[22px] rotate-[38deg]',
  br: 'h-[22px] w-[74px] -bottom-[9px] -right-[22px] -rotate-[38deg]',
  top: 'h-[22px] w-[74px] -top-[11px] left-1/2 -ml-[37px] -rotate-3',
  wide: 'inset-0 -rotate-[0.6deg]',
};

/**
 * A strip of masking tape (Sketchbook primitives), 74×22 px with dotted ends: ±38° on a corner,
 * −3° centred on top, or `wide` under a whole strip (the code strip, the host bar). For the Screen
 * drawing, word cards, notes, the QR and landing cards; never over the drawer's pad.
 */
export function Tape({ place, className = '' }: { place: TapePlace; className?: string }) {
  return (
    <span
      aria-hidden
      data-tape={place}
      className={`pointer-events-none absolute z-[3] border-x-2 border-dotted border-x-tape-edge bg-tape ${PLACES[place]} ${className}`.trim()}
    />
  );
}
