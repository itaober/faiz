// Pure link-preview parsing shared by the build-time precompute script, the
// worker fallback endpoint and the client cache lookup. No runtime APIs here.

export interface LinkPreviewData {
  url: string;
  hostname: string;
  title: string;
  description?: string;
  siteName?: string;
  iconUrl?: string;
}

export const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x?[\da-f]+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'nbsp') return ' ';

    const radix = normalized.startsWith('#x') ? 16 : 10;
    const number = Number.parseInt(normalized.replace(/^#x?/, ''), radix);
    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });

export const cleanText = (value: string | undefined, maxLength: number) => {
  if (!value) {
    return undefined;
  }

  const text = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return undefined;
  }
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}…`;
};

export const parseAttributes = (tag: string) => {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match = pattern.exec(tag);

  while (match) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    if (name) {
      attributes.set(name, value);
    }
    match = pattern.exec(tag);
  }

  return attributes;
};

/**
 * Absolute URL of the page's favicon (SVG skipped — it would be a stored-XSS
 * vector when re-served from our origin), or undefined when none is usable.
 */
export const getIconHref = (html: string, pageUrl: URL) => {
  const links = (html.match(/<link\b[^>]*>/gi) ?? []).map(parseAttributes).filter(attributes => {
    const rel = attributes.get('rel')?.toLowerCase().split(/\s+/) ?? [];
    return rel.includes('icon') || rel.includes('apple-touch-icon');
  });
  const href =
    links
      .find(attributes => {
        const href = attributes.get('href')?.toLowerCase();
        const type = attributes.get('type')?.toLowerCase();
        return href && type !== 'image/svg+xml' && !href.endsWith('.svg');
      })
      ?.get('href') || '/favicon.ico';

  try {
    const iconUrl = new URL(href, pageUrl);
    if (iconUrl.protocol !== 'http:' && iconUrl.protocol !== 'https:') {
      return undefined;
    }
    return iconUrl.toString();
  } catch {
    return undefined;
  }
};

/** og/twitter/title extraction. Icons are the caller's concern. */
export const parseMetadata = (html: string, url: URL): LinkPreviewData => {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.get('property') || attributes.get('name'))?.toLowerCase();
    const content = attributes.get('content');
    if (key && content && !metadata.has(key)) {
      metadata.set(key, content);
    }
  }

  const htmlTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title =
    cleanText(metadata.get('og:title') || metadata.get('twitter:title') || htmlTitle, 140) ||
    url.hostname;
  const description = cleanText(
    metadata.get('og:description') ||
      metadata.get('twitter:description') ||
      metadata.get('description'),
    240,
  );

  return {
    url: url.toString(),
    hostname: url.hostname.replace(/^www\./i, ''),
    title,
    description,
    siteName: cleanText(metadata.get('og:site_name'), 80),
  };
};

/**
 * Validates and canonicalises a preview target (also the cache/map key).
 * Local/credentialed/odd-port URLs are rejected up front; on workerd this is
 * belt-and-braces — its egress cannot reach private networks anyway.
 */
export const normalizeUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Unsupported link protocol');
  }
  if (url.username || url.password) {
    throw new Error('Link credentials are not allowed');
  }
  if (
    (url.protocol === 'http:' && url.port && url.port !== '80') ||
    (url.protocol === 'https:' && url.port && url.port !== '443')
  ) {
    throw new Error('Non-standard link ports are not allowed');
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Local links are not allowed');
  }

  url.hash = '';
  return url;
};
