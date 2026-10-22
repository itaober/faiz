import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getLinkCardTarget } from '@/lib/link-card';
import { getLinkCard } from '@/lib/server/link-card';
import { allowLinkPreviewRequest } from '@/lib/server/link-preview-rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!allowLinkPreviewRequest(request.headers)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const href = request.nextUrl.searchParams.get('url') || '';
  const type = request.nextUrl.searchParams.get('type');
  const target = getLinkCardTarget(href);
  if (!target || (type && type !== target.type)) {
    return NextResponse.json({ error: 'Unsupported link card' }, { status: 400 });
  }
  const data = await getLinkCard(target.url, target.type);
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': data.unavailable
        ? 'public, max-age=60'
        : 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
