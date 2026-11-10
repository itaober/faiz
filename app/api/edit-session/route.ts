import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createEditSession, isEditKey } from '@/lib/edit-session-token';
import {
  EDIT_SESSION_COOKIE,
  editSessionCookieOptions,
  hasEditSession,
} from '@/lib/server/edit-session';
import { getServerEnv } from '@/lib/server/env';
import { createRateLimiter } from '@/lib/server/rate-limit';

// The key is 32 random bytes, so this is defense in depth rather than what stops guessing.
const allowSignInAttempt = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

// Editing used to keep a GitHub token in this cookie; browsers still send it until it is removed.
const LEGACY_TOKEN_COOKIE = 'FAIZ_GITHUB_TOKEN';

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.has(LEGACY_TOKEN_COOKIE)) {
    cookieStore.delete(LEGACY_TOKEN_COOKIE);
  }
  return NextResponse.json({ signedIn: await hasEditSession() });
}

export async function POST(request: Request) {
  if (!allowSignInAttempt(request.headers)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  const key = typeof body?.key === 'string' ? body.key.trim() : '';

  if (!key || !isEditKey(getServerEnv().EDIT_KEY, key)) {
    return NextResponse.json({ error: 'That edit key is not right' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(
    EDIT_SESSION_COOKIE,
    createEditSession(getServerEnv().EDIT_KEY, Date.now()),
    editSessionCookieOptions,
  );
  return NextResponse.json({ signedIn: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(EDIT_SESSION_COOKIE);
  return NextResponse.json({ signedIn: false });
}
