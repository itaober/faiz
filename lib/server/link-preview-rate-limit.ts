import { createRateLimiter } from '@/lib/server/rate-limit';

/** Consumes one rate-limit slot and reports whether the request may proceed. */
export const allowLinkPreviewRequest = createRateLimiter({ windowMs: 60 * 1000, max: 30 });
