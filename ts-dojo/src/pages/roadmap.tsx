// `/` Roadmap (spec §6 Roadmap): the Continue bar, then one band per tier of `roadmap.yaml`, top
// to bottom, its modules as cards in order. A card shows the title, lessons complete out of
// total, minutes remaining, the progress ring and the state, and "Recommended first: …" while a
// prerequisite is not complete; the card still opens. Prerequisite edges are SVG curves behind
// the cards, measured from the cards' boxes and redrawn when any of them resizes; an edge
// between neighbours in a band is implied and not drawn (roadmap/edges.ts). Keys: `j`/`k` move
// between cards in reading order, `h`/`l` within a band, `Enter` opens the focused card or the
// Continue bar (the links' own activation), `c` continues. Nothing is focused on load, so `?`
// and `Ctrl-p` start from the body as everywhere else.
import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { Link, useNavigate } from 'react-router';
import { cn } from 'cn';
import { lessonHref } from '@/app/lesson-path';
import { usePageKeys } from '@/app/use-page-keys';
import { registry } from '@/content/registry';
import { lessonStateOf } from '@/store/completion';
import { continueTarget, type ContinueTarget } from '@/store/continue';
import { getDb, type LessonRow } from '@/store/db';
import { useLiveQuery } from '@/store/use-live-query';
import { STATE_LABEL } from './module';
import { edgePath, roadmapEdges, type Box } from './roadmap/edges';
import {
  moduleCard,
  moduleStates,
  moveCard,
  readingOrder,
  type ModuleCard,
} from './roadmap/model';
import { ProgressRing } from './roadmap/progress-ring';

const BANDS = readingOrder(registry);
const EDGES = roadmapEdges(registry);

interface DrawnEdge {
  from: string;
  to: string;
  d: string;
}

export function continueHref(target: ContinueTarget): string {
  return lessonHref(target.lesson, target.exercise ?? undefined);
}

