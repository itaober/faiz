import assert from 'node:assert/strict';
import test from 'node:test';

import { getSizes, LAYOUTS } from '../components/image-gallery/sizing.ts';

test('a lone image may take the whole column', () => {
  assert.equal(getSizes(LAYOUTS.post, 1.5), '(max-width: 767px) min(900px, 100vw), 720px');
});

test('a strip image takes its part of the slot, which memos widen on phones', () => {
  assert.equal(getSizes(LAYOUTS.memo, 16 / 9, 1), '(max-width: 767px) min(569px, 86vw), 484px');
  assert.equal(getSizes(LAYOUTS.post, 1, 0.5), '(max-width: 767px) min(600px, 35vw), 252px');
});
