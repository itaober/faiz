interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_ENTRIES = 1000;

/**
 * Fixed-window limiter keyed by client IP.
 * ponytail: per instance memory, so the ceiling multiplies with warm instances; move to a shared
 * store if a limit ever has to be exact.
 */
export const createRateLimiter = ({ windowMs, max }: { windowMs: number; max: number }) => {
  const entries = new Map<string, RateLimitEntry>();

  return (headers: Headers) => {
    const now = Date.now();
    if (entries.size >= MAX_ENTRIES) {
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) {
          entries.delete(key);
        }
      }
      while (entries.size >= MAX_ENTRIES) {
        const oldestKey = entries.keys().next().value;
        if (!oldestKey) {
          break;
        }
        entries.delete(oldestKey);
      }
    }

    // Vercel overwrites this header with the public client IP. Outside Vercel,
    // ponytail: use one global bucket rather than trusting spoofable proxy headers.
    const key = process.env.VERCEL
      ? headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'global'
      : 'global';
    const entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      entries.delete(key);
      entries.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    entry.count += 1;
    return entry.count <= max;
  };
};
