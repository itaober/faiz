import assert from 'node:assert/strict';
import test from 'node:test';

import { InvalidMdxError } from '../lib/errors.ts';
import { assertCompilableMdx } from '../lib/server/mdx-validate.ts';
import { createActionError } from '../lib/types/action-result.ts';

// Saving refuses content the read view can't compile, before anything is written.

test('content the site compiles is accepted, braces in strings and expressions included', async () => {
  for (const content of [
    '# Title\n\n<Tweet id="1" />\n\na \\{literal\\} brace\n',
    "Use {'{'} to open\n",
    'x\n\n<Tweet id="1" caption={"a } b"} />\n',
    'x\n\n<Tweet id="1" caption={"a { b"} />\n',
    // Raw, `{b` would open an expression; the read view turns the image into <Image> first.
    '![a {b](posts/x.webp)',
  ]) {
    await assertCompilableMdx(content);
  }
});

test('a refused save quotes the line it fails on, open `{` and tags included', async () => {
  for (const [content, near] of [
    ['one\n\n<Badge>\n\ntext\n', '<Badge>'],
    ['one\n\ntwo { here\n\nthree\n', 'two { here'],
    ['one\n\n{oops\n\n## two\n\n<Tweet id="1" />\n\nthree\n', '{oops'],
    ['one\n\n<Card>\n\n<Badge title="x\n\n</Card>\n\nfour\n', '<Badge title="x'],
    ['one\n\n<Tweet id="1"\n\nSum is {1 + 1}, x<sup>2</sup>\n\nmore\n', '<Tweet id="1"'],
    ['<Card\n  title="a"\n  1bad\n/>\n', '1bad'],
  ]) {
    await assert.rejects(assertCompilableMdx(content), error => {
      assert.ok(error instanceof InvalidMdxError);
      assert.equal(error.message, `Can't save: invalid MDX near “${near}”`);
      return true;
    });
  }
});

test('a long line is cut, and JavaScript only the compiler rejects is refused without one', async () => {
  await assert.rejects(assertCompilableMdx(`one\n\n<Badge>${'x'.repeat(60)}\n`), {
    message: `Can't save: invalid MDX near “<Badge>${'x'.repeat(33)}…”`,
  });
  await assert.rejects(assertCompilableMdx('x\n\n{1 +}\n'), {
    message: "Can't save: this isn't valid MDX",
  });
});

test('the refusal reaches the editor as a validation error with that message', () => {
  assert.deepEqual(createActionError(new InvalidMdxError('<Tweet id="1"')), {
    success: false,
    error: 'Can\'t save: invalid MDX near “<Tweet id="1"”',
    code: 'VALIDATION',
    retryable: false,
  });
});
