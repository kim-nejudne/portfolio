import type { ScreenView } from '../../../../shared/types.js';
import { AWARD_COPY } from '../../lib/awards.js';
import type { Translate } from '../../lib/copy.js';
import type { ScreenLayout } from '../../lib/screen.js';

/**
 * FINAL's Tonight's awards (computed by the server on entering FINAL): one card per award, in the
 * spec's order, between the scores and the gallery. A winner who left since is still named from
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
    // The heading sits left of the cards in landscape, where height is short, and above them in
    // portrait.
    <section
      aria-labelledby="awards-title"
      className={`flex w-full max-w-[160vmin] shrink-0 gap-[1.2vmin] ${
        layout === 'landscape' ? 'flex-row items-center' : 'flex-col items-center'
      }`}
    >
      <h2
        id="awards-title"
        className={`text-[max(2.4vmin,12px)] leading-tight font-bold tracking-wide text-white/70 uppercase ${
          layout === 'landscape' ? 'w-[max(15vmin,80px)] shrink-0 pr-[1vmin] break-words' : ''
        }`}
      >
        {t('awardsTitle')}
      </h2>
      {/* As many cards per row as fit at a legible width: all six on a TV, four on a 4:3 tablet. */}
      <ul className="grid w-full min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,max(26vmin,140px)),1fr))] gap-[1.2vmin]">
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
              className="flex min-w-0 flex-col items-center rounded-[1.5vmin] bg-white/10 px-[1.5vmin] py-[0.6vmin] text-center leading-[1.1] motion-safe:animate-pop"
              // One after another, as at an awards night.
              style={{ animationDelay: `${300 + i * 150}ms` }}
            >
              <span className="w-full truncate text-[max(2.8vmin,14px)] font-bold">
                {t(copy.name)}
              </span>
              <span
                className="w-full truncate font-display text-[max(3.6vmin,17px)] font-bold"
                style={{ color: who?.color }}
              >
                {who?.name ?? ''}
              </span>
              <span className="w-full truncate text-[max(2.4vmin,13px)] text-white/80">
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
