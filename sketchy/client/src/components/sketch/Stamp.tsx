import type { ReactNode } from 'react';

/**
 * A red-pen stamp (Sketchbook primitives): a number in Nunito 900 in `red` inside a 3 px `red`
 * oval, with an optional Patrick Hand caption under it ("+270" / "this turn"). Level, like all
 * gameplay text. `big` is the results' stamp (44 px); the default is 30 px.
 */
export function Stamp({
  value,
  caption,
  big = false,
  className = '',
}: {
  value: ReactNode;
  caption?: ReactNode;
  big?: boolean;
  className?: string;
}) {
  return (
    <span
      data-stamp
      className={`inline-grid justify-items-center rounded-[50%] border-[3px] border-red font-num leading-none font-black text-red tabular-nums ${
        big ? 'px-[26px] py-4 text-[44px]' : 'px-4 py-2.5 text-[30px]'
      } ${className}`.trim()}
    >
      {value}
      {caption != null && (
        <small className="mt-0.5 font-hand text-[15px] font-normal">{caption}</small>
      )}
    </span>
  );
}
