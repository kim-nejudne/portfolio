import type { ScreenView } from '../../../../shared/types.js';
import { AWARD_COPY } from '../../lib/awards.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenLayout } from '../../lib/screen.js';
import { Tape } from '../sketch/Tape.js';

/**
 * FINAL's Tonight's awards (computed by the server on entering FINAL): one sticky note per award
 * (F66), in the spec's order, at the head of the final's right page, before the gallery. A winner who left since is still named from
 * the night's totals.
 */
export function ScreenAwards({
  view,
  layout,
  t,
}: {
  view: ScreenView;
  layout: ScreenLayout;
  t: Translate;
}) {
  if (view.awards.length === 0) return null;
  const people = new Map<string, { name: string; color: string }>();
  for (const row of view.tonight ?? []) people.set(row.pid, row);
  for (const p of view.players) people.set(p.pid, p);
  return (
    <section
      aria-labelledby="awards-title"
      data-awards
      className="flex w-full shrink-0 flex-col gap-[1.2vmin]"
    >
      <h2
        id="awards-title"
        className="font-num text-[max(2.2vmin,12px)] font-black tracking-[0.14em] text-soft uppercase"
      >
        {t('awardsTitle')}
      </h2>
      {/* Sticky notes, as many per row as fit at a legible width: three on a TV's right page,
          two on a 4:3 one; the player's crayon down the note's left edge. */}
      <ul
        className={`grid w-full min-w-0 gap-x-[1.6vmin] gap-y-[max(2.4vmin,16px)] pt-[11px] ${
          layout === 'portrait'
            ? 'grid-cols-[repeat(auto-fit,minmax(min(100%,max(28vmin,140px)),1fr))]'
            : 'grid-cols-[repeat(auto-fit,minmax(min(100%,max(24vmin,130px)),1fr))]'
        }`}
      >
        {view.awards.map((award, i) => {
          const who = people.get(award.pid);
          const copy = AWARD_COPY[award.kind];
          // Modern art points at its drawing; the word is public by FINAL (the gallery shows it).
          const word =
            award.kind === 'modernArt'
              ? view.gallery.find((g) => g.turnId === award.turnId)?.word
              : undefined;
          return (
            <li
              key={award.kind}
              data-award={award.kind}
              className="relative flex min-w-0 flex-col border-l-[length:max(4px,0.8vmin)] bg-sticky px-[1.4vmin] pt-[max(18px,2.4vmin)] pb-[0.6vmin] leading-[1.1] text-ink shadow-[0.4vmin_0.4vmin_0_var(--color-ink)] motion-safe:animate-pop"
              // One after another, as at an awards night; the note's edge in the winner's crayon.
              style={{ animationDelay: `${300 + i * 150}ms`, borderLeftColor: who?.color }}
            >
              <Tape place="top" />
              {/* "🎨 Picasso Mika" (the mockup's note), the name wrapping under the award rather
                  than cut short; the reason under them. */}
              <span className="flex w-full min-w-0 flex-wrap items-baseline gap-x-[0.35em] text-[max(3.5vmin,16px)]">
                <span className="shrink-0">{t(copy.name)}</span>
                <span className="min-w-0 break-words" style={{ color: who?.color }}>
                  {who?.name ?? ''}
                </span>
              </span>
              <span className="w-full truncate text-[max(2.4vmin,13px)] text-ink">
                {t(copy.why)}
                {word ? `: ${word}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
