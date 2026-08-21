import assert from 'node:assert/strict';
import test from 'node:test';

import { isContentImageReadPath } from '../lib/content-editing-validation.ts';

const asSegments = path => path.split('/');

test('accepts every filename shape already committed to the content repo', () => {
  // Sampled from `git ls-tree -r content -- assets`: spaces and full-width
  // punctuation are real, and the avatar sits at the top level with no scope.
  for (const path of [
    'assets/avatar.webp',
    'assets/memos/memo_2026-08-19_01.webp',
    'assets/posts/weekly_15_黑松露炒饭.webp',
    'assets/records/music_David Tao.webp',
    'assets/records/music_没有鸟鸣，关上窗吧.webp',
    'assets/records/music_秋：故事.webp',
  ]) {
    assert.equal(isContentImageReadPath(asSegments(path)), true, path);
  }
});

test('keeps the proxy inside assets/ and off non-image files', () => {
  for (const path of [
    'data/meta.json',
    'data/posts.json',
    'data/posts/weekly-15-20260817.mdx',
    'pages/about.mdx',
    'assets',
    'assets/notes.mdx',
    'assets/records/cover',
  ]) {
    assert.equal(isContentImageReadPath(asSegments(path)), false, path);
  }
});

test('rejects traversal, including separators smuggled inside one segment', () => {
  assert.equal(isContentImageReadPath(['assets', '..', 'data', 'meta.webp']), false);
  assert.equal(isContentImageReadPath(['assets', '.', 'avatar.webp']), false);
  assert.equal(isContentImageReadPath(['assets', '', 'avatar.webp']), false);
  // A decoded %2F or %5C arrives as one segment holding a separator.
  assert.equal(isContentImageReadPath(['assets', '../data/meta.webp']), false);
  assert.equal(isContentImageReadPath(['assets', '..\\data\\meta.webp']), false);
});

test('refuses inline-renderable SVG even under assets/', () => {
  assert.equal(isContentImageReadPath(asSegments('assets/records/logo.svg')), false);
  assert.equal(isContentImageReadPath(asSegments('assets/records/logo.ico')), false);
});
