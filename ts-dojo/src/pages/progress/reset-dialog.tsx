// The confirmation every §7 reset scope asks for: "Each asks for a confirmation; everything
// asks to type the word `reset`." One lesson or one module confirms with the Reset button
// (Cancel has the focus, so `Enter` alone never resets); everything keeps Reset disabled until
// the word is typed, and `Enter` in the field submits once it is.
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const RESET_WORD = 'reset';

export type ResetRequest =
  | { scope: 'lesson'; id: string; title: string }
  | { scope: 'module'; id: string; title: string; lessons: readonly string[] }
  | { scope: 'everything' };

function describe(request: ResetRequest): { title: string; body: string } {
  switch (request.scope) {
    case 'lesson':
      return {
        title: `Reset the lesson ${request.title}?`,
        body: 'Its theory, answers, exercise files, hints, solutions and attempts are removed.',
      };
    case 'module':
      return {
        title: `Reset the module ${request.title}?`,
        body: `All ${String(request.lessons.length)} of its lessons lose their theory, answers, exercise files, hints, solutions and attempts.`,
      };
    case 'everything':
      return {
        title: 'Reset everything?',
        body: 'Every lesson, exercise, attempt and REPL buffer is removed. Settings stay. Export first if you may want it back.',
      };
  }
}

export function ResetDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ResetRequest | null;
  onCancel: () => void;
  onConfirm: (request: ResetRequest) => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const word = useRef<HTMLInputElement>(null);
  const wordId = useId();
  const [typed, setTyped] = useState('');
  const everything = request?.scope === 'everything';
  const ready = request !== null && (!everything || typed === RESET_WORD);
  const text = request === null ? null : describe(request);
  const confirm = (): void => {
    if (request === null || !ready) return;
    setTyped('');
    onConfirm(request);
  };
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTyped('');
          onCancel();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={everything ? word : cancel}
        data-reset={request?.scope}
      >
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <DialogHeader>
            <DialogTitle>{text?.title}</DialogTitle>
            <DialogDescription>{text?.body}</DialogDescription>
          </DialogHeader>
          {everything && (
            <div className="flex flex-col gap-1 text-sm">
              <label htmlFor={wordId}>
                Type <span className="font-mono">{RESET_WORD}</span> to confirm
              </label>
              <Input
                id={wordId}
                ref={word}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              ref={cancel}
              type="button"
              variant="outline"
              onClick={() => {
                setTyped('');
                onCancel();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready}>
              Reset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
