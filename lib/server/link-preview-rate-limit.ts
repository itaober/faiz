const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_RATE_LIMIT_ENTRIES = 1000;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

/** Consumes one rate-limit slot and reports whether the request may proceed. */
export const allowLinkPreviewRequest = (headers: Headers) => {
  const now = Date.now();
  if (rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, entry] of rateLimits) {
      if (entry.resetAt <= now) {
        rateLimits.delete(key);
      }
    }
    while (rateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
      const oldestKey = rateLimits.keys().next().value;
      if (!oldestKey) {
        break;
      }
      rateLimits.delete(oldestKey);
    }
  }

  // Vercel overwrites this header with the public client IP. Outside Vercel,
  // ponytail: use one global bucket rather than trusting spoofable proxy headers.
  const key = process.env.VERCEL
    ? headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'global'
    : 'global';
  const entry = rateLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimits.delete(key);
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
};
