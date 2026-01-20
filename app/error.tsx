'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-full border border-neutral-200 dark:border-neutral-800">
        <span className="text-lg">!</span>
      </div>
      <h2 className="text-lg font-medium">Something went wrong</h2>
      <p className="max-w-sm text-center text-sm opacity-60">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="bg-foreground/10 hover:bg-foreground/20 flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors"
      >
        <RefreshCw className="size-4" />
        Try again
      </button>
    </div>
  );
}
