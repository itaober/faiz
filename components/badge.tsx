import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-foreground text-background [a&]:hover:bg-foreground/88 dark:[a&]:hover:bg-foreground/88',
        secondary: 'border-transparent bg-muted text-foreground [a&]:hover:bg-muted/80',
        outline:
          'border-border bg-transparent text-muted-foreground [a&]:hover:bg-muted/65 [a&]:hover:text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
