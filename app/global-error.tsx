'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="bg-background text-foreground flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6">
          <h2 className="text-lg font-medium">Critical Error</h2>
          <p className="text-sm opacity-60">{error.message}</p>
          <button
            onClick={reset}
            className="bg-foreground/10 hover:bg-foreground/20 rounded-md px-4 py-2 text-sm transition-colors"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
