import { AwsClient } from 'aws4fetch';
import { unstable_cache, updateTag } from 'next/cache';

import { assetObjectKey, encodeKey } from '@/lib/assets';
import { fetchWithRetry } from '@/lib/data/fetch-with-retry';
import { StorageError } from '@/lib/errors';
import { getServerEnv } from '@/lib/server/env';

/**
 * The only module that talks to R2. Content (private bucket) is read through the Next data cache
 * under one tag, so a write refreshes every page built from content. Every overwrite or delete of
 * content first copies the current revision into `_history/`, which a bucket lifecycle rule
 * expires; assets are immutable and need no history.
 */

const CONTENT_TAG = 'content';
// Writes from this deployment refresh at once (updateTag); this bounds how long a write from
// anywhere else (a preview, local dev, a restore in the dashboard) takes to show.
const CONTENT_REVALIDATE_SECONDS = 60;
const HISTORY_PREFIX = '_history';
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

let client: AwsClient | undefined;
const getClient = () => {
  const env = getServerEnv();
  client ??= new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 0,
  });
  return client;
};

const objectUrl = (bucket: string, key = '') =>
  `https://${getServerEnv().R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${encodeKey(key)}`;

const contentBucket = () => getServerEnv().R2_CONTENT_BUCKET;
const assetsBucket = () => getServerEnv().R2_ASSETS_BUCKET;

type SignedInit = Omit<RequestInit, 'body'> & { body?: string };

// Conditional writes are not retried: a retry after a write that did land would read as a conflict.
const send = async (url: string, init: SignedInit = {}, retries = 2) => {
  const signed = await getClient().sign(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });
  return fetchWithRetry(
    signed.url,
    { ...init, method: signed.method, headers: signed.headers, body: init.body },
    { retries },
  );
};

const storageError = (res: Response, context: string) =>
  new StorageError(res.status, `${context}: ${res.status} ${res.statusText}`);

// ── Content ──────────────────────────────────────────────────────────────

// Signed requests carry a fresh date header each time and fetch's cache keys on headers, so the
// read is cached around the request rather than by fetch. A throw is not cached.
const cachedRead = <T>(name: string, key: string, read: () => Promise<T>) =>
  unstable_cache(read, [name, key], {
    revalidate: CONTENT_REVALIDATE_SECONDS,
    tags: [CONTENT_TAG],
  })();

/** Cached read for rendering; null when the object does not exist. */
export const readContent = (key: string) =>
  cachedRead('r2-content-v1', key, async (): Promise<string | null> => {
    const res = await send(objectUrl(contentBucket(), key), { cache: 'no-store' });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw storageError(res, `Failed to read ${key}`);
    }
    return res.text();
  });

export const readContentJson = async <T = unknown>(key: string) => {
  const text = await readContent(key);
  return text === null ? null : (JSON.parse(text) as T);
};

/**
 * Uncached read for read-modify-write. The revision is what a later write sends back as its
 * if-unchanged token, so a cached (stale) one would defeat the check.
 */
export const readContentForUpdate = async (
  key: string,
): Promise<{ text: string; revision: string } | null> => {
  // A compressed response carries a weak ETag (W/"…"), which If-Match never matches.
  const res = await send(objectUrl(contentBucket(), key), {
    cache: 'no-store',
    headers: { 'accept-encoding': 'identity' },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw storageError(res, `Failed to read ${key}`);
  }
  const revision = res.headers.get('etag');
  if (!revision) {
    throw new StorageError(502, `No revision returned for ${key}`);
  }
  return { text: await res.text(), revision };
};

export const readContentJsonForUpdate = async <T>(key: string) => {
  const file = await readContentForUpdate(key);
  return file ? { data: JSON.parse(file.text) as T, revision: file.revision } : null;
};

/** Keys under a prefix, relative to the bucket root. */
export const listContent = (prefix: string) =>
  cachedRead('r2-list-v1', prefix, async () => {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const url = new URL(objectUrl(contentBucket()));
      url.searchParams.set('list-type', '2');
      url.searchParams.set('prefix', prefix);
      if (continuationToken) {
        url.searchParams.set('continuation-token', continuationToken);
      }
      const res = await send(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        throw storageError(res, `Failed to list ${prefix}`);
      }
      const xml = await res.text();
      for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        keys.push(decodeXml(match[1]));
      }
      continuationToken = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
    } while (continuationToken);
    return keys;
  });

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const historyKey = (key: string) => `${HISTORY_PREFIX}/${key}/${new Date().toISOString()}`;

