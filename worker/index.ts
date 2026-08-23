import { CONTENT_EDIT_TOKEN_COOKIE } from '@/lib/content-edit-token';
import { isContentImageReadPath } from '@/lib/content-editing-validation';
import { CONTENT_BRANCH, fetchGitHubApi, GIT_HUB_API_OPTIONS } from '@/lib/data/github';

import {
  createMemoAction,
  createPostAction,
  createRecordAction,
  deleteMemoAction,
  deletePostAction,
  deleteRecordAction,
  loadEditableContentAction,
  updateMemoAction,
  updatePageAction,
  updatePostAction,
  updateRecordAction,
  uploadEditorImageAction,
} from './actions';
import { readTokenCookie, resolveToken } from './auth';

interface Env {
  ASSETS: Fetcher;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });

// ================================
// Edit endpoints (the former server actions)
// ================================

type EditHandler = (input: never) => Promise<unknown>;

const EDIT_ACTIONS = {
  'create-post': createPostAction,
  'update-post': updatePostAction,
  'delete-post': deletePostAction,
  'update-page': updatePageAction,
  'create-record': createRecordAction,
  'update-record': updateRecordAction,
  'delete-record': deleteRecordAction,
  'create-memo': createMemoAction,
  'update-memo': updateMemoAction,
  'delete-memo': deleteMemoAction,
  'upload-image': uploadEditorImageAction,
  'load-content': loadEditableContentAction,
} satisfies Record<string, EditHandler>;

const handleEditAction = async (request: Request, name: string) => {
  const handler = EDIT_ACTIONS[name as keyof typeof EDIT_ACTIONS];
  if (!handler) {
    return json({ success: false, error: 'Unknown action', code: 'VALIDATION', retryable: false });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return json({ success: false, error: 'Invalid request', code: 'VALIDATION', retryable: false });
  }

  // The client only ever holds the "configured" sentinel; the real token lives
  // in the httpOnly cookie and is injected here.
  const input = { ...body, token: resolveToken(request, body.token) };
  const result = await (handler as (input: unknown) => Promise<unknown>)(input);

  // Errors travel as values (ActionResult), exactly like the server actions did.
  return json(result);
};

// ================================
// Edit token cookie (port of the former /api/edit-token route)
// ================================

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const buildTokenCookie = (url: URL, value: string, maxAge: number) =>
  [
    `${CONTENT_EDIT_TOKEN_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    ...(url.protocol === 'https:' ? ['Secure'] : []),
  ].join('; ');

const isLocalHostname = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

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

const handleEditToken = async (request: Request, url: URL) => {
  if (request.method === 'GET') {
    return json({ configured: Boolean(readTokenCookie(request)) });
  }

  if (request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return json({ error: 'GitHub token is required' }, 400);
    }

    // Local runs use a dummy token against a test content branch; don't make
    // the dev loop depend on a live GitHub call.
    if (!isLocalHostname(url.hostname) && !(await canReachContentRepo(token))) {
      return json({ error: 'This token cannot read the content repository' }, 400);
    }

    return json({ configured: true }, 200, {
      'Set-Cookie': buildTokenCookie(url, token, COOKIE_MAX_AGE),
    });
  }

  if (request.method === 'DELETE') {
    return json({ configured: false }, 200, {
      'Set-Cookie': buildTokenCookie(url, '', 0),
    });
  }

  return json({ error: 'Method not allowed' }, 405);
};

// ================================
// Image fallback proxy
// ================================

const IMAGE_CACHE_CONTROL = [
  'public',
  `max-age=${7 * 24 * 60 * 60}`,
  `stale-while-revalidate=${24 * 60 * 60}`,
  `stale-if-error=${60 * 60}`,
  'immutable',
].join(', ');

// Raster only, mirroring CONTENT_IMAGE_EXTENSIONS. SVG is deliberately absent:
// served inline from our own origin it would be a stored-XSS vector.
const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const getImageContentType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  return IMAGE_MIME_TYPES[ext || ''] || 'application/octet-stream';
};

/**
 * Serves content-branch images that are not (yet) in the static build — a just
 * uploaded image during the rebuild window, or anything in dev. Static assets
 * match first in production, so this only sees the misses. The repo is public,
 * so raw.githubusercontent.com needs no token and has no API quota.
 */
const handleImageProxy = async (request: Request, url: URL, ctx: ExecutionContext) => {
  const segments = url.pathname
    .slice('/api/image/'.length)
    .split('/')
    .map(segment => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return '';
      }
    });

  if (!isContentImageReadPath(segments)) {
    return json({ error: 'Invalid image path' }, 400);
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/');
    const { owner, repo } = GIT_HUB_API_OPTIONS;
    const upstream = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${CONTENT_BRANCH}/${encodedPath}`,
    );

    if (!upstream.ok) {
      return json({ error: 'Failed to load image' }, upstream.status === 404 ? 404 : 500);
    }

    const response = new Response(upstream.body, {
      headers: {
        'Content-Type': getImageContentType(segments[segments.length - 1]),
        'Content-Disposition': 'inline',
        'Cache-Control': IMAGE_CACHE_CONTROL,
        'CDN-Cache-Control': IMAGE_CACHE_CONTROL,
        Vary: 'Accept-Encoding',
      },
    });

    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  } catch {
    // Don't echo the upstream error: it carries the content repo path.
    return json({ error: 'Failed to load image' }, 500);
  }
};

// ================================
// Router
// ================================

/**
 * SameSite=Strict on the cookie is the primary CSRF defense; this rejects the
 * remaining cross-origin POSTs outright. Dev runs the app on localhost:1999 and
 * the worker on 127.0.0.1:8787 behind a Next rewrite, hence the local exemption.
 */
const isCrossOrigin = (request: Request, url: URL) => {
  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }

  try {
    const originHostname = new URL(origin).hostname;
    if (originHostname === url.hostname) {
      return false;
    }
    return !(isLocalHostname(originHostname) && isLocalHostname(url.hostname));
  } catch {
    return true;
  }
};

const handleApi = async (request: Request, url: URL, ctx: ExecutionContext) => {
  if (request.method !== 'GET' && isCrossOrigin(request, url)) {
    return json({ error: 'Cross-origin request rejected' }, 403);
  }

  if (url.pathname === '/api/edit-token') {
    return handleEditToken(request, url);
  }

  if (url.pathname.startsWith('/api/edit/')) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }
    return handleEditAction(request, url.pathname.slice('/api/edit/'.length));
  }

  if (url.pathname.startsWith('/api/image/')) {
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }
    return handleImageProxy(request, url, ctx);
  }

  // Placeholder until the link-preview fallback lands; the hover card treats a
  // non-OK response as "no preview".
  if (url.pathname === '/api/link-preview') {
    return json({ error: 'Link preview unavailable' }, 404);
  }

  return json({ error: 'Not found' }, 404);
};

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, url, ctx);
    }

    // Everything else is a static asset; ASSETS handles 404.html for misses.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
