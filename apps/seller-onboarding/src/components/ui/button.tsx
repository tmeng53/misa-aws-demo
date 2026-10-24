import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from 'radix-ui';

// Misa's buttons (the design system's Button): `lg` is the call to action (16px, radius-xl), `default` the
// header size (14.5px, radius-lg), `sm` the compact size in lists and cards (radius-md).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-[14.5px] font-medium whitespace-nowrap transition-[opacity,background-color,color,border-color] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        outline:
          'border-border bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
        ghost:
          'font-normal text-muted-foreground hover:text-foreground aria-expanded:text-foreground',
        destructive:
          'bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default:
          'h-9 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3',
        xs: "h-7 gap-1 rounded-md px-2.5 text-[12.5px] [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-[13.5px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-12 gap-2 rounded-xl px-5 text-[16px] leading-6',
        icon: 'size-9',
        'icon-xs': "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        'icon-sm': 'size-8 rounded-md',
        'icon-lg': 'size-12 rounded-xl',
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
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
