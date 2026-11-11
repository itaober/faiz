import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression';
import { mdxJsxFromMarkdown } from 'mdast-util-mdx-jsx';
import { mdxExpression } from 'micromark-extension-mdx-expression';
import { mdxJsx } from 'micromark-extension-mdx-jsx';

const todoListPattern = /<TodoList\b[\s\S]*?items=\{\[([\s\S]*?)\]\}\s*\/>/g;
// Standalone <CheckboxRoot>…<CheckboxLabel>…</CheckboxLabel>…</CheckboxRoot>, with
// any leading indent (so a checkbox nested under a bullet lifts to a top-level item).
const checkboxRootPattern = /[^\S\n]*<CheckboxRoot\b[\s\S]*?<\/CheckboxRoot>/g;
const markdownChecklistPattern = /(?:^|\n)(?:- \[[ xX]\] .+(?:\n|$))+/g;
// Inline <Link href="…">label</Link> ↔ markdown links, so links survive a round
// trip through the markdown editor. The read view maps <Link> to next/link; a bare
// markdown link has no `a:` override and would degrade to a full-reload <a>.
const inlineLinkPattern = /<Link\s+href=(["'])(.*?)\1\s*>([\s\S]*?)<\/Link>/g;
// A markdown link, its `!` captured: a `[` after an odd run of backslashes is escaped text, and
// so is a `!` after one. With the `!` it is an image, which the server turns into <Image>.
const markdownLinkPattern = /(?<=(?:^|[^\\])(?:\\\\)*)(!?)\[((?:\\.|[^\\\]])+)\]\(([^)\s]+)\)/g;

