/**
 * One-time copy of this site's content from the GitHub `content` branch to R2.
 *
 *   pnpm migrate:github            dry run: the plan, what the buckets already hold, any problem
 *   pnpm migrate:github --apply    write, then verify against the buckets
 *     --source <dir>               checkout of the content branch (default: ../faiz-content)
 *     --overwrite                  also replace objects that differ from the checkout
 *
 * The target is whatever the environment names; `.env.local` holds the dev bucket and folder.
 * Real environment variables win over --env-file, so the live site is
 *   R2_CONTENT_BUCKET=faiz-content NEXT_PUBLIC_ASSETS_URL=https://assets.itaober.com/faiz \
 *     pnpm migrate:github --apply
 *
 * Safe to re-run: identical objects are skipped, and one that differs (edited on the new site
 * since) is left alone unless --overwrite, which keeps the replaced content in `_history/` first.
 * Assets are written before content, so an interrupted run never leaves content pointing at an
 * image that is not uploaded yet.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

import { assetObjectKey } from '../lib/assets.ts';
import { isAssetImageKey } from '../lib/content-editing-validation.ts';
import { CONTENT_KEYS } from '../lib/content-keys.ts';

const { values: options } = parseArgs({
  options: {
    source: { type: 'string', default: path.resolve(import.meta.dirname, '../../faiz-content') },
    apply: { type: 'boolean', default: false },
    overwrite: { type: 'boolean', default: false },
  },
});

const fail = (message, details = []) => {
  console.error(`\n✗ ${message}`);
  for (const line of details) {
    console.error(`  ${line}`);
  }
  process.exit(1);
};

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
  fail(`Missing environment variables: ${missingEnv.join(', ')}`);
}
const assetsBucket = process.env.R2_ASSETS_BUCKET;
const contentBucket = process.env.R2_CONTENT_BUCKET;
const assetsPrefix = assetObjectKey('');

const source = path.resolve(options.source);
if (!fs.existsSync(path.join(source, 'data')) || !fs.existsSync(path.join(source, 'assets'))) {
  fail(`${source} is not a checkout of the content branch (no data/ or assets/)`);
}

// ── Read the checkout ─────────────────────────────────────────────────────

/** Files under `dir` as content-branch paths; dotfiles (.DS_Store) are not content. */
const listFiles = dir => {
  const root = path.join(source, dir);
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { recursive: true })
    .map(relative => `${dir}/${relative.split(path.sep).join('/')}`)
    .filter(
      file =>
        !file.split('/').some(part => part.startsWith('.')) &&
        fs.statSync(path.join(source, file)).isFile(),
    );
};

