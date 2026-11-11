import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAssetKey, coverImageId } from '../lib/utils/editor-image.ts';

test('a replaced cover never reuses a key, however long the name', () => {
  const name =
    'the-structure-of-scientific-revolutions-50th-anniversary-edition-revised-and-expanded';
  const keys = ['a1b2c3', 'z9y8x7'].map(uploadId =>
    buildAssetKey({ entityId: 'book', imageId: coverImageId(name, uploadId), scope: 'records' }),
  );
  assert.notEqual(keys[0], keys[1]);
  assert.match(keys[0], /_a1b2c3\.webp$/);
});
