// `/l/:lesson` and `/l/:lesson/:exercise` (spec §6): theory and practice side by side. F8.
// Matched as `l/*` because lesson ids contain a slash; see src/app/lesson-path.ts.
import { useParams } from 'react-router';
import { parseLessonPath } from '@/app/lesson-path';
import { Placeholder } from './placeholder';

export function LessonPage() {
  const { '*': splat } = useParams();
  const path = parseLessonPath(splat);
  if (path === null) {
    return (
      <Placeholder
        title="Lesson not found"
        detail={`/l/${splat ?? ''}`}
        feature="F8 (lesson page)"
      />
    );
  }
  return (
    <Placeholder
      title={`Lesson ${path.lesson}`}
      detail={
        path.exercise === undefined
          ? 'exercise: first unfinished'
          : `exercise: ${path.exercise}`
      }
      feature="F8 (lesson page)"
    />
  );
}