/** Copies the exact revision about to be replaced; false when there is nothing to keep. */
const archiveContent = async (key: string, revision?: string) => {
  const bucket = contentBucket();
  const res = await send(
    objectUrl(bucket, historyKey(key)),
    {
      method: 'PUT',
      headers: {
        'x-amz-copy-source': `/${bucket}/${encodeKey(key)}`,
        ...(revision ? { 'x-amz-copy-source-if-match': revision } : {}),
      },
    },
    0,
  );
  if (res.status === 404) {
    return false;
  }
  if (res.status === 412) {
    throw new StorageError(412, `Conflict archiving ${key}`);
  }
  if (!res.ok) {
    throw storageError(res, `Failed to archive ${key}`);
  }
  return true;
};

/**
 * Writes content under an if-unchanged check. `revision` is what the caller read: a string means
 * "replace exactly that revision", null means "create, it must not exist yet". A mismatch throws
 * StorageError 412, which actions report as a conflict.
 */
export const writeContent = async (
  key: string,
  body: string,
  revision: string | null,
  contentType = 'text/plain; charset=utf-8',
): Promise<{ revision: string }> => {
  if (revision) {
    await archiveContent(key, revision);
  }
  const res = await send(
    objectUrl(contentBucket(), key),
    {
      method: 'PUT',
      headers: {
        'content-type': contentType,
        ...(revision ? { 'if-match': revision } : { 'if-none-match': '*' }),
      },
      body,
    },
    0,
  );
  if (res.status === 412) {
    throw new StorageError(412, `Conflict writing ${key}`);
  }
  if (!res.ok) {
    throw storageError(res, `Failed to write ${key}`);
  }
  updateTag(CONTENT_TAG);
  // The write landed, but an editor holding an empty revision would conflict on every save.
  const written = res.headers.get('etag');
  if (!written) {
    throw new StorageError(502, `No revision returned for ${key}`);
  }
  return { revision: written };
};

export const writeContentJson = (key: string, data: unknown, revision: string | null) =>
  writeContent(key, `${JSON.stringify(data, null, 2)}\n`, revision, 'application/json');

/**
 * Deletes content after archiving it; false when it did not exist. With a revision, the archive
 * only goes ahead if that is still the stored revision (StorageError 412 otherwise).
 */
export const deleteContent = async (key: string, revision?: string): Promise<boolean> => {
  if (!(await archiveContent(key, revision))) {
    return false;
  }
  const res = await send(objectUrl(contentBucket(), key), { method: 'DELETE' }, 0);
  if (!res.ok && res.status !== 404) {
    throw storageError(res, `Failed to delete ${key}`);
  }
  updateTag(CONTENT_TAG);
  return true;
};

// ── Assets ───────────────────────────────────────────────────────────────

export interface AssetImageMeta {
  width: number;
  height: number;
  blurDataURL: `data:image/webp;base64,${string}`;
}

const META_PREFIX = 'x-amz-meta-';

/** Size and blur preview recorded on the object at upload; null for files without them. */
export const readAssetImageMeta = async (key: string): Promise<AssetImageMeta | null> => {
  const res = await send(objectUrl(assetsBucket(), assetObjectKey(key)), {
    method: 'HEAD',
    cache: 'no-store',
  });
  if (!res.ok) {
    return null;
  }
  const width = Number(res.headers.get(`${META_PREFIX}width`));
  const height = Number(res.headers.get(`${META_PREFIX}height`));
  const blur = res.headers.get(`${META_PREFIX}blur`);
  if (!width || !height || !blur?.startsWith('data:image/webp;base64,')) {
    return null;
  }
  return { width, height, blurDataURL: blur as AssetImageMeta['blurDataURL'] };
};

/**
 * A short-lived URL the browser PUTs one image to. Every header is signed, so the upload must
 * carry exactly this type, size and metadata — the server decides all three.
 */
export const createAssetUploadUrl = async (
  key: string,
  { size, width, height, blur }: { size: number; width: number; height: number; blur: string },
) => {
  const url = new URL(objectUrl(assetsBucket(), assetObjectKey(key)));
  url.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_TTL_SECONDS));
  const headers = {
    'content-type': 'image/webp',
    'content-length': String(size),
    'cache-control': 'public, max-age=31536000, immutable',
    [`${META_PREFIX}width`]: String(width),
    [`${META_PREFIX}height`]: String(height),
    [`${META_PREFIX}blur`]: blur,
  };
  const signed = await getClient().sign(url.toString(), {
    method: 'PUT',
    headers,
    aws: { signQuery: true, allHeaders: true },
  });
  // content-length is set by the browser from the body; sending it explicitly is not allowed.
  const { 'content-length': _contentLength, ...uploadHeaders } = headers;
  return { url: signed.url, headers: uploadHeaders };
};