/** Markdown backslash escapes (`\\*`, `\\{`, …) as the characters they stand for. */
export const unescapeMarkdown = (value: string) => value.replace(/\\([!-/:-@[-`{-~])/g, '$1');

const SINGLE_ESCAPES: Record<string, string> = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

/**
 * A JS string literal's value (either quote), as the compiler reads it; null for one it
 * rejects (a raw line break, a legacy octal escape), so the caller keeps the source instead.
 */
const readString = (literal: string) => {
  let valid = true;
  const value = literal
    .slice(1, -1)
    .replace(
      /\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|(0)(?!\d)|(\r\n|[\s\S]))|[\n\r]/g,
      (match, point?: string, unit?: string, byte?: string, zero?: string, char?: string) => {
        const code = Number.parseInt(point ?? unit ?? byte ?? '', 16);
        if (code <= 0x10ffff) return String.fromCodePoint(code);
        if (zero) return '\0';
        if (char !== undefined && !/^[\dux]$/.test(char)) {
          return /^(?:\r\n|[\n\r\u2028\u2029])$/.test(char) ? '' : (SINGLE_ESCAPES[char] ?? char);
        }
        valid = false;
        return match;
      },
    );
  return valid ? value : null;
};

const JSX_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00a0',
  quot: '"',
};

/**
 * JSX text's character references read as acorn-jsx reads them; null for a name outside this
 * short table, so the caller keeps the source rather than guess at the long one.
 */
const readJsxText = (text: string) => {
  let valid = true;
  const value = text.replace(
    /&(?:#x([\da-fA-F]{1,7})|#(\d{1,8})|([\da-zA-Z]{1,9}));/g,
    (match, hex?: string, decimal?: string, name?: string) => {
      if (hex ?? decimal)
        return String.fromCharCode(Number.parseInt(hex ?? decimal ?? '', hex ? 16 : 10));
      if (name && name in JSX_ENTITIES) return JSX_ENTITIES[name];
      valid = false;
      return match;
    },
  );
  return valid ? value : null;
};

// Plain text as the editor's markdown, and back: the editor escapes these characters and writes
// `<`, `>` and `&` as entities, so a label reads back as the text it is, not as markup.
const textToMarkdown = (text: string) => text.replace(/[\\`*_[\]~{}<&]/g, '\\$&');
const markdownToText = (markdown: string) =>
  markdown.replace(
    /\\([!-/:-@[-`{-~])|&(lt|gt|amp);/g,
    (_, char: string | undefined, entity: 'lt' | 'gt' | 'amp') =>
      char ?? { lt: '<', gt: '>', amp: '&' }[entity],
  );

const escapeChar = (char: string) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;

// A string literal; a `[` after `!` is escaped, or the read view would turn `![a](b)` in a
// label into an <Image> tag inside the string.
const jsString = (text: string) => JSON.stringify(text).replace(/(?<=!)\[/g, escapeChar);

// Text as JSX children: plain text as is, so stored labels keep their form; text JSX would
// read as a tag, an expression or an entity as a string, so it stays literal, and so does text
// with a quote, which the todo list reader would take for the start of a string. Its braces are
// escaped too: the editor's parser matches `{…}` by braces (no acorn).
const jsxText = (text: string) =>
  /[{}<>&'"`]|!\[/.test(text) ? `{${jsString(text).replace(/[{}]/g, escapeChar)}}` : text;

const splitTopLevelObjects = (value: string) => {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(value.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
};

/**
 * A JSX label as the editor's markdown: string children as written, text with its entities
 * read, links as markdown links. Null for JSX this doesn't read (another expression, an
 * unknown entity), so the list is kept as written.
 */
const jsxToMarkdown = (value: string) => {
  let href = '';
  let valid = true;
  const markdown = value.replace(
    /\{("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')\}|<Link\s+href=(["'])(.*?)\2\s*>|<\/Link\s*>|<[^>]+>|[^{<]+|[{<]/g,
    (token, literal: string | undefined, _quote, linkHref: string | undefined) => {
      if (linkHref !== undefined) {
        href = linkHref;
        return '[';
      }
      if (token.startsWith('</Link')) return `](${href})`;
      if (!literal && token.startsWith('<') && token.length > 1) return '';
      const text =
        literal !== undefined
          ? readString(literal)
          : /^[{<]$/.test(token)
            ? null
            : readJsxText(token.replace(/\s+/g, ' '));
      if (text === null) valid = false;
      return textToMarkdown(text ?? '');
    },
  );
  return valid ? markdown.trim() : null;
};

/**
 * A todo item from its markdown label: a string, or with links a JSX label whose text stays
 * literal. The label is plain text, so the editor's escapes and entities are read as such.
 */
const todoItemToMdx = (markdown: string) => {
  const parts: string[] = [];
  let last = 0;
  // A label has no images: a `!` before a link is text, as on main.
  for (const link of markdown.matchAll(markdownLinkPattern)) {
    const [match, bang, label, href] = link;
    parts.push(
      jsxText(markdownToText(markdown.slice(last, link.index) + bang)),
      `<Link href="${href}">${jsxText(markdownToText(label))}</Link>`,
    );
    last = link.index + match.length;
  }

  if (!parts.length) {
    return `{ label: ${jsString(markdownToText(markdown))} }`;
  }

  return `{
      label: (
        <div>
          ${parts.join('')}${jsxText(markdownToText(markdown.slice(last)))}
        </div>
      ),
    }`;
};

const parseTodoItem = (value: string) => {
  const checked = /checked\s*:\s*true/.test(value);
  const quotedLabel = value.match(/label\s*:\s*("(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')/);

  // An unreadable label reads as empty, so the list is kept as written (todoListToMarkdown).
  if (quotedLabel) {
    return { checked, label: textToMarkdown(readString(quotedLabel[1])?.trim() ?? '') };
  }

  const jsxLabel = value.match(/label\s*:\s*\(([\s\S]*?)\)\s*,?\s*(?:checked\b|\}$)/);
  return { checked, label: jsxToMarkdown(jsxLabel?.[1] ?? '') ?? '' };
};

const todoListToMarkdown = (source: string, itemsSource: string) => {
  const items = splitTopLevelObjects(itemsSource)
    .map(parseTodoItem)
    .filter(item => item.label);

  // A list read short (a quote in raw JSX text taken for a string, say) stays as written, so the
  // editor keeps it as a component: as markdown, the items it missed would be gone on save.
  if (items.length < (itemsSource.match(/\blabel\s*:/g) ?? []).length) {
    return source;
  }

  if (!items.length) {
    return '';
  }

  return items.map(item => `- [${item.checked ? 'x' : ' '}] ${item.label}`).join('\n');
};

const checklistToMdx = (source: string) => {
  const lines = source
    .trim()
    .split('\n')
    .map(line => line.match(/^- \[([ xX])\] (.+)$/))
    .filter(Boolean);

  if (!lines.length) {
    return source;
  }

  const items = lines.map(match => {
    const checked = match?.[1]?.toLowerCase() === 'x';
    const item = todoItemToMdx(match?.[2]?.trim() ?? '');

    if (!checked) {
      return `    ${item}`;
    }

    if (!item.includes('\n')) {
      return `    ${item.replace(/ }$/, ', checked: true }')}`;
    }

    return `    ${item.replace(/\n {4}}$/, '\n      checked: true,\n    }')}`;
  });

  return `<TodoList
  readonly={true}
  items={[
${items.join(',\n')}
  ]}
/>`;
};

const checkboxRootToMarkdown = (source: string) => {
  const openTag = source.slice(0, source.indexOf('>') + 1);
  const checked = /\b(?:default)?[Cc]hecked\b(?!\s*=\s*\{?\s*false)/.test(openTag);
  const labelMatch = source.match(/<CheckboxLabel[^>]*>([\s\S]*?)<\/CheckboxLabel>/);
  const label = labelMatch ? jsxToMarkdown(labelMatch[1]) : '';
  return label ? `- [${checked ? 'x' : ' '}] ${label}` : source;
};

const inlineLinkToMarkdown = (_source: string, _quote: string, href: string, label: string) => {
  const text = label.replace(/<[^>]+>/g, '').trim();
  return text ? `[${text}](${href})` : '';
};

const todoListsToMarkdown = (value: string) =>
  value
    .replace(todoListPattern, todoListToMarkdown)
    .replace(checkboxRootPattern, checkboxRootToMarkdown);

/** Todo lists and links as markdown, for the feed and the search index. */
export const mdxTodoListsToMarkdown = (value: string) =>
  todoListsToMarkdown(value).replace(inlineLinkPattern, inlineLinkToMarkdown);

// A code span: a run of backticks up to the next run of the same length, within a paragraph.
const inlineCodePattern = /(`+)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g;

/** `text` with each `pattern` match passed to `found` and the text between to `between`. */
const mapMatches = (
  text: string,
  pattern: RegExp,
  found: (match: RegExpExecArray) => string,
  between: (text: string) => string,
) => {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    result += between(text.slice(last, match.index)) + found(match);
    last = match.index + match[0].length;
  }
  return result + between(text.slice(last));
};

const replaceOutsideInlineCode = (
  text: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
) =>
  mapMatches(
    text,
    inlineCodePattern,
    code => code[0],
    plain => plain.replace(pattern, replacer),
  );

/**
 * Stored MDX as the editor loads it: todo lists and links become markdown. A todo list writes
 * its own links, so one kept as written keeps its <Link>s.
 */
export const mdxToEditorMarkdown = (value: string) =>
  transformOutsideMdxBlocks(
    value,
    segment =>
      mapMatches(
        segment,
        todoListPattern,
        ([source, items]) => todoListToMarkdown(source, items),
        text =>
          replaceOutsideInlineCode(
            text.replace(checkboxRootPattern, checkboxRootToMarkdown),
            inlineLinkPattern,
            inlineLinkToMarkdown,
          ),
      ),
    'inline',
  );

/**
 * The editor's markdown as it is saved: the inverse of {@link mdxToEditorMarkdown}. Links go
 * after the todo lists, which write their own, and skip every component: a TodoList's labels
 * and an inline element's attributes aren't markdown. Todo lists skip only blocks, so a task
 * holding inline JSX stays one item.
 */
export const markdownTodoListsToMdx = (value: string) =>
  transformOutsideMdxBlocks(
    transformOutsideMdxBlocks(value, segment =>
      segment.replace(markdownChecklistPattern, match => {
        const prefix = match.startsWith('\n') ? '\n' : '';
        return `${prefix}${checklistToMdx(match.trim())}\n`;
      }),
    ),
    segment =>
      replaceOutsideInlineCode(segment, markdownLinkPattern, (match, bang, label, href) =>
        bang ? match : `<Link href="${href}">${label}</Link>`,
      ),
    'all',
  );

/**
 * Parses MDX as the site's compiler reads it, minus evaluating expressions (no acorn, which
 * would add about 40KB gzip to the editor): `{…}` is matched by braces, unless `acorn` (from
 * {@link loadAcorn}) is given. Throws on invalid MDX, with the failing line on the error.
 */
export const parseMdx = (source: string, acorn?: Acorn) =>
  fromMarkdown(source, {
    extensions: [mdxJsx({ acorn, addResult: false }), mdxExpression({ acorn, addResult: false })],
    mdastExtensions: [mdxJsxFromMarkdown(), mdxExpressionFromMarkdown()],
  });

export type Acorn = NonNullable<Parameters<typeof mdxExpression>[0]>['acorn'];

/** acorn with JSX, as the site's compiler reads expressions; loaded only when asked for. */
export const loadAcorn = async (): Promise<Acorn> => {
  const [{ Parser }, { default: jsx }] = await Promise.all([import('acorn'), import('acorn-jsx')]);
  return Parser.extend(jsx());
};

type MdxNode = ReturnType<typeof parseMdx>['children'][number];

/**
 * The 1-based line a parse error points at, if it says: micromark puts it on the error, the
 * JSX tree builder only in its message, as `(line:column-line:column)`.
 */
export const mdxErrorLine = (error: unknown) => {
  const { line, place, message } = (error ?? {}) as {
    line?: unknown;
    place?: { line?: unknown; start?: { line?: unknown } };
    message?: unknown;
  };
  const found =
    [line, place?.line, place?.start?.line].find(value => typeof value === 'number') ??
    Number(String(message ?? '').match(/\((\d+):\d+(?:-\d+:\d+)?\)/)?.[1]);
  return typeof found === 'number' && found > 0 ? found : undefined;
};

/**
 * Parses as much of `source` as is valid MDX from the top: on an error, retries without the
 * failing line and everything after it, so a mistake further down doesn't hide a valid block
 * above it. Null when the first line itself is the problem.
 */
// ponytail: parses the rest of the document for every block that opens with `<` or `{`, about
// 300ms to load a 41KB page. Parse once per load and look blocks up by offset if that matters.
const parseLeading = (source: string, acorn?: Acorn) => {
  let end = source.length;
  for (;;) {
    try {
      return parseMdx(source.slice(0, end), acorn);
    } catch (error) {
      const line = mdxErrorLine(error);
      if (!line || line <= 1) return null;
      let next = 0;
      for (let count = 1; count < line && next >= 0; count += 1)
        next = source.indexOf('\n', next) + 1;
      if (next <= 0 || next >= end) return null;
      end = next;
    }
  }
};

export type MdxBlock = { name: string; source: string; raw: string };

const blockFrom = (source: string, name: string, start: number, end: number): MdxBlock | null => {
  const lineEnd = /[ \t]*(?:\n|$)/y;
  lineEnd.lastIndex = end;
  if (!lineEnd.test(source)) return null;
  return { name, source: source.slice(start, end), raw: source.slice(0, lineEnd.lastIndex) };
};

/**
 * A line opening a tag or expression the parser rejects, up to the next blank line (as
 * CommonMark reads an HTML block), so it is kept as written rather than escaped.
 */
const unreadableBlock = (source: string, start: number): MdxBlock | null => {
  const blankLine = /\n[ \t]*(?:\n|$)/.exec(source);
  const end = blankLine ? blankLine.index : source.length;
  const name = source.slice(start).match(/^<([\w.:-]+)/)?.[1] ?? '';
  return {
    name,
    source: source.slice(start, end),
    raw: source.slice(0, blankLine ? end + 1 : end),
  };
};

const nameOf = (node: MdxNode) =>
  'name' in node && typeof node.name === 'string' ? node.name : '';

/** The first inline JSX element or `{…}` expression in `node`, at any depth. */
const inlineMdxIn = (node: MdxNode): MdxNode | undefined => {
  if (node.type === 'mdxJsxTextElement' || node.type === 'mdxTextExpression') return node;
  for (const child of ('children' in node ? node.children : []) as MdxNode[]) {
    const found = inlineMdxIn(child);
    if (found) return found;
  }
  return undefined;
};

/**
 * The block at the start of `source`, indented at most three spaces: a JSX element or `{…}`
 * expression on its own lines; a paragraph, heading or ordered list holding one anywhere,
 * kept whole, since the editor would otherwise read the element as text and escape it (tiptap
 * reads ordered list items inline, past this tokenizer); or, for a line opening one that the
 * parser rejects, the lines up to the next blank one. `source` is the block
 * itself; `raw` also covers the indent and the rest of its last line, for the markdown
 * tokenizer to consume.
 */
export const readMdxBlock = (source: string, acorn?: Acorn): MdxBlock | null => {
  const start = source.match(/^ {0,3}/)?.[0].length ?? 0;
  const opensWithMdx = /^(?:<[A-Za-z]|\{)/.test(source.slice(start));
  let tree: ReturnType<typeof parseMdx> | null;
  if (opensWithMdx) {
    tree = parseLeading(source, acorn);
  } else {
    // Text holding JSX or an expression. A paragraph or heading never spans a blank line; a
    // loose ordered list does, while the line after it is indented or opens another item.
    const blankLine = source.search(
      /^ {0,3}\d{1,9}[.)](?:[ \t\n]|$)/.test(source)
        ? /\n(?:[ \t]*\n)+(?![ \t\n]|\d{1,9}[.)])/
        : /\n[ \t]*\n/,
    );
    const text = blankLine < 0 ? source : source.slice(0, blankLine);
    if (!/<[A-Za-z]|\{/.test(text)) return null;
    try {
      tree = parseMdx(text, acorn);
    } catch {
      return null;
    }
  }
  const fallback = opensWithMdx ? unreadableBlock(source, start) : null;
  const node = tree?.children[0];
  if (node?.position?.start.offset !== start || node.position.end.offset === undefined) {
    return fallback;
  }
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxFlowExpression') {
    return blockFrom(source, nameOf(node), start, node.position.end.offset);
  }
  const inline =
    node.type === 'paragraph' || node.type === 'heading' || (node.type === 'list' && node.ordered)
      ? inlineMdxIn(node)
      : null;
  return inline ? blockFrom(source, nameOf(inline), start, node.position.end.offset) : fallback;
};

/** Whether `source` is exactly one JSX element or expression the parser reads. */
export const isReadableMdxBlock = (source: string, acorn?: Acorn) => {
  try {
    const { children } = parseMdx(source, acorn);
    const [node] = children;
    return (
      children.length === 1 &&
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxFlowExpression') &&
      node.position?.start.offset === 0 &&
      node.position.end.offset === source.length
    );
  } catch {
    return false;
  }
};

/**
 * The block an edited source stands for, or null: still exactly one block, and one the parser
 * reads if the original was. Read by braces unless `acorn` is given; the editor retries with it
 * when that fails, since only acorn reads a brace inside a string (`caption={"a } b"}`).
 */
export const readEditedBlock = (draft: string, original: string, acorn?: Acorn) => {
  const block = readMdxBlock(draft, acorn);
  const readable = !isReadableMdxBlock(original) || isReadableMdxBlock(draft, acorn);
  return block?.source === draft && readable ? block : null;
};

// Components the transforms above turn into markdown on load and back on save.
const CONVERTED_COMPONENTS = new Set(['TodoList', 'CheckboxRoot', 'Image', 'ImageGallery', 'Link']);

/**
 * What a rewrite leaves as written: `blocks`, component blocks, expressions and code; `inline`
 * also inline JSX and expressions, whose attributes and strings aren't markdown; `all` also
 * the components the rewrites convert, for a rewrite that runs after them.
 */
type Kept = 'blocks' | 'inline' | 'all';

/**
 * Offsets of what `kept` keeps in `tree`, at any depth. A component the transforms convert is
 * left to them whole, children included, except a TodoList inside a list: as markdown only its
 * first item would keep the item's indent, so it stays as written.
 */
const keptRanges = (
  node: { type: string; children?: unknown[] },
  ranges: [number, number][],
  kept: Kept,
  inList = false,
) => {
  for (const child of (node.children ?? []) as MdxNode[]) {
    const { start, end } = child.position ?? {};
    const name = nameOf(child);
    const inline = kept !== 'blocks';
    const jsx =
      child.type === 'mdxJsxFlowElement' || (inline && child.type === 'mdxJsxTextElement');
    const converted =
      kept !== 'all' && CONVERTED_COMPONENTS.has(name) && !(inList && name === 'TodoList');
    if (jsx && converted) continue;
    const keep =
      jsx ||
      child.type === 'code' ||
      child.type === 'mdxFlowExpression' ||
      (inline && child.type === 'mdxTextExpression');
    if (keep && start?.offset !== undefined && end?.offset !== undefined) {
      ranges.push([start.offset, end.offset]);
    } else if ('children' in child) {
      keptRanges(child, ranges, kept, inList || child.type === 'listItem');
    }
  }
  return ranges;
};

/**
 * Applies `transform` outside what `kept` keeps (component blocks, expressions and code by
 * default), wherever they sit (lists and quotes included): the editor keeps those as written,
 * so page-level rewrites (links, todo lists, images) must not reach into them. A document that
 * isn't valid MDX is transformed whole; saving it is refused anyway.
 */
export const transformOutsideMdxBlocks = (
  value: string,
  transform: (segment: string) => string,
  kept: Kept = 'blocks',
) => {
  let ranges: [number, number][];
  try {
    ranges = keptRanges(parseMdx(value), [], kept);
  } catch {
    return transform(value);
  }
  let result = '';
  let last = 0;
  for (const [start, end] of ranges) {
    result += transform(value.slice(last, start)) + value.slice(start, end);
    last = end;
  }
  return result + transform(value.slice(last));
};
