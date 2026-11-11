import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Image from '@tiptap/extension-image';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { serialize } from 'next-mdx-remote/serialize';

import { MdxBlockBase, mdxBlockLabel, separateInListItem } from '../lib/mdx-block.ts';
import {
  markdownTodoListsToMdx,
  mdxToEditorMarkdown,
  transformOutsideMdxBlocks,
} from '../lib/mdx-editing.ts';
import { assertCompilableMdx } from '../lib/server/mdx-validate.ts';
import {
  formatMarkdownGallery,
  formatMarkdownImage,
  groupConsecutiveMdxImages,
  mdxImagesToMarkdown,
  normalizeEditorImageMarkup,
} from '../lib/utils/editor-image.ts';

// The editor's markdown setup without a DOM: the extensions of components/editing/tiptap-editor.tsx
// that read or write markdown, StagedImage reduced to its markdown override.
const manager = new MarkdownManager({
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Image.extend({
      renderMarkdown: (node, _helpers, context) =>
        separateInListItem(
          formatMarkdownImage(String(node.attrs.src), String(node.attrs.alt)),
          context,
        ),
    }),
    MdxBlockBase,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table,
    TableRow,
    TableHeader,
    TableCell,
  ],
});

// Load: the surface's draft (page/post), then the editor's image step. Save: the surface's
// conversion (posts also group images), then the server's image normalisation.
const load = mdx =>
  manager.parse(transformOutsideMdxBlocks(mdxToEditorMarkdown(mdx), mdxImagesToMarkdown));
const server = content =>
  `${transformOutsideMdxBlocks(content, normalizeEditorImageMarkup).trimEnd()}\n`;
const savePage = markdown => server(markdownTodoListsToMdx(markdown));
const savePost = markdown =>
  server(
    transformOutsideMdxBlocks(markdownTodoListsToMdx(markdown), segment =>
      groupConsecutiveMdxImages(normalizeEditorImageMarkup(segment)),
    ),
  );
const cycle = (mdx, save) => save(manager.serialize(load(mdx)));

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const blocks = doc => doc.content.filter(node => node.type === 'mdxBlock');

test('the About page saves back byte for byte, its portrait and todo list included', () => {
  const about = fixture('about.mdx');
  assert.equal(blocks(load(about))[0].attrs.name, 'ParticleImage');
  assert.equal(cycle(about, savePage), about);
});

test('weekly #16 keeps its Tweet as written, and a second save changes nothing', () => {
  const post = fixture('weekly-16-20260824.mdx');
  const once = cycle(post, savePost);
  assert.ok(once.includes('\n<Tweet id="2090416137720999992" />\n'));
  assert.equal(cycle(once, savePost), once);
});

test('a component under an ordered list item survives repeated saves', () => {
  const markdown = '1. item\n\n   <Tweet id="1" />\n\nafter\n';
  const once = manager.serialize(manager.parse(markdown));
  assert.equal(manager.serialize(manager.parse(once)), once);
  assert.ok(once.includes('<Tweet id="1" />'));
  assert.doesNotMatch(once, /&lt;/);
});

test('an image or a component under a bullet stays in the item across saves', () => {
  const post = '- item\n\n  <Image src="a.webp" alt="A" />\n\n- next\n\n  <Tweet id="1" />\n';
  const once = cycle(post, savePost);
  assert.equal(cycle(once, savePost), once);
  assert.match(once, /\n {2}<Image src="a.webp" alt="A" \/>\n/);
  assert.match(once, /\n {2}<Tweet id="1" \/>\n/);
});

test('an indented component after a paragraph is a block on the first save', () => {
  const doc = manager.parse('para\n\n  <Tweet id="1" />\n');
  assert.deepEqual(blocks(doc)[0].attrs, { name: 'Tweet', source: '<Tweet id="1" />' });
});

