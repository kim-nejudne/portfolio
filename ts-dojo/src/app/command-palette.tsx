// The Ctrl-p command palette (spec §6): one list, fuzzy-matched (src/app/palette-filter.ts), of
// every ex command by name, the lessons by title and tags and the exercises by title. One cmdk
// group, so the best match across all three comes first and is selected (cmdk sorts the items
// within a group, not the groups). `Enter` opens a lesson or an exercise,
// or runs a command through the mounted editor (a command that takes a free argument opens the
// `:` line pre-filled); `Esc` closes and the dialog restores focus to where it was. A command
// about the page as a whole (`:next`, `:done`, `:focus down`) goes to the page first, from the
// pane that had the focus (F8); the rest go through the editor, and on a page with neither only
// `:help`, `:roadmap` and `:export` have a target; the rest say so.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { registry } from '@/content/registry';
import {
  paletteCommands,
  parseExInput,
  type PaletteCommand,
} from '@/editor/ex-commands';
import { getActiveEditor } from '@/editor/registry';
import { isEditorOwnAction } from '@/editor/host';
import { useAppActions } from './app-actions';
import { paletteScore } from './palette-filter';
import { lessonHref } from './lesson-path';
import { getPageActions } from './page-actions';

const ITEMS = paletteCommands();

/** The search text cmdk matches: the label, the aliases and the description. */
export function paletteKeywords(item: PaletteCommand): string[] {
  return [...item.aliases, item.description];
}

export function CommandPalette({
  open,
  onOpenChange,
  origin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element that had the focus when the palette opened. */
  origin: Element | null;
}) {
  const actions = useAppActions();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<string | null>(null);

  const openRoute = (to: string): void => {
    onOpenChange(false);
    void navigate(to);
  };

  const run = (item: PaletteCommand): void => {
    onOpenChange(false);
    const parsed = item.input === null ? null : parseExInput(item.input);
    const action =
      parsed !== null &&
      typeof parsed !== 'string' &&
      !isEditorOwnAction(parsed)
        ? parsed
        : null;
    // After the dialog has handed the focus back, so a page-level command (`:next`, `:focus
    // down`) knows which pane it came from and the editor's panel lands in a focused editor.
    setTimeout(() => {
      if (action !== null && getPageActions()?.ex?.(action, origin) === true) {
        return;
      }
      const editor = getActiveEditor();
      if (editor !== null) {
        if (item.input === null) editor.prefillEx(item.prefill);
        else editor.runEx(item.input);
        return;
      }
      if (item.input === 'help') actions.openHelp();
      else if (item.input === 'roadmap') actions.goToRoadmap();
      else if (item.input === 'export') void actions.exportProgress();
      else setNotice(`${item.label} needs an editor on the page`);
    }, 0);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (next) setNotice(null);
        onOpenChange(next);
      }}
      title="Command palette"
      description="Lessons, exercises and every ex command, fuzzy-matched"
    >
      <Command filter={paletteScore}>
        <CommandInput placeholder="Type a command…" aria-label="Command" />
        <CommandList>
          <CommandEmpty>No match.</CommandEmpty>
          <CommandGroup heading="Commands, lessons and exercises">
            {ITEMS.map((item) => (
              <CommandItem
                key={item.label}
                value={item.label}
                keywords={paletteKeywords(item)}
                onSelect={() => run(item)}
              >
                <span className="font-mono whitespace-nowrap">
                  {item.label}
                </span>
                <span className="truncate text-muted-foreground">
                  {item.description}
                </span>
              </CommandItem>
            ))}

            {registry.lessons.map((lesson) => (
              <CommandItem
                key={lesson.id}
                value={`lesson ${lesson.id}`}
                keywords={[lesson.title, ...lesson.tags]}
                onSelect={() => openRoute(lessonHref(lesson.id))}
              >
                <span className="whitespace-nowrap">{lesson.title}</span>
                <span className="truncate text-muted-foreground">
                  lesson · {lesson.id}
                </span>
              </CommandItem>
            ))}

            {registry.exercises.map((exercise) => (
              <CommandItem
                key={exercise.id}
                value={`exercise ${exercise.id}`}
                keywords={[exercise.title]}
                onSelect={() =>
                  openRoute(lessonHref(exercise.lesson, exercise.folder))
                }
              >
                <span className="whitespace-nowrap">{exercise.title}</span>
                <span className="truncate text-muted-foreground">
                  {exercise.kind} · {exercise.lesson}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      {notice !== null && (
        <p role="status" className="px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </p>
      )}
    </CommandDialog>
  );
}
