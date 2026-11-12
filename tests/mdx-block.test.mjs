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
  loadAcorn,
  markdownTodoListsToMdx,
  mdxToEditorMarkdown,
  readEditedBlock,
  readMdxPreview,
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

// Three saves in a row, each loading the last one's output.
const threeSaves = mdx => {
  const saved = [];
  for (let i = 0; i < 3; i += 1) saved.push(cycle(saved.at(-1) ?? mdx, savePage));
  return saved;
};

// What the page shows: the read view's compiler, run with stand-in components, printed as tags.
// A markdown link prints as <Link>, since saving turns one into the other on purpose.
const shown = async mdx => {
  const { compiledSource } = await serialize(mdx, { blockJS: false, blockDangerousJS: true });
  const element = (type, props) => ({ type, props });
  const runtime = {
    Fragment: 'Fragment',
    jsx: element,
    jsxs: element,
    jsxDEV: element,
    useMDXComponents: () => ({}),
  };
  const { default: Content } = new Function(compiledSource)(runtime);
  const stub = name => Object.defineProperty(() => null, 'name', { value: name });
  const components = Object.fromEntries(['Link', 'TodoList', 'Tweet'].map(n => [n, stub(n)]));
  const print = node => {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (Array.isArray(node)) return node.map(print).join('');
    if (!('props' in node)) {
      return `{${Object.entries(node)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? print(value) : value}`)
        .join(', ')}}`;
    }
    const { children, ...props } = node.props;
    if (node.type === 'Fragment') return print(children);
    const name = typeof node.type === 'function' ? node.type.name : node.type;
    const tag = name === 'a' ? 'Link' : name;
    const attrs = Object.entries(props).map(([key, value]) =>
      typeof value === 'object' ? ` ${key}=[${print(value)}]` : ` ${key}=${JSON.stringify(value)}`,
    );
    return `<${tag}${attrs.join('')}>${print(children)}</${tag}>`;
  };
  return print(Content({ components }));
};

test('the About page saves back byte for byte, its portrait and todo list included', () => {
  const about = fixture('about.mdx');
  assert.equal(blocks(load(about))[0].attrs.name, 'ParticleImage');
  assert.equal(cycle(about, savePage), about);
});

test('a registered component with literal props previews with those props, read not run', () => {
  const registry = new Map([['ParticleImage', 'particle']]);
  const [portrait] = blocks(load(fixture('about.mdx')));
  assert.deepEqual(readMdxPreview(portrait.attrs.source, registry), {
    component: 'particle',
    props: { src: 'site/avatar-particle.png', label: '涛宝的粒子肖像', align: 'left' },
  });
  assert.deepEqual(
    readMdxPreview(
      '<ParticleImage src="a&amp;b.png" spacing={4} ratio={-0.5} fit={false} title={"{x}"} still />',
      registry,
    )?.props,
    { src: 'a&b.png', spacing: 4, ratio: -0.5, fit: false, title: '{x}', still: true },
  );
  for (const source of [
    '<ParticleImage src={`a.png`} />',
    "<ParticleImage src={'a.png'} />",
    '<ParticleImage spacing={2 + 2} />',
    // The brace reader can't take this string; a chip, as the box needs acorn for it too.
    '<ParticleImage title={"x } y"} />',
    '<ParticleImage spacing={null} />',
    '<ParticleImage data={[1]} />',
    '<ParticleImage data={{ a: 1 }} />',
    '<ParticleImage src={/* c */ "a.png"} />',
    '<ParticleImage {...props} />',
    '<ParticleImage src={globalThis.alert("x")} />',
    '<ParticleImage src="a.png">\n  caption\n</ParticleImage>',
    'Hi <ParticleImage src="a.png" />',
    '<ParticleImage src="a.png" />\n\n<ParticleImage src="b.png" />',
    '<ParticleImage src="a.png"',
  ]) {
    assert.equal(readMdxPreview(source, registry), null, source);
  }
});

test('a component missing from the preview registry stays a chip', () => {
  const registry = new Map([['ParticleImage', 'particle']]);
  const tweet = '<Tweet id="2090416137720999992" />';
  assert.equal(readMdxPreview(tweet, registry), null);
  assert.equal(readMdxPreview('{1 + 1}', registry), null);
  assert.equal(readMdxPreview('<particleImage src="a.png" />', registry), null);
  assert.equal(readMdxPreview('<constructor />', registry), null);
  assert.equal(readMdxPreview(tweet, new Map([['Tweet', 'tweet']]))?.component, 'tweet');
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

test('text holding inline JSX or an expression anywhere is kept as written, not escaped', () => {
  const mdx = [
    'Sum is {1 + 1} today, a <sup>2</sup> b<br />c *em <Tweet id="1" /> em*',
    '',
    '## Title {1}',
    '',
    '- item <Tweet id="1" /> tail',
    '- plain',
    '',
    '1. one',
    '2. two {1 + 1}',
    '',
    'use `{x}` and \\{y\\} here',
    '',
  ].join('\n');
  const once = cycle(mdx, savePage);
  assert.equal(once, mdx);
  assert.equal(cycle(once, savePage), once);
});

test('a loose ordered list holding JSX or an expression past its first item is kept whole', () => {
  for (const mdx of [
    '1. one\n\n2. two {1 + 1}\n\nafter\n',
    '1. one\n\n2. two <sup>2</sup>\n\nafter\n',
  ]) {
    assert.equal(cycle(mdx, savePage), mdx);
  }
});

test('an ordered list kept as written in a bullet item leaves the item compact', () => {
  const mdx = '- top\n  1. a {1 + 1}\n  2. b\n- next\n';
  assert.equal(cycle(mdx, savePage), mdx);
});

test('a TodoList inside a list item stays as written, checkboxes included', () => {
  const todo =
    '<TodoList\n    readonly={true}\n    items={[{ label: "a", checked: true }, { label: "b" }]}\n  />';
  const once = cycle(`- plan\n\n  ${todo}\n\nafter\n`, savePage);
  assert.ok(once.includes(todo), once);
  assert.equal(cycle(once, savePage), once);
});

test('todo labels keep the characters the editor escapes, across saves', () => {
  const mdx =
    '<TodoList\n  readonly={true}\n  items={[\n    { label: "sum {1 + 1} *now*" },\n    { label: "a_b", checked: true }\n  ]}\n/>\n';
  assert.equal(cycle(mdx, savePage), mdx);
});

test('a todo label shows its text literally and keeps its links, across three saves', async () => {
  const cases = [
    ['- [ ] [\\{1 + 1\\}](/x)\n', '<div><Link href="/x">{1 + 1}</Link></div>'],
    ['- [ ] see [docs](/x)\n', '<div>see <Link href="/x">docs</Link></div>'],
    [
      '- [x] say "hi" \\\\ [the "docs" \\\\ x](/x) after \\{1\\} \\*now\\*\n',
      '<div>say "hi" \\ <Link href="/x">the "docs" \\ x</Link> after {1} *now*</div>',
      true,
    ],
    [
      '- [ ] a [b](/c) and [d](/e)\n',
      '<div>a <Link href="/c">b</Link> and <Link href="/e">d</Link></div>',
    ],
    // A task holding inline JSX stays one item, its text as typed.
    ['- [ ] a <sup>2</sup> [x](/y) b\n', '<div>a <sup>2</sup> <Link href="/y">x</Link> b</div>'],
    ['- [ ] \\[not a link\\](x) & `code`\n', '[not a link](x) & `code`'],
  ];
  for (const [mdx, label, checked] of cases) {
    const item = `{label: ${label}${checked ? ', checked: true' : ''}}`;
    for (const saved of threeSaves(mdx)) {
      assert.equal(await shown(saved), `<TodoList readonly=true items=[${item}]></TodoList>`, mdx);
    }
  }
});

test('todo items with quotes or a backtick next to a link all survive three saves', async () => {
  const cases = [
    [
      "- [ ] first\n- [ ] Read Paul Graham's [essay](/pg)\n- [x] third\n- [ ] fourth\n",
      [
        '{label: first}',
        '{label: <div>Read Paul Graham\'s <Link href="/pg">essay</Link></div>}',
        '{label: third, checked: true}',
        '{label: fourth}',
      ],
    ],
    [
      '- [x] [it\'s here](/d) said "ok" with a \\` tick\n- [ ] last\n',
      [
        '{label: <div><Link href="/d">it\'s here</Link> said "ok" with a ` tick</div>, checked: true}',
        '{label: last}',
      ],
    ],
  ];
  for (const [mdx, items] of cases) {
    for (const saved of threeSaves(mdx)) {
      assert.equal(
        await shown(saved),
        `<TodoList readonly=true items=[${items.join('')}]></TodoList>`,
        saved,
      );
    }
  }
});

