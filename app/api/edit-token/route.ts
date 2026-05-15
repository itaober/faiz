import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { CONTENT_EDIT_TOKEN_COOKIE } from '@/lib/content-edit-token';
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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';

  if (!token) {
    return NextResponse.json({ error: 'GitHub token is required' }, { status: 400 });
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
