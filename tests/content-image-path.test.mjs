import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAssetImageKey,
  isSafeContentImagePath,
  normalizeImagePathList,
} from '../lib/content-editing-validation.ts';

test('reads every asset key content already holds, odd filenames included', () => {
  for (const key of [
    'site/avatar.webp',
    'memos/memo_2026-08-19_01.webp',
    'posts/weekly_15_黑松露炒饭.webp',
    'records/music_David Tao.webp',
    'records/music_没有鸟鸣，关上窗吧.webp',
    'records/music_秋：故事.webp',
  ]) {
    assert.equal(isAssetImageKey(key), true, key);
  }
});

test('stays inside the known folders and off non-image files', () => {
  for (const key of [
    'avatar.webp',
    'assets/memos/x.webp',
    'data/meta.webp',
    'posts/notes.mdx',
    'records/cover',
    'records/logo.svg',
    'records/logo.ico',
  ]) {
    assert.equal(isAssetImageKey(key), false, key);
  }
});

test('rejects traversal and empty segments', () => {
  assert.equal(isAssetImageKey('memos/../site/x.webp'), false);
  assert.equal(isAssetImageKey('memos/./x.webp'), false);
  assert.equal(isAssetImageKey('memos//x.webp'), false);
  assert.equal(isAssetImageKey('memos/..\\site\\x.webp'), false);
});

test('only keys we generate pass the write-side check, scoped when asked', () => {
  assert.equal(isSafeContentImagePath('memos/memo_20261109_a2mijt_y0zzcs.webp', 'memos'), true);
  assert.equal(isSafeContentImagePath('memos/memo_x.webp', 'posts'), false);
  assert.equal(isSafeContentImagePath('assets/memos/memo_x.webp'), false);
  assert.equal(isSafeContentImagePath('site/avatar.webp'), false);
  assert.equal(isSafeContentImagePath('records/music_David Tao.webp'), false);
});

test('normalizes and de-duplicates memo image keys, reporting the rest', () => {
  const { paths, invalid } = normalizeImagePathList(
    ['/memos/a_1.webp', 'memos/a_1.webp', 'posts/b_2.webp', 42],
    'memos',
  );
  assert.deepEqual(paths, ['memos/a_1.webp']);
  assert.deepEqual(invalid, ['posts/b_2.webp', 42]);
});
