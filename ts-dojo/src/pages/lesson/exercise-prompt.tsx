// The exercise prompt (§1: Markdown; §6 "the prompt" above the editor; `:prompt` shows or hides
// it). Compiled at build time into its own chunk (src/content/node/vite-plugin.ts) and loaded
// on first render, so nothing parses Markdown in the browser.
import { useEffect, useState } from 'react';
import type { MDXContent } from 'mdx/types';
import type { EditorExercise } from '@/content/build-registry';
import { loadPrompt } from '@/content/registry';

export function ExercisePrompt({ exercise }: { exercise: EditorExercise }) {
  const [loaded, setLoaded] = useState<{
    id: string;
    Content: MDXContent;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadPrompt(exercise).then((Content) => {
      if (!cancelled) setLoaded({ id: exercise.id, Content });
    });
    return () => {
      cancelled = true;
    };
  }, [exercise]);
  const Content = loaded?.id === exercise.id ? loaded.Content : null;
  return (
    <div
      className="prompt max-h-48 shrink-0 overflow-auto border-b px-3 py-1"
      data-testid="prompt"
    >
      {Content === null ? (
        <p className="text-muted-foreground">loading the prompt</p>
      ) : (
        <Content />
      )}
    </div>
  );
}
