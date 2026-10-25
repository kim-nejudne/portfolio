// A `predict` exercise on the lesson page (§1 Exercise kinds, §6: "`predict` exercises replace
// the editor with the snippet, the options (`j`/`k`, `Enter`) and, after answering, the
// explanation"). The question is the practice side's "editor" focus target (`2`, `Esc`,
// `Ctrl-l` from the theory). Each answer is recorded (§7 `predictAnswer`); a correct one passes
// the exercise for good, and retries are allowed.
import type { Ref } from 'react';
import type { PredictExercise } from '@/content/build-registry';
import { Question } from '@/content/components/question';
import type { ExerciseRow } from '@/store/db';
import { recordPredictAnswer } from '@/store/progress';
import { useLessonController } from './controller';
import { ExerciseHeader } from './exercise-header';

export function PredictPanel({
  exercise,
  row,
  questionRef,
}: {
  exercise: PredictExercise;
  row: ExerciseRow | undefined;
  questionRef: Ref<HTMLElement>;
}) {
  const lesson = useLessonController();
  return (
    <section
      data-pane="editor"
      aria-label="Predict"
      data-exercise={exercise.id}
      data-kind="predict"
      className="flex min-h-0 flex-1 flex-col overflow-auto"
    >
      <ExerciseHeader exercise={exercise} row={row} />
      <div className="px-3">
        <Question
          ref={questionRef}
          id={exercise.id}
          question={exercise.question}
          options={exercise.options}
          answer={exercise.answer}
          explanation={exercise.explanation}
          code={exercise.code}
          chosen={row?.predictAnswer}
          onAnswer={(index) => {
            const correct = index === exercise.answer;
            void recordPredictAnswer(
              exercise.id,
              exercise.lesson,
              index,
              correct,
            ).then(() => {
              if (correct) lesson.refreshCompletion();
            });
          }}
          dataAttributes={{ 'data-predict-exercise': exercise.id }}
        />
      </div>
    </section>
  );
}