test('a TodoList the reader would read short stays as written, every item kept', async () => {
  // As main wrote a label with a link: an apostrophe in raw JSX text, which the item splitter
  // takes for the start of a string.
  const stored = [
    '<TodoList',
    '  readonly={true}',
    '  items={[',
    '    { label: "first" },',
    '    {',
    '      label: (',
    '        <div>',
    '          Read Paul Graham\'s <Link href="/pg">essay</Link>',
    '        </div>',
    '      ),',
    '    },',
    '    { label: "third", checked: true },',
    '    { label: "fourth" }',
    '  ]}',
    '/>',
    '',
  ].join('\n');
  assert.equal(blocks(load(stored))[0].attrs.name, 'TodoList');
  const expected = await shown(stored);
  assert.match(expected, /first.*Paul Graham's.*third, checked: true.*fourth/);
  for (const saved of threeSaves(stored)) {
    assert.equal(saved, stored);
    assert.equal(await shown(saved), expected);
  }
});

test('a TodoList label shows the same text after three saves: entities, strings, escapes', async () => {
  const todo = items => `<TodoList items={[${items}]} />\n`;
  const shownList = items => `<TodoList readonly=true items=[${items.join('')}]></TodoList>`;
  const cases = [
    // A no-break space is text, not whitespace to collapse; a `!` before a link is text.
    [
      todo('{ label: (<div>a&nbsp;b <Link href="/y">x</Link></div>) }'),
      ['{label: <div>a\u00a0b <Link href="/y">x</Link></div>}'],
    ],
    [
      todo('{ label: (<div>wow!<Link href="/x">a</Link></div>) }'),
      ['{label: <div>wow!<Link href="/x">a</Link></div>}'],
    ],
    // JSX text reads its entities; a string child keeps them as written.
    [
      todo('{ label: (<div>A &amp; B <Link href="/x">C &lt; D</Link></div>), checked: true }'),
      ['{label: <div>A & B <Link href="/x">C < D</Link></div>, checked: true}'],
    ],
    [
      todo('{ label: (<div>{"&amp;"} <Link href="/x">y</Link></div>) }'),
      ['{label: <div>&amp; <Link href="/x">y</Link></div>}'],
    ],
    // Either quote, with the escapes JS reads.
    [
      todo(
        String.raw`{ label: 'C:\\tmp' }, { label: "it\'s" }, { label: 'tab\there \x41\u0042\u{43} \"q\"' }`,
      ),
      ['{label: C:\\tmp}', "{label: it's}", '{label: tab\there ABC "q"}'],
    ],
  ];
  for (const [mdx, items] of cases) {
    assert.equal(await shown(mdx), shownList(items).replace(' readonly=true', ''), mdx);
    for (const saved of threeSaves(mdx)) assert.equal(await shown(saved), shownList(items), saved);
  }
});

test('a `!` before a link in a todo label loads as text and a link, not an image', () => {
  const doc = load('<TodoList items={[{ label: (<div>wow!<Link href="/x">a</Link></div>) }]} />\n');
  const json = JSON.stringify(doc);
  assert.doesNotMatch(json, /"type":"image"/);
  assert.match(json, /"text":"wow!"\}.*"href":"\/x"/);
});

