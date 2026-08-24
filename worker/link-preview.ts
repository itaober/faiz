import { type LinkPreviewData, normalizeUrl, parseMetadata } from '@/lib/link-preview-core';

// Fallback for links missing from the build-time /link-previews.json: dev, and
// links added to content since the last deploy. Responses carry no favicon —
// icons ship as static files alongside the precomputed map.

const MAX_URL_LENGTH = 2048;
const MAX_HTML_CHARS = 256 * 1024;
const TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;
const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);

const RESPONSE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
  'X-Content-Type-Options': 'nosniff',
};

/** Never buffer a whole untrusted page: the isolate has 128 MB for everything. */
const readCappedText = async (body: ReadableStream<Uint8Array>) => {
  let text = '';
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    text += chunk;
    if (text.length >= MAX_HTML_CHARS) {
      return text.slice(0, MAX_HTML_CHARS);
    }
  }
  return text;
};

/**
 * Redirects are followed by hand so `normalizeUrl` runs on every hop. Letting
 * fetch follow them would validate only the URL the visitor supplied, so a
 * redirect could still land on a credentialed or non-standard-port target.
 */
const fetchHtml = async (start: URL) => {
  let url = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': 'Faiz-Link-Preview/1.0',
      },
    });

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = normalizeUrl(new URL(location, url).toString());
      continue;
    }

    return { response, url };
  }

  throw new Error('Too many link preview redirects');
};

export const handleLinkPreview = async (
  request: Request,
  url: URL,
  limiter: RateLimit,
): Promise<Response> => {
  const target = url.searchParams.get('url')?.trim();
  if (!target || target.length > MAX_URL_LENGTH) {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }

  let normalized: URL;
  try {
    normalized = normalizeUrl(target);
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Cloudflare sets cf-connecting-ip itself, so unlike a forwarded-for header
  // it is not attacker-controlled.
  const { success } = await limiter.limit({
    key: request.headers.get('cf-connecting-ip') ?? 'unknown',
  });
  if (!success) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { response, url: finalUrl } = await fetchHtml(normalized);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();

    if (!response.ok || !contentType || !HTML_CONTENT_TYPES.has(contentType) || !response.body) {
      return Response.json({ error: 'Unable to load link preview' }, { status: 422 });
    }

    const data: LinkPreviewData = parseMetadata(await readCappedText(response.body), finalUrl);
    return Response.json(data, { headers: RESPONSE_HEADERS });
  } catch {
    return Response.json({ error: 'Unable to load link preview' }, { status: 422 });
  }
};
