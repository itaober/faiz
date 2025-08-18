import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 dark:focus-visible:ring-blue-400/40',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gray-700 text-white dark:bg-gray-200 dark:text-black [a&]:hover:bg-gray-800 dark:[a&]:hover:bg-gray-300',
        secondary:
          'border-transparent bg-gray-200 text-black [a&]:hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:[a&]:hover:bg-gray-800',
        outline:
          'border-gray-300 text-gray-900 [a&]:hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:[a&]:hover:bg-gray-700',
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