test('a TodoList label this reader cannot read keeps the list as written', async () => {
  // An entity outside the short table, and a template literal.
  for (const mdx of [
    '<TodoList items={[{ label: (<div>A &copy; B <Link href="/x">C</Link></div>) }, { label: "two" }]} />\n',
    '<TodoList items={[{ label: `tick` }, { label: "two" }]} />\n',
  ]) {
    const expected = await shown(mdx);
    for (const saved of threeSaves(mdx)) {
      assert.equal(saved, mdx);
      assert.equal(await shown(saved), expected);
    }
  }
});

test('backslashes before a link: an even run leaves the link, an odd run escapes it', async () => {
  const shownLabels = [
    '<div><Link href="/x">a</Link></div>',
    '[a](/x)',
    '<div>\\<Link href="/x">a</Link></div>',
    '\\[a](/x)',
    '<div>\\\\<Link href="/x">a</Link></div>',
  ];
  for (let count = 0; count <= 4; count += 1) {
    const slashes = '\\'.repeat(count);
    const todo = `- [ ] ${slashes}[a](/x)\n`;
    for (const saved of threeSaves(todo)) {
      assert.equal(
        await shown(saved),
        `<TodoList readonly=true items=[{label: ${shownLabels[count]}}]></TodoList>`,
        `${count}: ${saved}`,
      );
    }
    const paragraph = `para ${slashes}[a](/x)\n`;
    const expected = await shown(paragraph);
    for (const saved of threeSaves(paragraph)) {
      assert.equal(await shown(saved), expected, `${count}: ${saved}`);
    }
  }
});

