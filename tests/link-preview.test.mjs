import assert from 'node:assert/strict';
import test from 'node:test';

import { getLinkPreview, isBlockedLinkAddress } from '../lib/server/link-preview.ts';
import { signLinkIconUrl, verifyLinkIconSignature } from '../lib/server/link-preview-signature.ts';

test('keeps public IPv4 separate from IPv4-mapped IPv6 blocking', () => {
  assert.equal(isBlockedLinkAddress('8.8.8.8', 4), false);
  assert.equal(isBlockedLinkAddress('127.0.0.1', 4), true);
  assert.equal(isBlockedLinkAddress('::ffff:8.8.8.8', 6), true);
  assert.equal(isBlockedLinkAddress('64:ff9b::7f00:1', 6), true);
  assert.equal(isBlockedLinkAddress('64:ff9b:1::7f00:1', 6), true);
  assert.equal(isBlockedLinkAddress('2002:7f00:1::', 6), true);
  assert.equal(isBlockedLinkAddress('2001:0:4136:e378:8000:63bf:3fff:fdd2', 6), true);
});

test('signs only the exact favicon URL', () => {
  const previousSecret = process.env.LINK_PREVIEW_SIGNING_SECRET;
  process.env.LINK_PREVIEW_SIGNING_SECRET = 'test-link-preview-secret';

  try {
    const url = 'https://example.com/favicon.ico';
    const signature = signLinkIconUrl(url);
    assert.ok(signature);
    assert.equal(verifyLinkIconSignature(url, signature), true);
    assert.equal(verifyLinkIconSignature('https://example.com/other.png', signature), false);
    assert.equal(verifyLinkIconSignature(url, `${signature}x`), false);
    assert.equal(verifyLinkIconSignature(url, '你'.repeat(43)), false);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.LINK_PREVIEW_SIGNING_SECRET;
    } else {
      process.env.LINK_PREVIEW_SIGNING_SECRET = previousSecret;
    }
  }
});

test('rejects direct private-network preview targets', async () => {
  await assert.rejects(
    getLinkPreview('http://127.0.0.1/'),
    /Private network links are not allowed/,
  );
  await assert.rejects(
    getLinkPreview('http://[::ffff:127.0.0.1]/'),
    /Private network links are not allowed/,
  );
});

test('rejects invalid preview URLs before any request is made', async () => {
  await assert.rejects(getLinkPreview('ftp://example.com/'), /Unsupported link protocol/);
  await assert.rejects(
    getLinkPreview('http://user:pass@example.com/'),
    /Link credentials are not allowed/,
  );
  await assert.rejects(
    getLinkPreview('http://example.com:8080/'),
    /Non-standard link ports are not allowed/,
  );
  await assert.rejects(getLinkPreview('http://staging.localhost/'), /Local links are not allowed/);
});