test('a paragraph that opens with inline JSX is kept whole, labelled by its first line', () => {
  const markdown = '<Badge>new</Badge> and more\ncontinued\n\nnext\n';
  const doc = manager.parse(markdown);
  const { name, source } = blocks(doc)[0].attrs;
  assert.equal(source, '<Badge>new</Badge> and more\ncontinued');
  assert.equal(mdxBlockLabel(name, source), '<Badge>new</Badge> and more');
  assert.equal(manager.serialize(doc), markdown.trimEnd());
});

test('a tag the parser rejects is kept as written up to the blank line', () => {
  const doc = manager.parse('<Badge>\nunclosed\n\nnext\n');
  assert.equal(blocks(doc)[0].attrs.source, '<Badge>\nunclosed');
  for (const card of [
    '<LinkCard href="https://music.163.com/song?id=1" title="a > b" />',
    '<LinkCard type="video" href="https://example.com" />',
  ]) {
    assert.equal(blocks(manager.parse(card))[0].attrs.source, card, card);
  }
});

test('components stay as written wherever they sit: quotes, deep lists, comments, fences', () => {
  const columns =
    '<Columns>\n\n```html\n</Columns>\n```\n\n<Columns>inner [z](w)</Columns>\n\n</Columns>';
  const mdx = [
    '> quote',
    '>',
    '> <Tweet id="1" caption="see [docs](https://d.com)" />',
    '',
    '- item',
    '',
    '    <Card note="[x](y)" />',
    '',
    '{/* a note with [a](b) */}',
    '',
    columns,
    '',
    'a [link](/l)',
    '',
  ].join('\n');
  const once = cycle(mdx, savePage);
  assert.equal(cycle(once, savePage), once);
  for (const kept of [
    '<Tweet id="1" caption="see [docs](https://d.com)" />',
    '<Card note="[x](y)" />',
    '{/* a note with [a](b) */}',
    columns,
  ]) {
    assert.ok(once.includes(kept), kept);
  }
  assert.ok(once.includes('a <Link href="/l">link</Link>'));
});

test('braces in text are escaped, so the page compiles and shows them; code keeps its own', async () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'a {b} c { ' },
          { type: 'text', text: 'x{y}', marks: [{ type: 'code' }] },
        ],
      },
    ],
  };
  const saved = savePage(manager.serialize(doc));
  assert.equal(saved, 'a \\{b\\} c \\{ `x{y}`\n');
  await assertCompilableMdx(saved);
  const { compiledSource } = await serialize(saved, { blockJS: false, blockDangerousJS: true });
  assert.ok(compiledSource.includes('"a {b} c { "'));
  assert.equal(manager.serialize(manager.parse(saved.trim())), saved.trim());
});

test('a copied chip pastes back with its source; markup from elsewhere does not', () => {
  const attrs = { name: 'Tweet', source: '<Tweet id="1" />' };
  const [, rendered] = MdxBlockBase.config.renderHTML({ node: { attrs }, HTMLAttributes: {} });
  const [rule] = MdxBlockBase.config.parseHTML();
  const element = values => ({ getAttribute: key => values[key] ?? null });

  assert.deepEqual(rule.getAttrs(element(rendered)), attrs);
  assert.equal(rule.getAttrs(element({ ...rendered, 'data-mdx-block': 'guessed' })), false);
  assert.equal(rule.getAttrs(element({ ...rendered, 'data-source': 'plain text' })), false);
});

test('a pasted image or gallery alt cannot open a JSX line in the saved MDX', async () => {
  const alt = 'x]\n<Evil onClick={x}';
  const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: 'a b).webp', alt } }] };
  const page = savePage(manager.serialize(doc));
  assert.equal(page, '<Image src="a%20b%29.webp" alt="x] <Evil onClick={x}" />\n');
  const gallery = savePost(
    formatMarkdownGallery([
      { src: 'a.webp', alt },
      { src: 'b.webp', alt: 'B' },
    ]),
  );
  assert.equal(
    gallery,
    '<ImageGallery images={[{"src":"a.webp","alt":"x] <Evil onClick={x}"},{"src":"b.webp","alt":"B"}]} />\n',
  );
  await assertCompilableMdx(page);
  await assertCompilableMdx(gallery);
});
