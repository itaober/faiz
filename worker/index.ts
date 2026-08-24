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
import { handleLinkPreview } from './link-preview';

const EDIT_ACTIONS: Record<string, (input: never) => Promise<unknown>> = {
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
};

const handleEditAction = async (request: Request, name: string) => {
  const handler = EDIT_ACTIONS[name];
  if (!handler) {
    return Response.json({
      success: false,
      error: 'Unknown action',
      code: 'VALIDATION',
      retryable: false,
    });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return Response.json({
      success: false,
      error: 'Invalid request',
      code: 'VALIDATION',
      retryable: false,
    });
  }

  // The client only ever holds the "configured" sentinel; the real token lives
  // in the httpOnly cookie and is injected here.
  const input = { ...body, token: resolveToken(request, body.token) };

  // Errors travel as values (ActionResult), so a rejected save is still a 200.
  return Response.json(await handler(input as never));
};

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
    return Response.json({ configured: Boolean(readTokenCookie(request)) });
  }

  if (request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!token) {
      return Response.json({ error: 'GitHub token is required' }, { status: 400 });
    }

    // Local runs use a dummy token against a test content branch; don't make
    // the dev loop depend on a live GitHub call.
    if (!isLocalHostname(url.hostname) && !(await canReachContentRepo(token))) {
      return Response.json(
        { error: 'This token cannot read the content repository' },
        { status: 400 },
      );
    }

    return Response.json(
      { configured: true },
      { headers: { 'Set-Cookie': buildTokenCookie(url, token, COOKIE_MAX_AGE) } },
    );
  }

  if (request.method === 'DELETE') {
    return Response.json(
      { configured: false },
      { headers: { 'Set-Cookie': buildTokenCookie(url, '', 0) } },
    );
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};

const IMAGE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

const IMAGE_CACHE_CONTROL = [
  'public',
  `max-age=${IMAGE_CACHE_TTL_SECONDS}`,
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
 * match first in production, so this only sees the misses. The content branch
 * is public, so raw.githubusercontent.com needs no token and spends no API quota.
 */
const handleImageProxy = async (url: URL) => {
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
    return Response.json({ error: 'Invalid image path' }, { status: 400 });
  }

  try {
    const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/');
    const { owner, repo } = GIT_HUB_API_OPTIONS;
    const upstream = await fetch(
      `https://raw.githubusercontent.com/${owner}/${repo}/${CONTENT_BRANCH}/${encodedPath}`,
      { cf: { cacheEverything: true, cacheTtl: IMAGE_CACHE_TTL_SECONDS } },
    );

    if (!upstream.ok) {
      return Response.json(
        { error: 'Failed to load image' },
        { status: upstream.status === 404 ? 404 : 500 },
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': getImageContentType(segments[segments.length - 1]),
        'Content-Disposition': 'inline',
        'Cache-Control': IMAGE_CACHE_CONTROL,
        'CDN-Cache-Control': IMAGE_CACHE_CONTROL,
        Vary: 'Accept-Encoding',
      },
    });
  } catch (error) {
    // Don't echo the upstream error to the client: it carries the repo path.
    console.error(
      JSON.stringify({ event: 'image_proxy_failed', path: url.pathname, error: `${error}` }),
    );
    return Response.json({ error: 'Failed to load image' }, { status: 500 });
  }
};

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

const methodNotAllowed = () => Response.json({ error: 'Method not allowed' }, { status: 405 });

const handleApi = async (request: Request, url: URL, env: Env) => {
  if (request.method !== 'GET' && isCrossOrigin(request, url)) {
    return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  if (url.pathname === '/api/edit-token') {
    return handleEditToken(request, url);
  }

  if (url.pathname.startsWith('/api/edit/')) {
    return request.method === 'POST'
      ? handleEditAction(request, url.pathname.slice('/api/edit/'.length))
      : methodNotAllowed();
  }

  if (url.pathname.startsWith('/api/image/')) {
    return request.method === 'GET' ? handleImageProxy(url) : methodNotAllowed();
  }

  if (url.pathname === '/api/link-preview') {
    return request.method === 'GET'
      ? handleLinkPreview(request, url, env.LINK_PREVIEW_LIMITER)
      : methodNotAllowed();
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, url, env);
    }

    // Everything else is a static asset; ASSETS handles 404.html for misses.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