test('a todo label never holds an image: `!` before a link is text, `![a](b)` stays text', async () => {
  const cases = [
    ['- [ ] wow\\![a](/x)\n', '<div>wow!<Link href="/x">a</Link></div>'],
    ['- [ ] see \\!\\[a\\](/x) here\n', 'see ![a](/x) here'],
  ];
  for (const [mdx, label] of cases) {
    for (const saved of threeSaves(mdx)) {
      assert.equal(
        await shown(saved),
        `<TodoList readonly=true items=[{label: ${label}}]></TodoList>`,
        saved,
      );
    }
  }
});

test('the code box reads a brace inside a string with acorn, and still refuses broken drafts', async () => {
  const original = '<Tweet id="1" />';
  const acorn = await loadAcorn();
  const draft = '<Tweet id="1" caption={"a } b"} />';
  assert.equal(readEditedBlock(draft, original), null);
  assert.deepEqual(readEditedBlock(draft, original, acorn), {
    name: 'Tweet',
    source: draft,
    raw: draft,
  });
  for (const broken of ['<Tweet id="1"', '<Tweet id="1" />\n\n<Tweet id="2" />']) {
    assert.equal(readEditedBlock(broken, original), null, broken);
    assert.equal(readEditedBlock(broken, original, acorn), null, broken);
    // An original only acorn reads is still a component, not one kept as written.
    assert.equal(readEditedBlock(broken, draft), null, broken);
    assert.equal(readEditedBlock(broken, draft, acorn), null, broken);
  }
  // One kept as written may stay so, once acorn confirms the original isn't readable either.
  const kept = '<Badge>\nunclosed';
  assert.equal(readEditedBlock('<Badge>\nstill open', kept), null);
  assert.equal(readEditedBlock('<Badge>\nstill open', kept, acorn)?.source, '<Badge>\nstill open');
  assert.match(await shown(`${draft}\n`), /caption="a \} b"/);
});

test('links in inline JSX attributes and expressions stay text; links around them convert', async () => {
  const mdx =
    'See [a](/a) <span title="[docs](https://example.com)">docs</span> and {"[b](/b)"} then [c](/c).\n';
  const expected = await shown(mdx);
  assert.match(expected, /<span title="\[docs\]\(https:\/\/example.com\)">docs<\/span>/);
  assert.match(expected, /\[b\]\(\/b\)/);
  for (const saved of threeSaves(mdx)) {
    assert.equal(await shown(saved), expected);
    assert.match(saved, /<Link href="\/a">a<\/Link>.*<Link href="\/c">c<\/Link>/);
  }
});

test('a component or expression line inside backticks stays what the compiler reads', async () => {
  // MDX flow JSX and expressions interrupt the paragraph, so these backticks never form a code
  // span: the page shows the Tweet and 2, and every save must keep showing them.
  const cases = [
    ['before `hello\n<Tweet id="1" />\nworld` after\n', '<Tweet id="1"></Tweet>'],
    ['before `hello\n{1 + 1}\nworld` after\n', '2'],
  ];
  for (const [mdx, middle] of cases) {
    const expected = `<p>before \`hello</p>\n${middle}\n<p>world\` after</p>`;
    assert.equal(await shown(mdx), expected);
    for (const saved of threeSaves(mdx)) assert.equal(await shown(saved), expected, saved);
  }
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
