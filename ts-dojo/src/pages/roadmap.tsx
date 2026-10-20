// `/` Roadmap (spec §6 Roadmap): the tiers from `roadmap.yaml` as bands, each with its modules
// as cards showing lessons complete out of total and the module's state from the store. F8
// builds this much so a completed lesson shows (§12 F8 criterion 3); F9 adds the progress
// rings, the prerequisite edges, "Recommended first", the Continue bar and the keys.
import { Link } from 'react-router';
import { cn } from 'cn';
import { registry } from '@/content/registry';
import { lessonStateOf, moduleState } from '@/store/completion';
import { getDb, type LessonRow } from '@/store/db';
import { useLiveQuery } from '@/store/use-live-query';
import { STATE_LABEL } from './module';

export function RoadmapPage() {
  const rows = useLiveQuery('roadmap', () => getDb().lessons.toArray());
  const byId = new Map<string, LessonRow>(
    (rows ?? []).map((row) => [row.id, row]),
  );
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>
      {registry.tiers.map((tier) => (
        <section key={tier.id} aria-label={tier.title} data-tier={tier.id}>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {tier.title}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-3">
            {tier.modules.map((moduleId) => {
              const module = registry.module(moduleId);
              if (module === undefined) return null;
              const states = module.lessons.map((id) =>
                lessonStateOf(byId.get(id)),
              );
              const complete = states.filter((s) => s === 'complete').length;
              const state = moduleState(states);
              return (
                <li key={moduleId}>
                  <Link
                    to={`/m/${moduleId}`}
                    data-module={moduleId}
                    data-state={state}
                    className={cn(
                      'flex w-64 flex-col gap-1 rounded-md border px-4 py-3',
                      state === 'complete' && 'bg-accent',
                      state === 'in-progress' && 'border-ring',
                    )}
                  >
                    <span className="font-medium">{module.title}</span>
                    <span
                      className="text-xs text-muted-foreground"
                      data-field="progress"
                    >
                      {complete} of {module.lessons.length} lessons complete
                    </span>
                    <span className="text-xs" data-field="state">
                      {STATE_LABEL[state]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
