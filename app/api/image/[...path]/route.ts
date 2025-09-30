import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchGitHubApi } from '@/lib/data/common';

interface IOptions {
  params: {
    path: string[];
  };
}

const cacheControl = [
  'public',
  `max-age=${7 * 24 * 60 * 60}`,
  `stale-while-revalidate=${24 * 60 * 60}`,
  `stale-if-error=${60 * 60}`,
  'immutable',
].join(', ');

export async function GET(req: NextRequest, { params }: IOptions) {
  try {
    const { path } = await params;
    const res = await fetchGitHubApi(path.join('/'), {
      next: {
        revalidate: 7 * 24 * 60 * 60,
      },
    });

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'CDN-Cache-Control': cacheControl,
        Vary: 'Accept-Encoding',
      },
    });
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
