import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

import { signLinkIconUrl } from './link-preview-signature.ts';

const MAX_HTML_BYTES = 256 * 1024;
const MAX_ICON_BYTES = 64 * 1024;
const TOTAL_TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;
const PREVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const ICON_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['2001::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, 'ipv6');
}

export interface LinkPreviewData {
  url: string;
  hostname: string;
  title: string;
  description?: string;
  siteName?: string;
  iconUrl?: string;
}

export interface LinkIconData {
  body: Buffer;
  contentType: string;
}

interface CachedValue<T> {
  expiresAt: number;
  data: T;
}

interface ResourceResponse {
  status: number;
  location?: string;
  body?: Buffer;
  contentType?: string;
}

interface ResourceOptions {
  accept: string;
  maxBytes: number;
  contentTypes: ReadonlySet<string>;
}

const previewCache = new Map<string, CachedValue<LinkPreviewData>>();
const previewRequests = new Map<string, Promise<LinkPreviewData>>();
const iconCache = new Map<string, CachedValue<LinkIconData>>();
const iconRequests = new Map<string, Promise<LinkIconData>>();

const withDeadline = async <T>(promise: Promise<T>, deadline: number) => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error('Link preview request timed out');
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Link preview request timed out')), remaining);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const setBoundedCache = <T>(
  cache: Map<string, CachedValue<T>>,
  key: string,
  data: T,
  ttl: number,
) => {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
};

const getCachedValue = <T>(cache: Map<string, CachedValue<T>>, key: string) => {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, cached);
  return cached.data;
};

const decodeHtmlEntities = (value: string) =>
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

const cleanText = (value: string | undefined, maxLength: number) => {
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

const parseAttributes = (tag: string) => {
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

const getIconUrl = (html: string, pageUrl: URL) => {
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
    const url = iconUrl.toString();
    const signature = signLinkIconUrl(url);
    return signature
      ? `/api/link-preview/icon?url=${encodeURIComponent(url)}&sig=${signature}`
      : undefined;
  } catch {
    return undefined;
  }
};

const parseMetadata = (html: string, url: URL): LinkPreviewData => {
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
    iconUrl: getIconUrl(html, url),
  };
};

export const isBlockedLinkAddress = (address: string, family: number) =>
  family === 6
    ? blockedIpv6Addresses.check(address, 'ipv6')
    : blockedIpv4Addresses.check(address, 'ipv4');

const normalizeUrl = (value: string) => {
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

const resolvePublicAddress = async (hostname: string, deadline: number) => {
  const unwrappedHostname =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const directFamily = isIP(unwrappedHostname);
  if (directFamily) {
    if (isBlockedLinkAddress(unwrappedHostname, directFamily)) {
      throw new Error('Private network links are not allowed');
    }
    return { address: unwrappedHostname, family: directFamily };
  }

  const addresses = await withDeadline(lookup(hostname, { all: true, verbatim: true }), deadline);
  if (
    !addresses.length ||
    addresses.some(item => isBlockedLinkAddress(item.address, item.family))
  ) {
    throw new Error('Link hostname did not resolve to a public address');
  }
  return addresses[0];
};

const requestResource = async (
  url: URL,
  deadline: number,
  options: ResourceOptions,
): Promise<ResourceResponse> => {
  const address = await resolvePublicAddress(url.hostname, deadline);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: address.address,
        family: address.family,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        servername: url.protocol === 'https:' ? url.hostname : undefined,
        rejectUnauthorized: true,
        headers: {
          Accept: options.accept,
          'Accept-Encoding': 'identity',
          Host: url.host,
          'User-Agent': 'Faiz-Link-Preview/1.0',
        },
      },
      response => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          resolve({ status, location });
          return;
        }
        if (status < 200 || status >= 300) {
          response.resume();
          reject(new Error(`Link preview request failed with ${status}`));
          return;
        }

        const contentType =
          response.headers['content-type']?.split(';')[0]?.trim().toLowerCase() ?? '';
        if (!options.contentTypes.has(contentType)) {
          response.resume();
          reject(new Error('Link preview response has an unsupported content type'));
          return;
        }

        const contentLength = Number(response.headers['content-length'] ?? 0);
        if (contentLength > options.maxBytes) {
          response.resume();
          reject(new Error('Link preview response is too large'));
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > options.maxBytes) {
            response.destroy(new Error('Link preview response is too large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          resolve({ status, contentType, body: Buffer.concat(chunks) });
        });
        response.on('error', reject);
      },
    );

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      request.destroy(new Error('Link preview request timed out'));
      return;
    }
    const deadlineTimer = setTimeout(() => {
      request.destroy(new Error('Link preview request timed out'));
    }, remaining);
    request.on('close', () => clearTimeout(deadlineTimer));
    request.on('error', reject);
    request.end();
  });
};

const fetchResource = async (input: string, options: ResourceOptions) => {
  let url = normalizeUrl(input);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestResource(url, deadline, options);
    if (response.location) {
      if (redirects === MAX_REDIRECTS) {
        throw new Error('Too many link preview redirects');
      }
      url = normalizeUrl(new URL(response.location, url).toString());
      continue;
    }
    return { response, url };
  }

  throw new Error('Unable to load link preview');
};

const fetchPreview = async (input: string) => {
  const { response, url } = await fetchResource(input, {
    accept: 'text/html,application/xhtml+xml;q=0.9',
    maxBytes: MAX_HTML_BYTES,
    contentTypes: HTML_CONTENT_TYPES,
  });
  return parseMetadata(response.body?.toString('utf8') ?? '', url);
};

const fetchIcon = async (input: string): Promise<LinkIconData> => {
  const { response } = await fetchResource(input, {
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/x-icon,*/*;q=0.1',
    maxBytes: MAX_ICON_BYTES,
    contentTypes: ICON_CONTENT_TYPES,
  });
  if (!response.body || !response.contentType) {
    throw new Error('Unable to load link icon');
  }
  return { body: response.body, contentType: response.contentType };
};

export const getLinkPreview = async (input: string) => {
  const normalizedUrl = normalizeUrl(input).toString();
  const cached = getCachedValue(previewCache, normalizedUrl);
  if (cached) {
    return cached;
  }

  const pending = previewRequests.get(normalizedUrl);
  if (pending) {
    return pending;
  }

  const request = fetchPreview(normalizedUrl)
    .then(data => {
      setBoundedCache(previewCache, normalizedUrl, data, PREVIEW_CACHE_TTL_MS);
      return data;
    })
    .finally(() => previewRequests.delete(normalizedUrl));
  previewRequests.set(normalizedUrl, request);
  return request;
};

export const getLinkIcon = async (input: string) => {
  const normalizedUrl = normalizeUrl(input).toString();
  const cached = getCachedValue(iconCache, normalizedUrl);
  if (cached) {
    return cached;
  }

  const pending = iconRequests.get(normalizedUrl);
  if (pending) {
    return pending;
  }

  const request = fetchIcon(normalizedUrl)
    .then(data => {
      setBoundedCache(iconCache, normalizedUrl, data, ICON_CACHE_TTL_MS);
      return data;
    })
    .finally(() => iconRequests.delete(normalizedUrl));
  iconRequests.set(normalizedUrl, request);
  return request;
};
