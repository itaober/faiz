import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchGitHubApi } from '@/lib/data/common';

const CACHE_CONTROL = [
  'public',
  `max-age=${7 * 24 * 60 * 60}`,
  `stale-while-revalidate=${24 * 60 * 60}`,
  `stale-if-error=${60 * 60}`,
  'immutable',
].join(', ');

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
};

const getContentType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext || ''] || 'application/octet-stream';
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const filePath = path.join('/');

    const res = await fetchGitHubApi(filePath, {
      next: { revalidate: 7 * 24 * 60 * 60 },
    });

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': getContentType(filePath),
        'Content-Disposition': 'inline',
        'Cache-Control': CACHE_CONTROL,
        'CDN-Cache-Control': CACHE_CONTROL,
        Vary: 'Accept-Encoding',
      },
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
