import { cn } from '@/lib/utils';

/**
 * Page-level entrance animation.
 *
 * Pure CSS (`.fz-enter` in globals.css) rather than a motion component: the JS
 * version rendered its children at opacity 0, so server HTML arrived invisible
 * and only appeared after hydration — indefinitely in a background tab, where
 * rAF is throttled. This is a server component now, so the wrapper costs no
 * client JS either.
 */
export default function MotionWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('fz-enter', className)}>{children}</div>;
}
