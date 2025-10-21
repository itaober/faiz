import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchGitHubApi } from '@/lib/data/common';

const cacheControl = [
  'public',
  `max-age=${7 * 24 * 60 * 60}`,
  `stale-while-revalidate=${24 * 60 * 60}`,
  `stale-if-error=${60 * 60}`,
  'immutable',
].join(', ');

const getContentType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const res = await fetchGitHubApi(path.join('/'), {
      next: {
        revalidate: 7 * 24 * 60 * 60,
      },
    });

    const contentType = getContentType(path.join('/'));
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': cacheControl,
        Vary: 'Accept-Encoding',
      },
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
