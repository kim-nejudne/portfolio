// A Select over Base UI (https://base-ui.com/react/components/select), in shadcn's shape and
// the terminal look (25 October 2026): the trigger reads like a status-bar field, the popup is
// a square bordered list, the highlighted item sits on the selection colour behind an accent
// bar. Keyboard: Space, Enter and the arrows open and move, type-ahead jumps, Escape closes.
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { cn } from 'cn';

function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('truncate', className)}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'inline-flex h-full items-center gap-1 border border-transparent px-2 font-mono text-xs whitespace-nowrap text-foreground transition-colors outline-none hover:bg-selection focus-visible:bg-foreground focus-visible:text-background data-popup-open:bg-foreground data-popup-open:text-background disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="opacity-70" aria-hidden="true">
        ▾
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  side = 'top',
  align = 'end',
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, 'side' | 'align' | 'sideOffset'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'max-h-[min(24rem,var(--available-height))] min-w-(--anchor-width) overflow-y-auto border bg-popover py-1 font-mono text-xs text-popover-foreground outline-none',
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'group/select-item flex cursor-default items-center gap-2 border-l-2 border-transparent py-1 pr-3 pl-2 outline-none select-none data-highlighted:border-link data-highlighted:bg-selection data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        className="invisible w-3 shrink-0 text-link group-data-selected/select-item:visible"
        keepMounted
        render={<span />}
      >
        ❯
      </SelectPrimitive.ItemIndicator>
      {children}
    </SelectPrimitive.Item>
  );
}

function SelectItemText({
  className,
  ...props
}: SelectPrimitive.ItemText.Props) {
  return (
    <SelectPrimitive.ItemText
      data-slot="select-item-text"
      className={cn('flex-1', className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectItemText,
};
