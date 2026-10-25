// The import preview (§7: "shows what it would change (lessons, exercises, attempts, buffers,
// settings) and applies on confirmation"): one line per category from `planImport`, a note
// when the file comes from other content or its compiler defaults were refused (F10), and
// Apply / Cancel. Cancel has the focus.
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ImportPlan } from '@/store/import';
import { previewLines } from './preview';

export function ImportDialog({
  name,
  plan,
  refused = [],
  onCancel,
  onApply,
}: {
  /** The file's name. */
  name: string;
  plan: ImportPlan | null;
  /** TypeScript's reasons for leaving the file's compiler defaults out (F10). */
  refused?: string[];
  onCancel: () => void;
  onApply: (plan: ImportPlan) => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={cancel}
        data-import=""
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Import {name}?</DialogTitle>
          <DialogDescription>
            Rows merge by id and the newer one wins; attempts are added; a
            passed exercise stays passed. The settings become the file&apos;s.
          </DialogDescription>
        </DialogHeader>
        {plan !== null && (
          <>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              {previewLines(plan).map(([category, line]) => (
                <div
                  key={category}
                  className="contents"
                  data-category={category}
                >
                  <dt className="font-medium capitalize">{category}</dt>
                  <dd className="text-muted-foreground" data-field="change">
                    {line}
                  </dd>
                </div>
              ))}
            </dl>
            {refused.length > 0 && (
              <p className="text-xs" data-field="settings-refused">
                The file&apos;s compiler defaults are left out: TypeScript says{' '}
                {refused.join(' ')}
              </p>
            )}
            {!plan.contentVersion.matches && (
              <p className="text-xs" data-field="content-version">
                Exported from other content (
                {plan.contentVersion.file.slice(0, 12)}, this build{' '}
                {plan.contentVersion.app.slice(0, 12)}); renamed ids are moved,
                removed lessons are kept as orphaned.
              </p>
            )}
          </>
        )}
        <DialogFooter>
          <Button ref={cancel} variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (plan !== null) onApply(plan);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
