import assert from 'node:assert/strict';
import test from 'node:test';

import { parseContentSource } from '../lib/data/content-source.ts';

test('parses owner/repo#branch, defaulting the branch', () => {
  assert.deepEqual(parseContentSource('itaober/faiz#content'), {
    owner: 'itaober',
    repo: 'faiz',
    branch: 'content',
  });
  assert.deepEqual(parseContentSource('itaober/faiz'), {
    owner: 'itaober',
    repo: 'faiz',
    branch: 'content',
  });
  // Branch names may contain slashes; '#' cannot, so the split stays unambiguous.
  assert.deepEqual(parseContentSource('Some-Org/my.blog_content#wip/draft'), {
    owner: 'Some-Org',
    repo: 'my.blog_content',
    branch: 'wip/draft',
  });
});

test('refuses anything that would not stay inside the contents path', () => {
  // owner and repo are interpolated straight into the GitHub API URL.
  for (const value of ['faiz', '', '../../etc#content', 'a/b?ref=x', 'a/b/c', 'a/b#a?b', 'a/b#']) {
    assert.throws(() => parseContentSource(value), /GITHUB_CONTENT must name the repo/);
  }
});

test("has no default, so an unset value cannot publish somebody else's blog", () => {
  assert.throws(() => parseContentSource(undefined), /got no value at all/);
});
