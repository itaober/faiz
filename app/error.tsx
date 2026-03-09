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
      <div className="border-border bg-muted/35 flex size-12 items-center justify-center rounded-full border">
        <span className="text-lg">!</span>
      </div>
      <h2 className="text-lg font-medium">Something went wrong</h2>
      <p className="text-muted-foreground max-w-sm text-center text-sm">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="bg-muted hover:bg-muted/80 flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors"
      >
        <RefreshCw className="size-4" />
        Try again
      </button>
    </div>
  );
}
