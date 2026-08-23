import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { CONTENT_EDIT_TOKEN_COOKIE } from '@/lib/content-edit-token';
import { fetchGitHubApi } from '@/lib/data/github';
import { hasContentEditToken } from '@/lib/server/content-edit-token';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const cookieOptions = {
  httpOnly: true,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function GET() {
  return NextResponse.json({ configured: await hasContentEditToken() });
}

/**
 * Cheapest authenticated read against the content repo. Catches the common
 * mistakes — typo'd, expired, or wrong-scope token — before it sits in a
 * 90-day cookie and fails at save time instead. Read access does not prove
 * write access; a read-only token still fails on the first save.
 */
const canReachContentRepo = async (token: string) => {
  try {
    await fetchGitHubApi('data', { cache: 'no-store' }, token);
    return true;
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';

  if (!token) {
    return NextResponse.json({ error: 'GitHub token is required' }, { status: 400 });
  }

  // Local runs use a dummy token against a test content branch; don't make the
  // dev loop depend on a live GitHub call.
  if (process.env.NODE_ENV === 'production' && !(await canReachContentRepo(token))) {
    return NextResponse.json(
      { error: 'This token cannot read the content repository' },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(CONTENT_EDIT_TOKEN_COOKIE, token, cookieOptions);

  return NextResponse.json({ configured: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(CONTENT_EDIT_TOKEN_COOKIE);

  return NextResponse.json({ configured: false });
}
