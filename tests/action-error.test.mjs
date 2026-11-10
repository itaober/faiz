import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundError, StorageError } from '../lib/errors.ts';
import { createActionError } from '../lib/types/action-result.ts';

test('classifies on status, not on text that happens to contain one', () => {
  // Keys end up in the message, so a post slugged "top-404-pages" must not read as missing.
  const misleading = new StorageError(500, 'Failed to write posts/top-404-pages.mdx: 500');
  assert.equal(createActionError(misleading).code, 'UNKNOWN');

  assert.equal(createActionError(new StorageError(404, 'nope')).code, 'NOT_FOUND');
  assert.equal(createActionError(new StorageError(412, 'nope')).code, 'CONFLICT');
  assert.equal(createActionError(new NotFoundError('Memo not found')).code, 'NOT_FOUND');
});

test('treats a busy store as retryable', () => {
  for (const status of [429, 503]) {
    const result = createActionError(new StorageError(status, 'nope'));
    assert.equal(result.code, 'RATE_LIMIT');
    assert.equal(result.retryable, true);
  }
});

test('never leaks the raw message for unclassified failures', () => {
  const leaky = new StorageError(500, 'Failed to write posts/secret.mdx in faiz-content');
  const result = createActionError(leaky, 'Failed to save post');
  assert.equal(result.error, 'Failed to save post');
  assert.equal(result.code, 'UNKNOWN');

  const nonError = createActionError('a bare string', 'Failed to save post');
  assert.equal(nonError.error, 'Failed to save post');
  assert.equal(nonError.code, 'UNKNOWN');
});
