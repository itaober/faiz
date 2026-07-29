import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getLinkPreview } from '@/lib/server/link-preview';
import { isLinkPreviewRateLimited } from '@/lib/server/link-preview-rate-limit';

export const runtime = 'nodejs';

const MAX_URL_LENGTH = 2048;

export async function GET(request: NextRequest) {
  if (isLinkPreviewRateLimited(request.headers)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = request.nextUrl.searchParams.get('url')?.trim();
  if (!url || url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const preview = await getLinkPreview(url);
    return NextResponse.json(preview, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load link preview' }, { status: 422 });
  }
}
