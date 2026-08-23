import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isContentImageReadPath } from '@/lib/content-editing-validation';
import { fetchGitHubApi } from '@/lib/data/github';

const CACHE_CONTROL = [
  'public',
  `max-age=${7 * 24 * 60 * 60}`,
  `stale-while-revalidate=${24 * 60 * 60}`,
  `stale-if-error=${60 * 60}`,
  'immutable',
].join(', ');

// Raster only, mirroring CONTENT_IMAGE_EXTENSIONS. SVG is deliberately absent:
// served inline from our own origin it would be a stored-XSS vector.
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const getContentType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  return MIME_TYPES[ext || ''] || 'application/octet-stream';
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;

    if (!isContentImageReadPath(path)) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 });
    }

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
  } catch {
    // Don't echo the upstream error: it carries the content repo path and token state.
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
