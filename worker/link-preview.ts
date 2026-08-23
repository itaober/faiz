import { type LinkPreviewData, normalizeUrl, parseMetadata } from '@/lib/link-preview-core';

// Fallback for links that aren't in the build-time /link-previews.json yet —
// dev, and links added to content after the last deploy. No favicon here
// (matching the old no-signing-secret behaviour); the precomputed map carries
// icons as static files.

const MAX_URL_LENGTH = 2048;
const MAX_HTML_BYTES = 256 * 1024;
const TIMEOUT_MS = 4000;
const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);

const CACHE_CONTROL = [
  'public',
  'max-age=300',
  's-maxage=86400',
  'stale-while-revalidate=604800',
].join(', ');

// One in-memory bucket per isolate — same shape as the old off-Vercel
// limiter. ponytail: per-IP buckets need trusting proxy headers; a Cloudflare
// WAF rate rule is the upgrade path if this ever gets abused.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
let rateWindowStart = 0;
let rateCount = 0;

const allowRequest = () => {
  const now = Date.now();
  if (now - rateWindowStart >= RATE_LIMIT_WINDOW_MS) {
    rateWindowStart = now;
    rateCount = 0;
  }
  rateCount += 1;
  return rateCount <= RATE_LIMIT_MAX_REQUESTS;
};

const readCappedText = async (response: Response) => {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    bytes += value.byteLength;
    if (bytes > MAX_HTML_BYTES) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
};

const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export const handleLinkPreview = async (url: URL): Promise<Response> => {
  if (!allowRequest()) {
    return json({ error: 'Too many requests' }, 429);
  }

  const target = url.searchParams.get('url') ?? '';
  if (!target || target.length > MAX_URL_LENGTH) {
    return json({ error: 'Invalid url' }, 400);
  }

  let normalized: URL;
  try {
    normalized = normalizeUrl(target);
  } catch {
    return json({ error: 'Invalid url' }, 400);
  }

  try {
    const response = await fetch(normalized.toString(), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': 'Faiz-Link-Preview/1.0',
      },
    });

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (!response.ok || !contentType || !HTML_CONTENT_TYPES.has(contentType)) {
      return json({ error: 'Unable to load link preview' }, 502);
    }

    const finalUrl = new URL(response.url || normalized.toString());
    const data: LinkPreviewData = parseMetadata(await readCappedText(response), finalUrl);
    return json(data, 200, { 'Cache-Control': CACHE_CONTROL });
  } catch {
    return json({ error: 'Unable to load link preview' }, 502);
  }
};
