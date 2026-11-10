/**
 * Prepares Cloudflare for one Faiz deployment, then prints the environment to paste. Run it in
 * your own terminal: the output holds freshly generated edit keys.
 *
 *   pnpm setup:cloudflare [options]
 *
 * Uses wrangler's login (`npx wrangler login` once). Every step looks before it changes anything,
 * so re-running is safe. The assets bucket can serve several sites, so its CORS rules are only
 * written while it has none; otherwise the rule to add is printed instead of replacing theirs.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, stripVTControlCharacters } from 'node:util';

const USAGE = `Usage: pnpm setup:cloudflare [options]

  --assets-bucket <name>   public bucket for images, can serve several sites   (itaober-assets)
  --assets-domain <host>   custom domain that serves it                        (assets.itaober.com)
  --folder <name>          this site's folder in it; local dev uses <name>-dev  (faiz)
  --content-bucket <name>  this site's private bucket; local dev uses <name>-dev (faiz-content)
  --origin <url>           site origin allowed to upload images, repeatable    (https://blog.itaober.com)
  --zone-id <id>           zone of the assets domain, to connect the domain
                           (dashboard → the domain → Overview → API → Zone ID)
  --account-id <id>        only when your login can see several accounts
  --seed                   write a starter site.json into empty content buckets (new sites only)`;

const fail = message => {
  console.error(`\n✗ ${message}`);
  process.exit(1);
};

let options;
try {
  ({ values: options } = parseArgs({
    options: {
      'assets-bucket': { type: 'string', default: 'itaober-assets' },
      'assets-domain': { type: 'string', default: 'assets.itaober.com' },
      folder: { type: 'string', default: 'faiz' },
      'content-bucket': { type: 'string', default: 'faiz-content' },
      origin: { type: 'string', multiple: true, default: ['https://blog.itaober.com'] },
      'zone-id': { type: 'string' },
      'account-id': { type: 'string' },
      seed: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  fail(`${error.message}\n\n${USAGE}`);
}
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

const assetsBucket = options['assets-bucket'];
const assetsDomain = options['assets-domain'];
const folder = options.folder;
const contentBucket = options['content-bucket'];
const devFolder = `${folder}-dev`;
const devContentBucket = `${contentBucket}-dev`;
const zoneId = options['zone-id'];
const LOCAL_ORIGIN = 'http://localhost:1999';
const origins = [...new Set([...options.origin, LOCAL_ORIGIN])];

// R2's naming rule; the -dev twin has to pass it too.
const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const CLOUDFLARE_ID = /^[a-f0-9]{32}$/;
const invalid = [
  ...[assetsBucket, contentBucket, devContentBucket]
    .filter(name => !BUCKET_NAME.test(name))
    .map(name => `bucket name "${name}"`),
  ...(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(assetsDomain)
    ? []
    : [`domain "${assetsDomain}"`]),
  ...(/^[a-z0-9][a-z0-9_-]*$/i.test(folder) ? [] : [`folder "${folder}"`]),
  ...options.origin
    .filter(origin => URL.parse(origin)?.origin !== origin)
    .map(origin => `origin "${origin}" (scheme and host only, like https://blog.example.com)`),
  ...[zoneId, options['account-id']]
    .filter(id => id !== undefined && !CLOUDFLARE_ID.test(id))
    .map(id => `id "${id}"`),
];
if (invalid.length) {
  fail(`Invalid ${invalid.join(', ')}\n\n${USAGE}`);
}

// ponytail: `npx` as a plain executable covers macOS and Linux; on Windows, run this under WSL.
const wrangler = (...args) => {
  try {
    return stripVTControlCharacters(
      execFileSync('npx', ['-y', 'wrangler@4', ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch (error) {
    const output = stripVTControlCharacters(`${error.stdout ?? ''}${error.stderr ?? ''}`).trim();
    throw new Error(`wrangler ${args.join(' ')} failed${output ? `:\n${output}` : ''}`);
  }
};

const done = message => console.log(`✓ ${message}`);
const todo = [];

// What a presigned upload sends (lib/storage/r2.ts createAssetUploadUrl). GET is there because
// the About page reads the portrait's pixels in a canvas, which needs CORS on a plain load too.
const CORS = {
  origins,
  methods: ['GET', 'HEAD', 'PUT'],
  headers: [
    'content-type',
    'cache-control',
    'x-amz-meta-width',
    'x-amz-meta-height',
    'x-amz-meta-blur',
  ],
  maxAgeSeconds: 86400,
};

/** Rules as `wrangler r2 bucket cors list` prints them: one block of `label: a, b` lines each. */
const parseCorsRules = output =>
  output.split(/\n\s*\n/).flatMap(block => {
    const field = pattern => block.match(pattern)?.[1].toLowerCase().split(', ') ?? [];
    const ruleOrigins = field(/^allowed_origins:\s+(.*)$/m);
    return ruleOrigins.length
      ? [
          {
            origins: ruleOrigins,
            methods: field(/^allowed_methods:\s+(.*)$/m),
            headers: field(/^allowed_headers:\s+(.*)$/m),
          },
        ]
      : [];
  });