// The two old forms: `/api/image/assets/<path>` (posts, records, avatar) and `assets/<path>`
// (memos). A name may hold spaces, so a reference ends at its image extension, not at whitespace.
// The lookbehind skips the same path inside someone else's URL.
const IMAGE_REF =
  /(?<![\w./-])(?:\/api\/image\/)?assets\/([^"'`()<>\n]*?\.(?:webp|png|jpe?g|gif))(?![\w.])/gi;
// Wider than IMAGE_REF on purpose: anything still aimed at the old layout fails the run.
const LEFTOVER = /\/api\/image\/(?:assets\/)?|(?<!\/\/[^\s"'()<>]*)(?<![\w-])assets\//g;

/** `memos/x.webp` keeps its path; a file at the top of `assets/` (the avatars) moves to `site/`. */
const toAssetKey = assetPath => (assetPath.includes('/') ? assetPath : `site/${assetPath}`);

const references = [];
const unresolved = [];

const rewrite = (text, file) =>
  text.replace(IMAGE_REF, (ref, assetPath) => {
    const key = toAssetKey(assetPath);
    if (!isAssetImageKey(key)) {
      unresolved.push(`${file}: ${ref}`);
      return ref;
    }
    references.push({ file, ref, key });
    return key;
  });

const findLeftovers = (text, where) =>
  [...text.matchAll(LEFTOVER)].map(
    match =>
      `${where}: …${text.slice(Math.max(0, match.index - 30), match.index + 60).replace(/\s+/g, ' ')}…`,
  );

const mapStrings = (value, transform) => {
  if (typeof value === 'string') {
    return transform(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => mapStrings(item, transform));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, mapStrings(item, transform)]),
    );
  }
  return value;
};

const CONTENT_SOURCES = [
  [/^data\/meta\.json$/, () => CONTENT_KEYS.site],
  [/^data\/records\.json$/, () => CONTENT_KEYS.records],
  [/^data\/posts\.json$/, () => CONTENT_KEYS.postsIndex],
  [/^data\/posts\/([^/]+)\.mdx$/, slug => CONTENT_KEYS.post(slug)],
  [/^pages\/([^/]+)\.mdx$/, page => CONTENT_KEYS.page(page)],
  [/^data\/memos\/memos-(\d{6})\.json$/, month => CONTENT_KEYS.memos(month)],
];

const contentKeyFor = file => {
  for (const [pattern, toKey] of CONTENT_SOURCES) {
    const match = file.match(pattern);
    if (match) {
      return toKey(match[1]);
    }
  }
  return null;
};

const notMigrated = [];
const contentPlan = [];
for (const file of [...listFiles('data'), ...listFiles('pages')]) {
  const key = contentKeyFor(file);
  if (!key) {
    notMigrated.push(file);
    continue;
  }
  const raw = fs.readFileSync(path.join(source, file), 'utf8');
  const isJson = file.endsWith('.json');
  let text;
  try {
    // JSON is rewritten value by value and written the way the app writes it (writeContentJson).
    text = isJson
      ? `${JSON.stringify(
          mapStrings(JSON.parse(raw), value => rewrite(value, file)),
          null,
          2,
        )}\n`
      : rewrite(raw, file);
  } catch (error) {
    fail(`${file}: ${error.message}`);
  }
  contentPlan.push({
    bucket: contentBucket,
    key,
    body: Buffer.from(text),
    headers: { 'content-type': isJson ? 'application/json' : 'text/markdown; charset=utf-8' },
  });
}

const IMAGE_TYPES = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};
// R2 caps all custom metadata at 2KB; the upload action allows the preview 1024 characters.
const MAX_BLUR_LENGTH = 1024;

/** Size and blur preview, stored on each object for `readAssetImageMeta` to read back. */
const readImageMeta = async body => {
  const image = sharp(body);
  const { autoOrient } = await image.metadata();
  const blur = await image.autoOrient().resize(8, 8, { fit: 'inside' }).blur(1).webp().toBuffer();
  return {
    width: autoOrient.width,
    height: autoOrient.height,
    blur: `data:image/webp;base64,${blur.toString('base64')}`,
  };
};

const skippedFiles = [];
const imageErrors = [];
const assetPlan = [];
for (const file of listFiles('assets')) {
  const key = toAssetKey(file.slice('assets/'.length));
  if (!isAssetImageKey(key)) {
    skippedFiles.push(file);
    continue;
  }
  const body = fs.readFileSync(path.join(source, file));
  try {
    const { width, height, blur } = await readImageMeta(body);
    if (blur.length > MAX_BLUR_LENGTH) {
      throw new Error(`blur preview is ${blur.length} characters`);
    }
    assetPlan.push({
      bucket: assetsBucket,
      key: assetObjectKey(key),
      assetKey: key,
      body,
      headers: {
        'content-type': IMAGE_TYPES[key.split('.').pop().toLowerCase()],
        'cache-control': 'public, max-age=31536000, immutable',
        'x-amz-meta-width': String(width),
        'x-amz-meta-height': String(height),
        'x-amz-meta-blur': blur,
      },
    });
  } catch (error) {
    imageErrors.push(`${file}: ${error.message}`);
  }
}

const assetKeys = new Set(assetPlan.map(object => object.assetKey));
const referencedKeys = new Set(references.map(reference => reference.key));
const missingFiles = references
  .filter(reference => !assetKeys.has(reference.key))
  .map(reference => `${reference.file}: ${reference.ref}`);
const unreferenced = [...assetKeys].filter(key => !referencedKeys.has(key));
const leftovers = contentPlan.flatMap(object => findLeftovers(object.body.toString(), object.key));

// ── Talk to R2 ────────────────────────────────────────────────────────────

// Reads retry; writes do not, because a retried conditional write that did land reads as a
// conflict. A failed write is picked up by the next run instead.
const client = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
  retries: 3,
});

