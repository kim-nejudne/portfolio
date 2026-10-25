// shadcn's Button over Base UI, restyled as a terminal command (25 October 2026): `[ run ]`,
// a 1px border, square, monospace, and the colours inverted on hover and keyboard focus. The
// brackets are CSS generated content with empty alternative text (`.btn-term` in globals.css),
// so a button's accessible name and text stay its own words.
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const buttonVariants = cva(
  "btn-term group/button inline-flex shrink-0 items-center justify-center gap-1 border bg-transparent font-mono text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'border-primary text-primary hover:bg-primary hover:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground aria-expanded:bg-primary aria-expanded:text-primary-foreground',
        outline:
          'border-border text-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background aria-expanded:bg-foreground aria-expanded:text-background',
        secondary:
          'border-border bg-secondary text-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background aria-expanded:bg-foreground aria-expanded:text-background',
        ghost:
          'border-transparent text-muted-foreground hover:bg-foreground hover:text-background focus-visible:bg-foreground focus-visible:text-background aria-expanded:bg-foreground aria-expanded:text-background',
        destructive:
          'border-destructive text-destructive hover:bg-destructive hover:text-background focus-visible:bg-destructive focus-visible:text-background',
        link: 'border-transparent text-link underline underline-offset-4 before:content-none after:content-none hover:text-foreground',
      },
      size: {
        default: 'h-8 px-1.5',
        xs: "h-6 gap-0.5 px-1 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 px-1 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 px-2',
        icon: 'size-8',
        'icon-xs': "size-6 gap-0 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7 gap-0',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
