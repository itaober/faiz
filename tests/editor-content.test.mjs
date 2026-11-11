import assert from 'node:assert/strict';
import test from 'node:test';

import {
  markdownTodoListsToMdx,
  mdxTodoListsToMarkdown,
  scanMdxBlock,
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
  for (const value of ['plain', 'a "b" c', 'a & b', '&quot;', '&amp;', '&amp;quot;', '"&"']) {
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

// The editor keeps a component it can't render as its source; anything the scanner
// misses is parsed as text and escaped on save, which breaks the published page.

test('scans a multi-line self-closing component and the rest of its line', () => {
  const element = '<ParticleImage\n  src="site/avatar-particle.png"\n  align="left"\n/>';
  assert.deepEqual(scanMdxBlock(`${element}  \n\nnext`), {
    name: 'ParticleImage',
    source: element,
    raw: `${element}  \n`,
  });
  assert.equal(
    scanMdxBlock('<Tweet id="2090416137720999992" />')?.source,
    '<Tweet id="2090416137720999992" />',
  );
});

test('a > inside quotes or braces does not end the tag', () => {
  const element = '<Chart label="a > b" data={[{ x: 1, note: "}>" }]} render={() => <b>hi</b>} />';
  assert.equal(scanMdxBlock(element)?.source, element);
});

test('scans a paired component up to its closing tag', () => {
  const element = '<Columns widths={[2, 1]}>\n\nLeft *text*\n\nRight\n\n</Columns>';
  assert.equal(scanMdxBlock(`${element}\nafter`)?.source, element);
  assert.equal(scanMdxBlock('<Columns>\nno closing tag'), null);
});

test('leaves inline, lowercase, indented and unterminated tags alone', () => {
  assert.equal(scanMdxBlock('<Badge>new</Badge> and more text'), null);
  assert.equal(scanMdxBlock('<div>html</div>'), null);
  assert.equal(scanMdxBlock('  <Tweet id="1" />'), null);
  assert.equal(scanMdxBlock('text <Tweet id="1" />'), null);
  assert.equal(scanMdxBlock('<Tweet id="1"'), null);
  assert.equal(scanMdxBlock('<Tweetish-thing />'), null);
});
