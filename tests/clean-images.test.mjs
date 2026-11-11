import assert from 'node:assert/strict';
import test from 'node:test';

import { findOrphans } from '../scripts/clean-images.mjs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-11T00:00:00Z');
const old = now - 2 * DAY;

test('keeps an image any content or history copy mentions, in any form', () => {
  const objects = [
    { key: 'memos/memo_a.webp', lastModified: old },
    { key: 'records/music_David Tao.webp', lastModified: old },
    { key: 'posts/weekly_15_黑松露炒饭.webp', lastModified: old },
    { key: 'memos/memo_gone.webp', lastModified: old },
  ];
  const contents = [
    '[{"images":["memos/memo_a.webp"]}]',
    '{"coverUrl":"records/music_David Tao.webp"}',
    '![](posts/weekly_15_%E9%BB%91%E6%9D%BE%E9%9C%B2%E7%82%92%E9%A5%AD.webp)',
  ];
  assert.deepEqual(
    findOrphans(objects, contents, now).map(({ key }) => key),
    ['memos/memo_gone.webp'],
  );
});

test('leaves fresh uploads and hand-placed site files alone', () => {
  const objects = [
    { key: 'memos/memo_new.webp', lastModified: now - DAY / 2 },
    { key: 'site/avatar.webp', lastModified: old },
  ];
  assert.deepEqual(findOrphans(objects, [], now), []);
});
