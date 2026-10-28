/** Bulbs per chase step: every sixth bulb dims together, so the dimming runs along the rail. */
const CHASE_STEPS = 6;
const CHASE_MS = 1600;

interface BulbRailProps {
  /** How many bulbs. A rail spreads them edge to edge; a row keeps them close and centred. */
  count: number;
  /** `rail`: a full-width strip on `bg-deep`. `row`: a short centred line of smaller bulbs. */
  variant?: 'rail' | 'row';
  /**
   * Bulb size (`--bulb`) and strip padding, replacing the variant's px defaults: the Screen passes
   * viewport units so the rail scales to any TV.
   */
  size?: string;
}

/**
 * The marquee bulbs of the "Prime Time" theme: gold circles with a glow (10px on a 12px bulb), and a slow chase that
 * dims them in sequence. The chase is off under prefers-reduced-motion. Decorative only.
 */
export function BulbRail({ count, variant = 'rail', size }: BulbRailProps) {
  const rail = variant === 'rail';
  const sizing = size ?? (rail ? 'px-6 py-[14px] [--bulb:12px]' : 'gap-3 [--bulb:10px]');
  return (
    <div
      aria-hidden="true"
      data-bulbs={variant}
      className={`flex shrink-0 items-center ${rail ? 'justify-between bg-bg-deep' : 'justify-center'} ${sizing}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={{ animationDelay: `${((i % CHASE_STEPS) * CHASE_MS) / CHASE_STEPS}ms` }}
          className="size-(--bulb) shrink-0 rounded-full bg-accent shadow-[0_0_calc(var(--bulb)*0.83)_var(--color-accent)] motion-safe:animate-bulb-chase"
        />
      ))}
    </div>
  );
}
