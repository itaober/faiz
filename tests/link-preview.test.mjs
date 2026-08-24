import assert from 'node:assert/strict';
import test from 'node:test';

import { getIconHref, normalizeUrl, parseMetadata } from '../lib/link-preview-core.ts';

test('rejects invalid preview URLs before any request is made', () => {
  assert.throws(() => normalizeUrl('ftp://example.com/'), /Unsupported link protocol/);
  assert.throws(() => normalizeUrl('http://user:pass@example.com/'), /credentials/);
  assert.throws(() => normalizeUrl('http://example.com:8080/'), /Non-standard link ports/);
  assert.throws(() => normalizeUrl('http://localhost/'), /Local links/);
  assert.throws(() => normalizeUrl('http://staging.localhost/'), /Local links/);
  assert.throws(() => normalizeUrl('http://box.internal/'), /Local links/);
});

test('normalizes the map key: strips the hash, keeps query, allows default ports', () => {
  assert.equal(
    normalizeUrl('https://example.com:443/a?b=1#frag').toString(),
    'https://example.com/a?b=1',
  );
});

test('extracts og/twitter metadata with entity decoding and tag stripping', () => {
  const html = `
    <html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="Tom &amp; Jerry &#x2014; home">
      <meta name="description" content="A &lt;b&gt;bold&lt;/b&gt;   move&nbsp;indeed">
      <meta property="og:site_name" content="Example">
    </head></html>`;
  const data = parseMetadata(html, new URL('https://www.example.com/page'));

  assert.equal(data.title, 'Tom & Jerry — home');
  assert.equal(data.description, 'A bold move indeed');
  assert.equal(data.siteName, 'Example');
  assert.equal(data.hostname, 'example.com');
  assert.equal(data.url, 'https://www.example.com/page');
  assert.equal(data.iconUrl, undefined);
});

test('falls back to <title>, then hostname', () => {
  const withTitle = parseMetadata('<title>Only title</title>', new URL('https://a.example/'));
  assert.equal(withTitle.title, 'Only title');

  const bare = parseMetadata('', new URL('https://a.example/'));
  assert.equal(bare.title, 'a.example');
});

test('resolves the favicon href, skipping SVG and falling back to /favicon.ico', () => {
  const page = new URL('https://example.com/docs/page');

  assert.equal(
    getIconHref('<link rel="icon" href="/img/icon.png">', page),
    'https://example.com/img/icon.png',
  );
  // SVG icons are skipped (stored-XSS vector when re-served), so the default wins.
  assert.equal(
    getIconHref('<link rel="icon" href="/icon.svg">', page),
    'https://example.com/favicon.ico',
  );
  assert.equal(getIconHref('', page), 'https://example.com/favicon.ico');
});
