import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Not found',
};

export default function NotFound() {
  return (
    // 10rem / 11rem: the header (64 / 80px) plus main's py-12. The bottom padding
    // lifts it to the optical centre.
    <div className="flex min-h-[calc(100svh-10rem)] flex-col items-center justify-center pb-[8svh] text-center md:min-h-[calc(100svh-11rem)]">
      <h1 className="text-2xl font-semibold tracking-tight">404</h1>
      <Link
        href="/"
        className="focus-ring text-muted-foreground hover:text-foreground mt-3 rounded-sm text-sm transition-colors"
      >
        Back home
      </Link>
    </div>
  );
}