const encodeKey = key => key.split('/').map(encodeURIComponent).join('/');
const objectUrl = (bucket, key = '') =>
  `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${encodeKey(key)}`;

const decodeXml = value =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const xmlTags = {
  Code: /<Code>([^<]*)<\/Code>/,
  Message: /<Message>([^<]*)<\/Message>/,
  Key: /<Key>([^<]*)<\/Key>/,
  Size: /<Size>(\d+)<\/Size>/,
  ETag: /<ETag>([^<]*)<\/ETag>/,
  NextContinuationToken: /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/,
};
const xmlTag = (xml, name) => xml.match(xmlTags[name])?.[1];

// Only the error code and message: other fields of an S3 error can echo the access key id.
const describeError = async res => {
  const xml = await res.text();
  return [res.status, xmlTag(xml, 'Code'), xmlTag(xml, 'Message')].filter(Boolean).join(' ');
};

/** Every object under `prefix`: key → size and ETag (unquoted; the MD5 of a single-part upload). */
const listObjects = async (bucket, prefix) => {
  const objects = new Map();
  let continuationToken;
  do {
    const url = new URL(objectUrl(bucket));
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    if (continuationToken) {
      url.searchParams.set('continuation-token', continuationToken);
    }
    const res = await client.fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Listing ${bucket} failed: ${await describeError(res)}`);
    }
    const xml = await res.text();
    for (const [, entry] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      objects.set(decodeXml(xmlTag(entry, 'Key')), {
        size: Number(xmlTag(entry, 'Size')),
        etag: decodeXml(xmlTag(entry, 'ETag') ?? '').replaceAll('"', ''),
      });
    }
    continuationToken = xmlTag(xml, 'NextContinuationToken');
  } while (continuationToken);
  return objects;
};

const md5 = body => createHash('md5').update(body).digest('hex');

const withState = (plan, remote) =>
  plan.map(object => {
    const existing = remote.get(object.key);
    const state = !existing ? 'create' : existing.etag === md5(object.body) ? 'same' : 'differs';
    return { ...object, state, etag: existing?.etag };
  });

const put = async (url, headers, body) => {
  const res = await fetch(await client.sign(url, { method: 'PUT', headers, body }));
  if (!res.ok) {
    throw new Error(await describeError(res));
  }
};

const write = async object => {
  if (object.state === 'differs' && object.bucket === contentBucket) {
    // The same archive the app makes before it overwrites content (lib/storage/r2.ts).
    await put(objectUrl(contentBucket, `_history/${object.key}/${new Date().toISOString()}`), {
      'x-amz-copy-source': `/${contentBucket}/${encodeKey(object.key)}`,
      'x-amz-copy-source-if-match': `"${object.etag}"`,
    });
  }
  const condition =
    object.state === 'create' ? { 'if-none-match': '*' } : { 'if-match': `"${object.etag}"` };
  await put(objectUrl(object.bucket, object.key), { ...object.headers, ...condition }, object.body);
};

// ── Report ────────────────────────────────────────────────────────────────

const megabytes = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const totalSize = objects => objects.reduce((sum, object) => sum + object.body.length, 0);
const countBy = (items, keyOf) =>
  Object.entries(Object.groupBy(items, keyOf))
    .map(([name, group]) => `${name} ${group.length}`)
    .join(' · ');
const topFolder = key => key.split('/')[0];

const printList = (title, lines) => {
  if (!lines.length) {
    return;
  }
  console.log(`\n${title} (${lines.length})`);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
};

console.log(`Source   ${source}`);
console.log(`Assets   ${assetsBucket}/${assetsPrefix}  (${process.env.NEXT_PUBLIC_ASSETS_URL})`);
console.log(`Content  ${contentBucket}`);
console.log(`Mode     ${options.apply ? 'apply' : 'dry run, nothing is written'}`);

console.log(
  `\nAssets   ${assetPlan.length} files, ${megabytes(totalSize(assetPlan))}  (${countBy(assetPlan, object => topFolder(object.assetKey))})`,
);
console.log(
  `Content  ${contentPlan.length} files, ${megabytes(totalSize(contentPlan))}  (${countBy(contentPlan, object => topFolder(object.key).replace(/\..*/, ''))})`,
);
console.log(
  `Images   ${references.length} references rewritten  (${countBy(references, reference => topFolder(reference.key))})`,
);
const examples = Object.values(Object.groupBy(references, reference => topFolder(reference.key)));
for (const [{ ref, key }] of examples) {
  console.log(`         ${ref} → ${key}`);
}

let assets;
let content;
try {
  const [remoteAssets, remoteContent] = await Promise.all([
    listObjects(assetsBucket, assetsPrefix),
    listObjects(contentBucket, ''),
  ]);
  assets = withState(assetPlan, remoteAssets);
  content = withState(contentPlan, remoteContent);
} catch (error) {
  fail(error.message);
}

const states = objects => countBy(objects, object => object.state);
console.log(`\nBuckets  assets: ${states(assets) || 'nothing to copy'}`);
console.log(`         content: ${states(content) || 'nothing to copy'}`);
const differing = [...assets, ...content].filter(object => object.state === 'differs');
printList(
  options.overwrite
    ? 'Differ from the checkout, will be replaced'
    : 'Differ from the checkout, left alone (pass --overwrite to replace)',
  differing.map(object => `${object.bucket}/${object.key}`),
);

printList('Referenced but not in the checkout (rewritten anyway)', missingFiles);
printList('In assets/ but referenced nowhere (copied anyway)', unreferenced);
printList('Not copied: not an image in a known folder', skippedFiles);
printList('Not copied: no place in the new layout', notMigrated);

const blockers = [
  ...unresolved.map(line => `cannot rewrite ${line}`),
  ...leftovers.map(line => `old reference left ${line}`),
  ...imageErrors.map(line => `cannot read image ${line}`),
];
if (blockers.length) {
  fail('Fix these in the checkout first:', blockers);
}

if (!options.apply) {
  console.log('\n✓ Dry run passed. Run again with --apply to write.');
  process.exit(0);
}

// ── Apply, then verify ────────────────────────────────────────────────────

const writes = [...assets, ...content].filter(
  object => object.state === 'create' || (object.state === 'differs' && options.overwrite),
);
const failures = [];
for (const [index, object] of writes.entries()) {
  try {
    await write(object);
  } catch (error) {
    failures.push(`${object.bucket}/${object.key}: ${error.message}`);
  }
  process.stdout.write(`\rWriting  ${index + 1}/${writes.length}`);
}
console.log(writes.length ? '' : 'Writing  nothing to write');

const [assetsNow, contentNow] = await Promise.all([
  listObjects(assetsBucket, assetsPrefix),
  listObjects(contentBucket, ''),
]);
const problems = [];
for (const object of [...assets, ...content]) {
  if (object.state === 'differs' && !options.overwrite) {
    continue;
  }
  const remote = (object.bucket === assetsBucket ? assetsNow : contentNow).get(object.key);
  if (!remote) {
    problems.push(`missing ${object.bucket}/${object.key}`);
  } else if (remote.size !== object.body.length) {
    problems.push(
      `${object.bucket}/${object.key} is ${remote.size} bytes, expected ${object.body.length}`,
    );
  }
}

// What the site will actually read: every live content object, straight from the bucket.
const liveContent = [...contentNow].filter(([key]) => !key.startsWith('_history/'));
for (const [key] of liveContent) {
  const res = await client.fetch(objectUrl(contentBucket, key));
  if (!res.ok) {
    problems.push(`cannot read ${contentBucket}/${key}: ${await describeError(res)}`);
    continue;
  }
  problems.push(...findLeftovers(await res.text(), `${contentBucket}/${key}`));
}

const bucketSize = entries => entries.reduce((sum, [, object]) => sum + object.size, 0);
console.log(
  `\nVerify   assets: checkout ${assetPlan.length} (${megabytes(totalSize(assetPlan))}) · bucket ${assetsNow.size} (${megabytes(bucketSize([...assetsNow]))})`,
);
console.log(
  `         content: checkout ${contentPlan.length} (${megabytes(totalSize(contentPlan))}) · bucket ${liveContent.length} (${megabytes(bucketSize(liveContent))}), plus ${contentNow.size - liveContent.length} in _history/`,
);

if (failures.length || problems.length) {
  fail('Migration incomplete; fix and re-run (finished objects are skipped):', [
    ...failures.map(line => `write failed ${line}`),
    ...problems,
  ]);
}
console.log('\n✓ Migrated and verified.');
