import { cookies } from 'next/headers';

import {
  CONTENT_EDIT_TOKEN_CONFIGURED_VALUE,
  CONTENT_EDIT_TOKEN_COOKIE,
} from '@/lib/content-edit-token';

export async function resolveContentEditToken(providedToken?: string | null) {
  if (providedToken && providedToken !== CONTENT_EDIT_TOKEN_CONFIGURED_VALUE) {
    return providedToken;
  }

  const cookieStore = await cookies();
  return cookieStore.get(CONTENT_EDIT_TOKEN_COOKIE)?.value || '';
}

export async function hasContentEditToken() {
  return Boolean(await resolveContentEditToken(CONTENT_EDIT_TOKEN_CONFIGURED_VALUE));
}
