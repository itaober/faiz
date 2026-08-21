import assert from 'node:assert/strict';
import test from 'node:test';

import { GitHubApiError, gitHubApiError } from '../lib/errors.ts';
import { createActionError } from '../lib/types/action-result.ts';

const responseLike = (status, headers = {}) =>
  new Response(null, { status: status === 204 ? 204 : status, headers });

test('classifies on status, not on text that happens to contain one', () => {
  // The regression this replaces: putGitHubFile puts the path in the message, so
  // a post slugged "top-404-pages" reported NOT_FOUND on every failure.
  const misleading = new GitHubApiError(
    500,
    'Failed to put GitHub file: data/posts/top-404-pages.mdx - 500 Internal Server Error',
  );
  assert.equal(createActionError(misleading).code, 'UNKNOWN');

  assert.equal(createActionError(new GitHubApiError(401, 'nope')).code, 'AUTH_INVALID');
  assert.equal(createActionError(new GitHubApiError(404, 'nope')).code, 'NOT_FOUND');
  assert.equal(createActionError(new GitHubApiError(409, 'nope')).code, 'CONFLICT');
});

test('separates an exhausted quota from a token that lacks permission', () => {
  const quota = new GitHubApiError(403, 'nope', { rateLimited: true });
  assert.equal(createActionError(quota).code, 'RATE_LIMIT');
  assert.equal(createActionError(quota).retryable, true);

  // A read-only token writing: also 403, but retrying will never help.
  const forbidden = new GitHubApiError(403, 'nope');
  assert.equal(createActionError(forbidden).code, 'AUTH_INVALID');
  assert.equal(createActionError(forbidden).retryable, false);
  assert.match(createActionError(forbidden).error, /not allowed to write/);

  assert.equal(
    createActionError(new GitHubApiError(429, 'nope', { rateLimited: true })).code,
    'RATE_LIMIT',
  );
});

test('never leaks the raw message for unclassified failures', () => {
  const leaky = new GitHubApiError(500, 'Failed to put GitHub file: data/posts/secret.mdx');
  const result = createActionError(leaky, 'Failed to save post');
  assert.equal(result.error, 'Failed to save post');
  assert.equal(result.code, 'UNKNOWN');

  const nonError = createActionError('a bare string', 'Failed to save post');
  assert.equal(nonError.error, 'Failed to save post');
  assert.equal(nonError.code, 'UNKNOWN');
});

test('reads the rate-limit signal off the response headers', () => {
  assert.equal(
    gitHubApiError(responseLike(403, { 'x-ratelimit-remaining': '0' }), 'x').rateLimited,
    true,
  );
  assert.equal(
    gitHubApiError(responseLike(403, { 'x-ratelimit-remaining': '42' }), 'x').rateLimited,
    false,
  );
  assert.equal(gitHubApiError(responseLike(403), 'x').rateLimited, false);
  assert.equal(gitHubApiError(responseLike(429), 'x').rateLimited, true);
  assert.equal(gitHubApiError(responseLike(409), 'x').status, 409);
});
