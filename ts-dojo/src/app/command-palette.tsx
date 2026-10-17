// The Ctrl-p command palette (spec §6): one list, fuzzy-matched, of every ex command (lessons
// and exercises join when the content registry exists, F6/F8). `Enter` runs the item through
// the mounted editor, or opens the `:` line pre-filled when the command takes a free argument;
// `Esc` closes and the dialog restores focus to where it was. Without an editor on the page
// only `:help` and `:roadmap` have a target; the rest say so.
import { useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { paletteCommands, type PaletteCommand } from '@/editor/ex-commands';
import { getActiveEditor } from '@/editor/registry';
import { useAppActions } from './app-actions';

const ITEMS = paletteCommands();

/** The search text cmdk matches: the label, the aliases and the description. */
export function paletteKeywords(item: PaletteCommand): string[] {
  return [...item.aliases, item.description];
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = useAppActions();
  const [notice, setNotice] = useState<string | null>(null);

  const run = (item: PaletteCommand): void => {
    onOpenChange(false);
    const editor = getActiveEditor();
    if (editor !== null) {
      // The dialog hands focus back to the editor on close; run after that so the
      // notification panel and the `:` prompt land in a focused editor.
      setTimeout(() => {
        if (item.input === null) editor.prefillEx(item.prefill);
        else editor.runEx(item.input);
      }, 0);
      return;
    }
    if (item.input === 'help') actions.openHelp();
    else if (item.input === 'roadmap') actions.goToRoadmap();
    else setNotice(`${item.label} needs an editor on the page`);
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
      <Command>
        <CommandInput placeholder="Type a command…" aria-label="Command" />
        <CommandList>
          <CommandEmpty>No match.</CommandEmpty>
          <CommandGroup heading="Commands">
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
