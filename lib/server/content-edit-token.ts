import { cookies } from 'next/headers';

import {
  CONTENT_EDIT_CONFIGURED_SENTINEL,
  CONTENT_EDIT_TOKEN_COOKIE,
} from '@/lib/content-edit-token';
import type { ActionError } from '@/lib/types/action-result';

export async function resolveContentEditToken(providedToken?: string | null) {
  if (providedToken && providedToken !== CONTENT_EDIT_CONFIGURED_SENTINEL) {
    return providedToken;
  }

  const cookieStore = await cookies();
  return cookieStore.get(CONTENT_EDIT_TOKEN_COOKIE)?.value || '';
}

export async function requireAuth(token?: string | null): Promise<string | ActionError> {
  const resolvedToken = await resolveContentEditToken(token);

  if (!resolvedToken.trim()) {
    return {
      success: false,
      error: 'GitHub token is required',
      code: 'AUTH_INVALID',
      retryable: false,
    };
  }

  return resolvedToken;
}

export async function hasContentEditToken() {
  return Boolean(await resolveContentEditToken(CONTENT_EDIT_CONFIGURED_SENTINEL));
}
