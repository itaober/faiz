import assert from 'node:assert/strict';
import test from 'node:test';

import { removePost, replacePost, sortPosts, upsertPost } from '../lib/data/posts-index.ts';

const post = (slug, overrides = {}) => ({
  slug,
  title: slug,
  createdTime: '2026-01-01 10:00',
  updatedTime: '2026-01-01 10:00',
  tags: [],
  ...overrides,
});

const slugs = posts => posts.map(p => p.slug);

// A conflicting write is replayed against a freshly read index, so each mutation
// has to be safe to apply twice — otherwise a replay duplicates or resurrects a
// post.

test('upsert is idempotent and does not duplicate the slug', () => {
  const index = [post('a'), post('b')];
  const once = upsertPost(index, post('c'));
  const twice = upsertPost(once, post('c'));

  assert.deepEqual(slugs(once), ['c', 'a', 'b']);
  assert.deepEqual(slugs(twice), slugs(once));

  // Re-adding an existing slug replaces it rather than appending a second entry.
  const replaced = upsertPost(index, post('a', { title: 'renamed' }));
  assert.deepEqual(slugs(replaced), ['a', 'b']);
  assert.equal(replaced[0].title, 'renamed');
});

test('replace is idempotent, including after a rename already applied', () => {
  const index = [post('old'), post('other')];
  const renamed = post('new');

  const once = replacePost(index, 'old', renamed);
  assert.deepEqual(slugs(once), ['new', 'other']);

  // Replaying: 'old' is gone now, so it must not re-add a second 'new'.
  const twice = replacePost(once, 'old', renamed);
  assert.deepEqual(slugs(twice), slugs(once));

  // In-place edit keeps its position.
  const inPlace = replacePost(index, 'old', post('old', { title: 'edited' }));
  assert.deepEqual(slugs(inPlace), ['old', 'other']);
  assert.equal(inPlace[0].title, 'edited');
});

test('remove is idempotent and leaves the rest alone', () => {
  const index = [post('a'), post('b')];
  const once = removePost(index, 'a');
  const twice = removePost(once, 'a');

  assert.deepEqual(slugs(once), ['b']);
  assert.deepEqual(slugs(twice), ['b']);
  assert.deepEqual(slugs(removePost(index, 'missing')), ['a', 'b']);
});

test('sort puts pinned first, then newest', () => {
  const sorted = sortPosts([
    post('old', { createdTime: '2026-01-01 10:00' }),
    post('new', { createdTime: '2026-03-01 10:00' }),
    post('pinned-old', { createdTime: '2025-01-01 10:00', pinned: true }),
  ]);

  assert.deepEqual(slugs(sorted), ['pinned-old', 'new', 'old']);
});
