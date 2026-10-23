// The theory pane's content (spec §1 Lesson anatomy, §6 Lesson page): the objectives at the
// top, then the lesson's compiled MDX with the §3 components. The component is loaded on first
// render (one chunk per lesson); nothing is fetched beyond the app's own assets.
import { useEffect, useState, type ComponentType } from 'react';
import type { MDXComponents } from 'mdx/types';
import type { Lesson } from '../build-registry';
import { loadLessonContent } from '../registry';
import { Callout } from './callout';
import { CodeBlock } from './code-block';
import { CodeStyles } from './code-styles';
import { Key } from './key';
import { LessonContext } from './lesson-context';
import { LessonLink } from './lesson-link';
import { Predict } from './predict';

/**
 * The §3 MDX components plus the build-time `<CodeBlock>` every fence became and the
 * lesson's `<CodeStyles>`.
 */
export const MDX_COMPONENTS: MDXComponents = {
  Callout,
  CodeBlock,
  CodeStyles,
  Key,
  Lesson: LessonLink,
  Predict,
};

type Content = ComponentType<{ components?: MDXComponents }>;

export function Theory({ lesson }: { lesson: Lesson }) {
  const [content, setContent] = useState<{
    id: string;
    Content: Content;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadLessonContent(lesson).then((Content) => {
      if (!cancelled) setContent({ id: lesson.id, Content });
    });
    return () => {
      cancelled = true;
    };
  }, [lesson]);
  const Content = content?.id === lesson.id ? content.Content : null;
  return (
    <LessonContext value={lesson}>
      <article className="theory" data-lesson={lesson.id} aria-label="Theory">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {lesson.title}
          </h1>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {lesson.minutes} min · {lesson.module}
          </p>
          <ul
            className="objectives mt-3 list-disc pl-6 text-sm"
            aria-label="Objectives"
          >
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </header>
        {Content === null ? (
          <p role="status" className="text-sm text-muted-foreground">
            loading theory
          </p>
        ) : (
          <Content components={MDX_COMPONENTS} />
        )}
      </article>
    </LessonContext>
  );
}
