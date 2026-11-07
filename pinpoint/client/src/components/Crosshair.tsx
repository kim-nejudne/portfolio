/** The 44 px amber cross with an 8 px gap and a 2 px `--board-bg` outline, fixed at the map centre. */
export function Crosshair() {
  const arms = 'M22 0V18M22 26V44M0 22H18M26 22H44';
  return (
    <svg
      data-testid="crosshair"
      aria-hidden="true"
      width="48"
      height="48"
      viewBox="-2 -2 48 48"
      className="pointer-events-none absolute top-1/2 left-1/2 z-[500] -translate-1/2"
    >
      <path d={arms} stroke="var(--board-bg)" strokeWidth="7" strokeLinecap="square" />
      <path d={arms} stroke="var(--amber)" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}
