import { cookies } from 'next/headers';

import { EDIT_SESSION_MAX_AGE_SECONDS, verifyEditSession } from '@/lib/edit-session-token';
import { getServerEnv } from '@/lib/server/env';
import type { ActionError } from '@/lib/types/action-result';

export const EDIT_SESSION_COOKIE = 'faiz_edit_session';

export const editSessionCookieOptions = {
  httpOnly: true,
  maxAge: EDIT_SESSION_MAX_AGE_SECONDS,
  path: '/',
  // Strict: a request started from another site never carries the session.
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function hasEditSession() {
  const value = (await cookies()).get(EDIT_SESSION_COOKIE)?.value;
  return verifyEditSession(getServerEnv().EDIT_KEY, value, Date.now());
}

/** Gate for every write: returns the error to hand back, or null when signed in. */
export async function requireEditSession(): Promise<ActionError | null> {
  if (await hasEditSession()) {
    return null;
  }
  return { success: false, error: 'Sign in to edit', code: 'AUTH_INVALID', retryable: false };
}
