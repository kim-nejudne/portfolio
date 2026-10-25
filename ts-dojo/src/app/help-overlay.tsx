// The `?` keyboard help overlay (spec §6 Global keys): the global keys table, the §4 ex command
// table, and "What Vim mode can't do", the gaps list from the Prep spike.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EX_COMMANDS } from '@/editor/ex-commands';
import { VIM_GAPS } from '@/editor/gaps';
import { GLOBAL_KEYS } from './keys';

export function HelpOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85svh] overflow-y-auto sm:max-w-2xl"
        titleBar="man ts-dojo"
      >
        <DialogHeader>
          <DialogTitle>Keyboard help</DialogTitle>
          <DialogDescription>
            Global keys fire when the editor does not have focus. Inside the
            editor every key is Vim&apos;s, and the ex commands reach the app.
          </DialogDescription>
        </DialogHeader>
        <section
          aria-labelledby="help-global-keys"
          className="flex flex-col gap-2"
        >
          <h3
            id="help-global-keys"
            className="section-heading text-sm font-semibold"
          >
            Global keys
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {GLOBAL_KEYS.map((row) => (
                <tr key={row.keys} className="border-t">
                  <th
                    scope="row"
                    className="w-56 py-1 pr-4 text-left font-mono font-normal"
                  >
                    {row.keys}
                  </th>
                  <td className="py-1 text-muted-foreground">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section
          aria-labelledby="help-ex-commands"
          className="flex flex-col gap-2"
        >
          <h3
            id="help-ex-commands"
            className="section-heading text-sm font-semibold"
          >
            Ex commands
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {EX_COMMANDS.map((row) => (
                <tr key={row.label} className="border-t">
                  <th
                    scope="row"
                    className="w-56 py-1 pr-4 text-left font-mono font-normal"
                  >
                    {row.label}
                    {row.variants !== undefined && row.variants.length > 1 && (
                      <span className="text-muted-foreground">
                        {' '}
                        …{row.variants.slice(1).join(' / ')}
                      </span>
                    )}
                    {row.aliases.length > 0 && (
                      <span className="text-muted-foreground">
                        {' '}
                        {row.aliases.join(' ')}
                      </span>
                    )}
                  </th>
                  <td className="py-1 text-muted-foreground">
                    {row.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section
          aria-labelledby="help-vim-gaps"
          className="flex flex-col gap-2"
        >
          <h3
            id="help-vim-gaps"
            className="section-heading text-sm font-semibold"
          >
            What Vim mode can&apos;t do
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {VIM_GAPS.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
