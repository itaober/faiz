import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getLinkIcon } from '@/lib/server/link-preview';
import { allowLinkPreviewRequest } from '@/lib/server/link-preview-rate-limit';
import { verifyLinkIconSignature } from '@/lib/server/link-preview-signature';

export const runtime = 'nodejs';

const MAX_URL_LENGTH = 2048;

export async function GET(request: NextRequest) {
  if (!allowLinkPreviewRequest(request.headers)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const url = request.nextUrl.searchParams.get('url')?.trim();
  const signature = request.nextUrl.searchParams.get('sig')?.trim();
  if (!url || url.length > MAX_URL_LENGTH) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (!signature || !verifyLinkIconSignature(url, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  try {
    const icon = await getLinkIcon(url);
    return new NextResponse(new Uint8Array(icon.body), {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
        'Content-Type': icon.contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load link icon' }, { status: 422 });
  }
}