export function RoadmapPage() {
  const navigate = useNavigate();
  const rows = useLiveQuery('roadmap', () => getDb().lessons.toArray());
  const next = useLiveQuery('roadmap:continue', () =>
    continueTarget(getDb(), registry),
  );
  const cards = useMemo(() => {
    const byId = new Map<string, LessonRow>(
      (rows ?? []).map((row) => [row.id, row]),
    );
    const lessonState = (id: string) => lessonStateOf(byId.get(id));
    const states = moduleStates(registry, lessonState);
    return new Map(
      BANDS.flat().flatMap((id) => {
        const card = moduleCard(registry, id, lessonState, states);
        return card === null ? [] : [[id, card] as const];
      }),
    );
  }, [rows]);

  const cardElements = useRef(new Map<string, HTMLAnchorElement>());
  const target = next ?? null;

  usePageKeys((key) => {
    if (key === 'c') {
      if (target === null) return false;
      void navigate(continueHref(target));
      return true;
    }
    if (key !== 'j' && key !== 'k' && key !== 'h' && key !== 'l') return false;
    const active = document.activeElement;
    const current =
      active instanceof HTMLElement ? (active.dataset['module'] ?? null) : null;
    const id = moveCard(BANDS, current, key);
    const element = id === null ? undefined : cardElements.current.get(id);
    if (element === undefined) return false;
    element.focus();
    element.scrollIntoView({ block: 'nearest' });
    return true;
  });

  // The edges, measured once the cards are laid out and again whenever one resizes (a
  // "Recommended first" line appearing, a wrap at another width). ResizeObserver reports every
  // observed element once on observe, which draws the first frame.
  const map = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<DrawnEdge[]>([]);
  useEffect(() => {
    const container = map.current;
    if (container === null) return;
    const measure = (): void => {
      const origin = container.getBoundingClientRect();
      const box = (id: string): Box | null => {
        const rect = cardElements.current.get(id)?.getBoundingClientRect();
        return rect === undefined
          ? null
          : {
              x: rect.left - origin.left,
              y: rect.top - origin.top,
              width: rect.width,
              height: rect.height,
            };
      };
      setEdges(
        EDGES.flatMap((edge) => {
          const from = box(edge.from);
          const to = box(edge.to);
          return from === null || to === null
            ? []
            : [{ ...edge, d: edgePath(from, to) }];
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const element of cardElements.current.values()) {
      observer.observe(element);
    }
    return () => observer.disconnect();
  }, [cards]);
  const arrow = useId();

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex items-baseline gap-4">
        <h1 className="prompt-heading text-2xl font-semibold" data-cursor="">
          Roadmap
        </h1>
        <p className="text-xs text-muted-foreground">
          <Kbd>j</Kbd> <Kbd>k</Kbd> <Kbd>h</Kbd> <Kbd>l</Kbd> move,{' '}
          <Kbd>Enter</Kbd> opens, <Kbd>c</Kbd> continues
        </p>
      </div>
      {target !== null && <ContinueBar target={target} />}
      <div ref={map} className="relative flex flex-col gap-12">
        <svg
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
          aria-hidden="true"
          data-edges=""
        >
          <defs>
            <marker
              id={arrow}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 0 L 10 5 L 0 10 z"
                className="fill-(--roadmap-edge)"
              />
            </marker>
          </defs>
          {edges.map((edge) => (
            <path
              key={`${edge.from}→${edge.to}`}
              d={edge.d}
              data-from={edge.from}
              data-to={edge.to}
              fill="none"
              strokeWidth="2"
              markerEnd={`url(#${arrow})`}
              className="stroke-(--roadmap-edge)"
            />
          ))}
        </svg>
        {registry.tiers.map((tier) => (
          <section
            key={tier.id}
            aria-label={tier.title}
            data-tier={tier.id}
            className="flex flex-col gap-2"
          >
            <h2 className="section-heading relative z-10 w-fit bg-background pr-2 text-sm font-semibold text-muted-foreground">
              {tier.title}
            </h2>
            <ul className="flex flex-wrap gap-x-8 gap-y-6">
              {tier.modules.map((moduleId) => {
                const card = cards.get(moduleId);
                if (card === undefined) return null;
                return (
                  <li key={moduleId}>
                    <Card
                      card={card}
                      ref={(element) => {
                        if (element === null) return;
                        cardElements.current.set(moduleId, element);
                        return () => {
                          cardElements.current.delete(moduleId);
                        };
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd>{children}</kbd>;
}

function ContinueBar({ target }: { target: ContinueTarget }) {
  const verb = target.kind === 'start' ? 'Start' : 'Continue';
  return (
    <Link
      to={continueHref(target)}
      data-continue={target.kind}
      className="prompt-prefix flex flex-wrap items-baseline gap-x-3 gap-y-1 border px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:bg-selection"
    >
      <span className="font-medium">{verb}</span>
      <span data-field="exercise">
        {target.exerciseTitle ?? target.lessonTitle}
      </span>
      <span className="text-muted-foreground" data-field="lesson">
        {target.lessonTitle}
      </span>
      <span className="ml-auto text-xs text-muted-foreground">
        <Kbd>c</Kbd>
      </span>
    </Link>
  );
}

function Card({
  card,
  ref,
}: {
  card: ModuleCard;
  ref: Ref<HTMLAnchorElement>;
}) {
  return (
    <Link
      ref={ref}
      to={`/m/${card.id}`}
      data-module={card.id}
      data-state={card.state}
      className={cn(
        'term-pane relative z-10 flex w-64 flex-col outline-none focus-visible:border-ring focus-visible:[&>.term-title]:bg-foreground focus-visible:[&>.term-title]:text-background',
        card.state === 'in-progress' && 'border-(--progress)',
      )}
    >
      <span className="term-title">
        <span className="term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="truncate">{card.id}</span>
      </span>
      <span className="flex items-start gap-3 px-3 py-2">
        <ProgressRing progress={card.progress} state={card.state} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              'font-medium',
              card.state === 'not-started' && 'text-muted-foreground',
            )}
          >
            {card.title}
          </span>
          <span className="text-xs text-muted-foreground" data-field="progress">
            {card.lessonsComplete} of {card.lessonsTotal} lessons complete
          </span>
          <span className="text-xs text-muted-foreground" data-field="minutes">
            {card.minutesLeft} min left
          </span>
          {card.optionalLessons > 0 && (
            <span
              className="text-xs text-muted-foreground"
              data-field="optional"
            >
              {card.optionalLessons === 1
                ? '1 optional lesson'
                : `${String(card.optionalLessons)} optional lessons`}
            </span>
          )}
          <span className="text-xs" data-field="state">
            {STATE_LABEL[card.state]}
          </span>
          {card.recommendedFirst.length > 0 && (
            <span className="text-xs" data-field="recommended">
              Recommended first:{' '}
              {card.recommendedFirst.map((m) => m.title).join(', ')}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
