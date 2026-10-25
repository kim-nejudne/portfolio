// `<Lesson id>` (spec §3 MDX components): a link to a lesson by id, showing its title; its
// progress state joins at F9 (§7). An unknown id renders the id itself, never a broken link.
import { Link } from 'react-router';
import { lessonHref } from '@/app/lesson-path';
import { registry } from '../registry';

export function LessonLink({ id }: { id: string }) {
  const lesson = registry.lesson(id);
  if (lesson === undefined) {
    return <code className="text-destructive">{id}</code>;
  }
  return (
    <Link
      to={lessonHref(lesson.id)}
      className="lesson-link"
      data-lesson={lesson.id}
    >
      {lesson.title}
    </Link>
  );
}
