// The exercise header (§6 Lesson page): "the kind, minutes, hints used and whether the
// solution was viewed".
import type { Exercise } from '@/content/build-registry';
import type { ExerciseRow } from '@/store/db';

export function ExerciseHeader({
  exercise,
  row,
}: {
  exercise: Exercise;
  row: ExerciseRow | undefined;
}) {
  const hints = exercise.kind === 'predict' ? 0 : exercise.hints.length;
  const used = row?.hintsUsed ?? 0;
  return (
    <header
      className="shrink-0 border-b px-3 py-2"
      data-testid="exercise-header"
    >
      <h2 className="text-sm font-semibold">{exercise.title}</h2>
      <p className="m-0 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        <span data-field="kind">{exercise.kind}</span>
        <span data-field="minutes">{exercise.minutes} min</span>
        {exercise.challenge && <span data-field="challenge">challenge</span>}
        {hints > 0 && (
          <span data-field="hints">
            hints {used}/{hints}
          </span>
        )}
        {row?.solutionViewed === true && (
          <span data-field="solution-viewed" className="text-foreground">
            solution viewed
          </span>
        )}
      </p>
    </header>
  );
}
