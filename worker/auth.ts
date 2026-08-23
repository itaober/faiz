import {
  CONTENT_EDIT_CONFIGURED_SENTINEL,
  CONTENT_EDIT_TOKEN_COOKIE,
} from '@/lib/content-edit-token';
import type { ActionError } from '@/lib/types/action-result';

export const readTokenCookie = (request: Request) => {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) {
      continue;
    }
    if (part.slice(0, eq).trim() === CONTENT_EDIT_TOKEN_COOKIE) {
      return part.slice(eq + 1).trim();
    }
  }
  return '';
};

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
