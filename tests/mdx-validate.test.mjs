import assert from 'node:assert/strict';
import test from 'node:test';

import { InvalidMdxError } from '../lib/errors.ts';
import { assertCompilableMdx } from '../lib/server/mdx-validate.ts';
import { createActionError } from '../lib/types/action-result.ts';

// Saving refuses content the site can't compile, before anything is written.

test('content the site compiles is accepted', async () => {
  await assertCompilableMdx('# Title\n\n<Tweet id="1" />\n\na \\{literal\\} brace\n');
});

test('a refused save names the failing line when the parser can', async () => {
  for (const [content, line] of [
    ['one\n\ntwo { here\n', 3],
    ['one\n\n<Badge>\n\ntext\n', 3],
  ]) {
    await assert.rejects(assertCompilableMdx(content), error => {
      assert.ok(error instanceof InvalidMdxError);
      assert.equal(error.line, line);
      assert.equal(error.message, `Can't save: line ${line} isn't valid MDX`);
      return true;
    });
  }
});

test('JavaScript only the compiler rejects is refused too, without a line', async () => {
  await assert.rejects(assertCompilableMdx('x\n\n{1 +}\n'), {
    message: "Can't save: this isn't valid MDX",
  });
});

test('the refusal reaches the editor as a validation error with that message', () => {
  assert.deepEqual(createActionError(new InvalidMdxError(12)), {
    success: false,
    error: "Can't save: line 12 isn't valid MDX",
    code: 'VALIDATION',
    retryable: false,
  });
});
