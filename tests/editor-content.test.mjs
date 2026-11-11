import assert from 'node:assert/strict';
import test from 'node:test';
import { matchLinkCardMarkup } from '../lib/link-card.ts';
import {
  markdownTodoListsToMdx,
  mdxTodoListsToMarkdown,
  mdxToEditorMarkdown,
  scanMdxBlock,
  transformOutsideMdxBlocks,
} from '../lib/mdx-editing.ts';
import {
  escapeMdxAttribute,
  formatMarkdownImage,
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
  const element = '<Columns widths={[2, 1]}>\n\nLeft *text*\n\nRight\n\n</Columns >';
  assert.equal(scanMdxBlock(`${element}\nafter`)?.source, element);
  assert.equal(scanMdxBlock('<Columns>\nno closing tag'), null);
});

test('a nested same-name element does not close its parent', () => {
  const element =
    '<Columns>\n<Columns>\ninner\n</Columns>\n<Columns />\n<ColumnsItem>x</ColumnsItem>\n</Columns>';
  assert.equal(scanMdxBlock(`${element}\n\nafter`)?.source, element);
  assert.equal(scanMdxBlock('<Columns>\n<Columns>\n</Columns>'), null);
});

test("an apostrophe in JSX text inside braces doesn't swallow the tag", () => {
  const oneLine = `<Card render={() => <p>Don't</p>} />`;
  assert.equal(scanMdxBlock(oneLine)?.source, oneLine);
  assert.equal(scanMdxBlock(`${oneLine}\nnext`)?.source, oneLine);
  const multiLine = `<Card\n  render={() => (\n    <p>It's {"a > b"}</p>\n  )}\n/>`;
  assert.equal(scanMdxBlock(multiLine)?.source, multiLine);
});

test('a LinkCard its own node rejects is still scanned, so it stays verbatim', () => {
  const card = '<LinkCard type="music" href="https://music.163.com/song?id=1" title="T" />';
  assert.ok(matchLinkCardMarkup(card));
  for (const rejected of [
    '<LinkCard href="https://music.163.com/song?id=1" title="a > b" />',
    '<LinkCard href="https://music.163.com/song?id=1">label</LinkCard>',
    '<LinkCard type="video" href="https://example.com" />',
  ]) {
    assert.equal(matchLinkCardMarkup(rejected), null, rejected);
    assert.equal(scanMdxBlock(rejected)?.source, rejected, rejected);
  }
});

test('leaves inline, lowercase, code-indented and unterminated tags alone', () => {
  assert.equal(scanMdxBlock('<Badge>new</Badge> and more text'), null);
  assert.equal(scanMdxBlock('<div>html</div>'), null);
  assert.equal(scanMdxBlock('    <Tweet id="1" />'), null);
  assert.equal(scanMdxBlock('text <Tweet id="1" />'), null);
  assert.equal(scanMdxBlock('<Tweet id="1"'), null);
  assert.equal(scanMdxBlock('<Tweetish-thing />'), null);
});

test('a component indented up to three spaces is a block; its indent stays out of the source', () => {
  assert.deepEqual(scanMdxBlock('   <Tweet id="1" />\nnext'), {
    name: 'Tweet',
    source: '<Tweet id="1" />',
    raw: '   <Tweet id="1" />\n',
  });
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

test('a pasted image alt or src cannot open a JSX line in the saved MDX', () => {
  const markdown = formatMarkdownImage('a b)<c.webp', 'x]\n<Evil onClick={x} />\\ y');
  const saved = normalizeEditorImageMarkup(markdown);
  assert.doesNotMatch(saved, /\n/);
  assert.equal(saved, '<Image src="a%20b%29%3Cc.webp" alt="x] <Evil onClick={x} />\\ y" />');
});
