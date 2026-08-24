import {
  CONTENT_EDIT_CONFIGURED_SENTINEL,
  CONTENT_EDIT_TOKEN_COOKIE,
} from '@/lib/content-edit-token';
import type { ActionError } from '@/lib/types/action-result';

// Pattern is built from our own constant, never from request data.
const TOKEN_COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${CONTENT_EDIT_TOKEN_COOKIE}=([^;]*)`);

export const readTokenCookie = (request: Request) =>
  request.headers.get('cookie')?.match(TOKEN_COOKIE_PATTERN)?.[1]?.trim() ?? '';

/**
 * An explicit token wins unless it's the client-side "configured" sentinel —
 * the client never holds the raw token, only the httpOnly cookie does.
 */
export const resolveToken = (request: Request, provided?: unknown) =>
  typeof provided === 'string' && provided && provided !== CONTENT_EDIT_CONFIGURED_SENTINEL
    ? provided
    : readTokenCookie(request);

export const requireAuth = (token?: string | null): string | ActionError => {
  if (!token?.trim()) {
    return {
      success: false,
      error: 'GitHub token is required',
      code: 'AUTH_INVALID',
      retryable: false,
    };
  }

  return token;
};
