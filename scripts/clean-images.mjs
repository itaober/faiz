/**
 * Deletes uploaded images that nothing points at any more.
 *
 *   pnpm clean:images            dry run: what would go, and how much space it frees
 *   pnpm clean:images --apply    delete it
 *
 * Edits never delete images, so content restored from `_history/` still finds its pictures. An
 * image goes only once neither current content nor any history copy mentions it, and history
 * expires after 90 days, so a dropped image is swept on the first run after that.
 *
 * The target is whatever the environment names; `.env.local` holds the dev bucket and folder.
 * Real environment variables win over --env-file, so the live site is
 *   R2_CONTENT_BUCKET=faiz-content NEXT_PUBLIC_ASSETS_URL=https://assets.itaober.com/faiz \
 *     pnpm clean:images
 */
import { parseArgs } from 'node:util';

import { AwsClient } from 'aws4fetch';

import { assetObjectKey, encodeKey } from '../lib/assets.ts';
import { isContentImageScope } from '../lib/content-editing-validation.ts';

// An image uploaded for an edit that is still open is not in any content yet.
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Keys under the upload folders that no content text mentions, raw or URL-encoded. Matching the
 * bare key keeps anything referred to in any syntax: a JSON field, Markdown, JSX, a full URL.
 * `site/` is skipped: it holds hand-placed files such as the avatar.
 */
export const findOrphans = (objects, contents, now = Date.now()) =>
  objects.filter(
    ({ key, lastModified }) =>
      isContentImageScope(key.split('/')[0]) &&
      now - lastModified >= MIN_AGE_MS &&
      !contents.some(text => text.includes(key) || text.includes(encodeKey(key))),
  );

const decodeXml = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const main = async () => {
  const { values: options } = parseArgs({
    options: { apply: { type: 'boolean', default: false } },
  });

  const REQUIRED_ENV = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_ASSETS_BUCKET',
    'R2_CONTENT_BUCKET',
    'NEXT_PUBLIC_ASSETS_URL',
  ];
  const missingEnv = REQUIRED_ENV.filter(name => !process.env[name]);
  if (missingEnv.length) {
    console.error(`✗ Missing environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
  }
  const assetsBucket = process.env.R2_ASSETS_BUCKET;
  const contentBucket = process.env.R2_CONTENT_BUCKET;
  const assetsPrefix = assetObjectKey('');

  const client = new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 3,
  });
  const objectUrl = (bucket, key = '') =>
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${encodeKey(key)}`;
  const request = async (url, init) => {
    const res = await client.fetch(url, init);
    if (!res.ok && res.status !== 404) {
      // Only the status: an S3 error body can echo the access key id.
      throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${res.status}`);
    }
    return res;
  };

  const listObjects = async (bucket, prefix) => {
    const objects = [];
    let continuationToken;
    do {
      const url = new URL(objectUrl(bucket));
      url.searchParams.set('list-type', '2');
      url.searchParams.set('prefix', prefix);
      if (continuationToken) {
        url.searchParams.set('continuation-token', continuationToken);
      }
      const xml = await (await request(url.toString())).text();
      for (const [, entry] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        objects.push({
          key: decodeXml(entry.match(/<Key>([^<]*)<\/Key>/)[1]).slice(prefix.length),
          size: Number(entry.match(/<Size>(\d+)<\/Size>/)[1]),
          lastModified: Date.parse(entry.match(/<LastModified>([^<]*)<\/LastModified>/)[1]),
        });
      }
      continuationToken = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1];
    } while (continuationToken);
    return objects;
  };

  console.log(`Assets   ${assetsBucket}/${assetsPrefix}`);
  console.log(`Content  ${contentBucket} (current and _history/)\n`);

  const [images, contentObjects] = await Promise.all([
    listObjects(assetsBucket, assetsPrefix),
    listObjects(contentBucket, ''),
  ]);
  // Identical history copies are read once each; there are only a few hundred small files.
  const contents = [];
  for (const { key } of contentObjects) {
    contents.push(await (await request(objectUrl(contentBucket, key))).text());
  }

  const orphans = findOrphans(images, [...new Set(contents)]);
  const megabytes = bytes => (bytes / 1024 / 1024).toFixed(1);
  for (const { key, size } of orphans) {
    console.log(`  ${key}  ${megabytes(size)} MB`);
  }
  const total = orphans.reduce((sum, { size }) => sum + size, 0);
  console.log(
    `\n${orphans.length} of ${images.length} images unused (${megabytes(total)} MB), read against ${contentObjects.length} content files.`,
  );

  if (!orphans.length) {
    return;
  }
  if (!options.apply) {
    console.log('Dry run. Re-run with --apply to delete them.');
    return;
  }
  for (const { key } of orphans) {
    await request(objectUrl(assetsBucket, assetsPrefix + key), { method: 'DELETE' });
  }
  console.log(`✓ Deleted ${orphans.length} images`);
};

if (import.meta.filename === process.argv[1]) {
  await main();
}
