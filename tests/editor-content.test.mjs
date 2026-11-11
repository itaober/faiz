import assert from 'node:assert/strict';
import test from 'node:test';
import {
  markdownTodoListsToMdx,
  mdxTodoListsToMarkdown,
  mdxToEditorMarkdown,
  transformOutsideMdxBlocks,
} from '../lib/mdx-editing.ts';
import {
  escapeMdxAttribute,
  groupConsecutiveMdxImages,
  mdxImagesToMarkdown,
  normalizeEditorImageMarkup,
  unescapeMdxAttribute,
} from '../lib/utils/editor-image.ts';

// Every save runs the editor's markdown through normalizeEditorImageMarkup, and
// opening the editor runs the stored MDX back through mdxImagesToMarkdown. Both
// directions have to be stable, or stored posts drift a little on each save.

test('markdown images survive a round trip to MDX and back', () => {
  const markdown = '![a cat](assets/posts/cat.webp)';
  const mdx = normalizeEditorImageMarkup(markdown);

  assert.equal(mdx, '<Image src="assets/posts/cat.webp" alt="a cat" />');
  assert.equal(mdxImagesToMarkdown(mdx), markdown);
});

test('normalizing is idempotent for captions holding quotes or ampersands', () => {
  // Regression: escapeMdxAttribute HTML-escapes, but its old counterpart only
  // undid backslash escapes, so each save re-escaped — & became &amp; became
  // &amp;amp; — and the editor showed the entities as literal text.
  const markdown = '![say "hi" & bye](assets/posts/a.webp)';
  const once = normalizeEditorImageMarkup(markdown);

  assert.equal(once, '<Image src="assets/posts/a.webp" alt="say &quot;hi&quot; &amp; bye" />');
  assert.equal(normalizeEditorImageMarkup(once), once, 'second save must not change the file');
  assert.equal(normalizeEditorImageMarkup(normalizeEditorImageMarkup(once)), once);
  assert.equal(mdxImagesToMarkdown(once), markdown, 'editor must load the original characters');
});

test('escape and unescape are inverses, with the ampersand entity decoded last', () => {
  for (const value of [
    'plain',
    'a "b" c',
    'a & b',
    '&quot;',
    '&amp;',
    '&amp;quot;',
    '"&"',
    'a <b /> &lt;',
  ]) {
    assert.equal(unescapeMdxAttribute(escapeMdxAttribute(value)), value, value);
  }
});

test('image markup inside fenced code is left alone', () => {
  const source = [
    '```md',
    '![x](assets/posts/x.webp)',
    '```',
    '',
    '![y](assets/posts/y.webp)',
  ].join('\n');
  const result = normalizeEditorImageMarkup(source);

  assert.match(result, /```md\n!\[x\]\(assets\/posts\/x\.webp\)\n```/);
  assert.match(result, /<Image src="assets\/posts\/y\.webp" alt="y" \/>/);
  assert.equal(normalizeEditorImageMarkup(result), result);
});

test('consecutive images group into a gallery that converts back to each image', () => {
  const mdx = normalizeEditorImageMarkup(
    '![one](assets/posts/1.webp)\n\n![two](assets/posts/2.webp)',
  );
  const grouped = groupConsecutiveMdxImages(mdx);

  assert.match(grouped, /^<ImageGallery images=\{\[/);
  assert.equal(
    mdxImagesToMarkdown(grouped).trim(),
    '![one](assets/posts/1.webp)\n\n![two](assets/posts/2.webp)',
  );
  // A lone image must not become a one-item gallery.
  const single = normalizeEditorImageMarkup('![only](assets/posts/1.webp)');
  assert.equal(groupConsecutiveMdxImages(single), single);
});

test('images separated by prose or another component stay separate', () => {
  const source = [
    '<Image src="assets/posts/one.webp" alt="one" />',
    '',
    'text between images',
    '',
    '<Image src="assets/posts/two.webp" alt="two" />',
    '',
    '<Tweet id="123" />',
    '',
    '<Image src="assets/posts/three.webp" alt="three" />',
  ].join('\\n');

  const grouped = groupConsecutiveMdxImages(source);

  assert.equal(grouped, source);
  assert.doesNotMatch(grouped, /<ImageGallery/);
});

test('todo lists survive a round trip and re-converting is stable', () => {
  const markdown = '- [x] done thing\n- [ ] open thing';
  const mdx = markdownTodoListsToMdx(markdown);

  assert.match(mdx, /<TodoList/);
  assert.match(mdx, /\{ label: "done thing", checked: true \}/);
  assert.equal(markdownTodoListsToMdx(mdx), mdx, 'second save must not change the file');
  assert.equal(mdxTodoListsToMarkdown(mdx).trim(), markdown);
});

// Page-level rewrites run on load and on save; they must not reach into a component the
// editor keeps as written, nor into code.

test('links inside a component attribute or code stay as written on save', () => {
  const particle = '<ParticleImage caption="see [docs](https://d.com)" />';
  const markdown = [
    particle,
    '',
    'Top [a](/b) and `[c](/d)` inline.',
    '',
    '```md',
    '[e](/f)',
    '```',
  ].join('\n');
  assert.equal(
    markdownTodoListsToMdx(markdown),
    markdown.replace('[a](/b)', '<Link href="/b">a</Link>'),
  );
});

test('a todo list and an image caption inside another component survive load and save', () => {
  const columns = [
    '<Columns>',
    '<TodoList items={[{ label: "one" }, { label: "two", checked: true }]} />',
    '<Image src="a.webp" alt="A" caption="Shown below" />',
    '</Columns>',
  ].join('\n');
  const loaded = transformOutsideMdxBlocks(mdxToEditorMarkdown(columns), mdxImagesToMarkdown);
  assert.equal(loaded, columns);
  assert.equal(
    transformOutsideMdxBlocks(markdownTodoListsToMdx(loaded), normalizeEditorImageMarkup),
    columns,
  );
});
