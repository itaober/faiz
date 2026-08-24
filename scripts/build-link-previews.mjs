/**
 * Precomputes hover previews for every external link in the content:
 *   out/link-previews.json         — { [normalizedUrl]: LinkPreviewData }
 *   out/link-previews/icons/…      — favicons as static files
 *
 * Per-URL results are cached under .cache/link-previews for 7 days, so a
 * rebuild doesn't re-crawl the web. Links that fail to fetch are simply
 * omitted — the hover card falls back to the worker endpoint. Run after
 * `next build`:
 *   CONTENT_DIR=path/to/content node scripts/build-link-previews.mjs
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getIconHref, normalizeUrl, parseMetadata } from '../lib/link-preview-core.ts';

const CONTENT_DIR = process.env.CONTENT_DIR;
if (!CONTENT_DIR) {
  throw new Error('CONTENT_DIR must point at a checkout of the content branch');
}

const OUT_DIR = 'out';
const CACHE_DIR = '.cache/link-previews';
const ICON_OUT_DIR = path.join(OUT_DIR, 'link-previews/icons');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 256 * 1024;
const MAX_ICON_BYTES = 64 * 1024;
const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);

const ICON_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/x-icon', 'ico'],
  ['image/vnd.microsoft.icon', 'ico'],
]);

const sha1 = value => createHash('sha1').update(value).digest('hex');

const collectText = async () => {
  const texts = [];

  for (const dir of ['data/posts', 'pages']) {
    const base = path.join(CONTENT_DIR, dir);
    for (const entry of await readdir(base)) {
      if (entry.endsWith('.mdx')) {
        texts.push(await readFile(path.join(base, entry), 'utf8'));
      }
    }
  }

  const memosDir = path.join(CONTENT_DIR, 'data/memos');
  for (const entry of await readdir(memosDir)) {
    if (!entry.endsWith('.json')) {
      continue;
    }
    const memos = JSON.parse(await readFile(path.join(memosDir, entry), 'utf8'));
    for (const memo of memos) {
      texts.push(memo.content ?? '');
    }
  }

  return texts.join('\n');
};

const extractUrls = text => {
  const urls = new Set();
  for (const match of text.match(/https?:\/\/[^\s<>"'()[\]]+/g) ?? []) {
    // CJK prose often follows a URL with no space; trim trailing punctuation.
    const trimmed = match.replace(/[.,;:!?、。，」』）】…]+$/u, '');
    try {
      urls.add(normalizeUrl(trimmed).toString());
    } catch {
      // Local/invalid link — no preview for it.
    }
  }
  return [...urls];
};

const readCache = async cachePath => {
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf8'));
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached;
    }
  } catch {
    // Missing or corrupt cache entry — refetch.
  }
  return null;
};

const fetchIcon = async iconHref => {
  const response = await fetch(iconHref, {
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif,image/x-icon,*/*;q=0.1' },
  });
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  const extension = ICON_EXTENSIONS.get(contentType ?? '');
  if (!response.ok || !extension) {
    return null;
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_ICON_BYTES) {
    return null;
  }
  return { body, fileName: `${sha1(iconHref)}.${extension}` };
};

const buildPreview = async url => {
  const cachePath = path.join(CACHE_DIR, `${sha1(url)}.json`);
  const cached = await readCache(cachePath);
  if (cached) {
    return cached;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml;q=0.9',
      'User-Agent': 'Faiz-Link-Preview/1.0',
    },
  });
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!response.ok || !HTML_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unusable response (${response.status} ${contentType})`);
  }

  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  const finalUrl = new URL(response.url || url);
  const data = parseMetadata(html, finalUrl);

  const iconHref = getIconHref(html, finalUrl);
  let iconFile;
  if (iconHref) {
    const icon = await fetchIcon(iconHref).catch(() => null);
    if (icon) {
      await mkdir(path.join(CACHE_DIR, 'icons'), { recursive: true });
      await writeFile(path.join(CACHE_DIR, 'icons', icon.fileName), icon.body);
      iconFile = icon.fileName;
      data.iconUrl = `/link-previews/icons/${icon.fileName}`;
    }
  }

  const entry = { fetchedAt: Date.now(), data, iconFile };
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath, JSON.stringify(entry));
  return entry;
};

const urls = extractUrls(await collectText());
const previews = {};
let failures = 0;

await Promise.all(
  urls.map(async url => {
    try {
      const entry = await buildPreview(url);
      previews[url] = entry.data;
      if (entry.iconFile) {
        await mkdir(ICON_OUT_DIR, { recursive: true });
        await copyFile(
          path.join(CACHE_DIR, 'icons', entry.iconFile),
          path.join(ICON_OUT_DIR, entry.iconFile),
        );
      }
    } catch (error) {
      failures++;
      console.warn(`link-preview skipped: ${url} (${error.message})`);
    }
  }),
);

await writeFile(path.join(OUT_DIR, 'link-previews.json'), JSON.stringify(previews));
// biome-ignore lint/suspicious/noConsole: build-script summary is its interface
console.log(
  `Link previews: ${Object.keys(previews).length}/${urls.length} built (${failures} skipped)`,
);