const allows = (list, value) => list.includes(value) || list.includes('*');
const coversUploads = rule =>
  CORS.origins.every(origin => allows(rule.origins, origin)) &&
  CORS.methods.every(method => rule.methods.includes(method.toLowerCase())) &&
  CORS.headers.every(header => allows(rule.headers, header));

const HISTORY_RULE = 'expire-history';
// Matches HISTORY_PREFIX in lib/storage/r2.ts; old revisions are a safety net, not an archive.
const HISTORY_PREFIX = '_history/';
const HISTORY_DAYS = 90;

try {
  const accountId =
    options['account-id'] ??
    process.env.CLOUDFLARE_ACCOUNT_ID ??
    (() => {
      const output = wrangler('whoami', '--json');
      const { accounts = [] } = JSON.parse(
        output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1),
      );
      if (accounts.length !== 1) {
        fail(
          `Your login can see ${accounts.length} accounts; pick one with --account-id:\n${accounts
            .map(account => `  ${account.id}  ${account.name}`)
            .join('\n')}`,
        );
      }
      return accounts[0].id;
    })();
  // Every later wrangler call inherits this, so none of them stops to ask which account.
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;

  const buckets = new Set(
    [...wrangler('r2', 'bucket', 'list').matchAll(/^name:\s+(\S+)/gm)].map(match => match[1]),
  );
  for (const bucket of [assetsBucket, contentBucket, devContentBucket]) {
    if (buckets.has(bucket)) {
      done(`bucket ${bucket} exists`);
    } else {
      wrangler('r2', 'bucket', 'create', bucket);
      done(`created bucket ${bucket}`);
    }
  }

  let corsOutput;
  let hasNoCors;
  try {
    corsOutput = wrangler('r2', 'bucket', 'cors', 'list', assetsBucket);
    hasNoCors = /no CORS configuration/i.test(corsOutput);
  } catch (error) {
    // A bucket that never had CORS answers "does not exist" (API code 10059) rather than [].
    if (!/does not exist|10059/i.test(error.message)) {
      throw error;
    }
    corsOutput = '';
    hasNoCors = true;
  }
  // Written only when wrangler said there is nothing: output it cannot parse must never lead to
  // replacing another site's rules.
  if (parseCorsRules(corsOutput).some(coversUploads)) {
    done(`CORS on ${assetsBucket} already allows uploads from ${origins.join(', ')}`);
  } else if (hasNoCors) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'faiz-setup-'));
    const file = path.join(dir, 'cors.json');
    const rule = {
      allowed: { origins: CORS.origins, methods: CORS.methods, headers: CORS.headers },
      maxAgeSeconds: CORS.maxAgeSeconds,
    };
    fs.writeFileSync(file, JSON.stringify({ rules: [rule] }));
    try {
      wrangler('r2', 'bucket', 'cors', 'set', assetsBucket, '--file', file, '--force');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    done(`CORS on ${assetsBucket} allows uploads from ${origins.join(', ')}`);
  } else {
    const dashboardRule = {
      AllowedOrigins: CORS.origins,
      AllowedMethods: CORS.methods,
      AllowedHeaders: CORS.headers,
      MaxAgeSeconds: CORS.maxAgeSeconds,
    };
    todo.push(
      `CORS: ${assetsBucket} already has rules, likely for other sites. Add this one next to them in R2 →
     ${assetsBucket} → Settings → CORS policy → Edit:
     ${JSON.stringify(dashboardRule)}`,
    );
  }

  for (const bucket of [contentBucket, devContentBucket]) {
    const rules = [
      ...wrangler('r2', 'bucket', 'lifecycle', 'list', bucket).matchAll(/^name:\s+(\S+)/gm),
    ].map(match => match[1]);
    if (rules.includes(HISTORY_RULE)) {
      done(`${bucket} already expires ${HISTORY_PREFIX} after ${HISTORY_DAYS} days`);
      continue;
    }
    wrangler(
      'r2',
      'bucket',
      'lifecycle',
      'add',
      bucket,
      HISTORY_RULE,
      HISTORY_PREFIX,
      '--expire-days',
      String(HISTORY_DAYS),
      '--force',
    );
    done(`${bucket} expires ${HISTORY_PREFIX} after ${HISTORY_DAYS} days`);
  }

  const domains = [
    ...wrangler('r2', 'bucket', 'domain', 'list', assetsBucket).matchAll(/^domain:\s+(\S+)/gm),
  ].map(match => match[1]);
  if (domains.includes(assetsDomain)) {
    done(`${assetsDomain} serves ${assetsBucket}`);
  } else if (zoneId) {
    wrangler(
      'r2',
      'bucket',
      'domain',
      'add',
      assetsBucket,
      '--domain',
      assetsDomain,
      '--zone-id',
      zoneId,
      '--force',
    );
    done(`connected ${assetsDomain} to ${assetsBucket} (it can take a few minutes to go live)`);
  } else {
    todo.push(
      `Domain: re-run with --zone-id <id> to connect ${assetsDomain}. The Zone ID is on the
     domain's Overview page in the dashboard, right column, under API.`,
    );
  }

  // A fresh site has nothing to render until site.json exists, and no screen creates it. Opt-in:
  // a site being migrated gets its own site.json from the migration instead.
  if (options.seed) {
    const starter = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'faiz-seed-')), 'site.json');
    fs.writeFileSync(
      starter,
      `${JSON.stringify({ name: 'My Blog', bio: '', site: origins[0] }, null, 2)}\n`,
    );
    for (const bucket of [contentBucket, devContentBucket]) {
      try {
        wrangler('r2', 'object', 'get', `${bucket}/site.json`, '--remote', '--pipe');
        done(`${bucket}/site.json already exists`);
      } catch {
        wrangler(
          'r2',
          'object',
          'put',
          `${bucket}/site.json`,
          '--file',
          starter,
          '--content-type',
          'application/json',
          '--remote',
        );
        done(`seeded ${bucket}/site.json — edit name, bio and site to your own`);
      }
    }
  }

  const envBlock = (bucket, assetsFolder) =>
    [
      `R2_ACCOUNT_ID=${accountId}`,
      'R2_ACCESS_KEY_ID=',
      'R2_SECRET_ACCESS_KEY=',
      `R2_ASSETS_BUCKET=${assetsBucket}`,
      `R2_CONTENT_BUCKET=${bucket}`,
      `NEXT_PUBLIC_ASSETS_URL=https://${assetsDomain}/${assetsFolder}`,
      // A separate key per block: a leaked .env.local must not open the live site.
      `EDIT_KEY=${randomBytes(32).toString('base64url')}`,
    ].join('\n');

  const steps = [
    `R2 API token: R2 object storage → API Tokens → Manage → Create Account API token.
     Permissions: Object Read & Write. Buckets: ${assetsBucket}, ${contentBucket}, ${devContentBucket}.
     Put its Access Key ID and Secret Access Key into both blocks below.`,
    `Image resizing: Images → Transformations → the zone of ${assetsDomain} → Enable for zone.`,
    ...todo,
  ];
  console.log('\nIn the Cloudflare dashboard');
  steps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step}`);
  });

  console.log(`\n── .env.local (local dev: ${devContentBucket}, folder ${devFolder}) ──`);
  console.log(envBlock(devContentBucket, devFolder));
  console.log(`\n── Vercel → Settings → Environment Variables, Production and Preview ──`);
  console.log(envBlock(contentBucket, folder));
  console.log(
    '\nThe EDIT_KEYs were generated just now. Re-running? Keep the ones you already use: a new key signs every browser out.',
  );
} catch (error) {
  // Without a login, wrangler's non-interactive error asks for CLOUDFLARE_API_TOKEN instead.
  const loggedOut = /CLOUDFLARE_API_TOKEN|not (logged in|authenticated)/i.test(error.message);
  fail(
    loggedOut
      ? 'Not logged in to Cloudflare. Run `npx wrangler login` and try again.'
      : error.message,
  );
}
