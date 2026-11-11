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
// Skip image markdown (![]()): saved content still carries ![](…) until the server
// normalises it to <Image>.
const markdownLinkPattern = /(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Markdown backslash escapes (`\\*`, `\\{`, …) as the characters they stand for. */
export const unescapeMarkdown = (value: string) => value.replace(/\\([!-/:-@[-`{-~])/g, '$1');

const escapeJsonString = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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

const jsxToMarkdown = (value: string) =>
  value
    .replace(/<Link\s+href=(["'])(.*?)\1\s*>([\s\S]*?)<\/Link>/g, (_, _quote, href, label) => {
      return `[${label.replace(/<[^>]+>/g, '').trim()}](${href})`;
    })
    .replace(/<\/?div>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const markdownLinkToMdx = (value: string) => {
  const match = value.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*?)$/);

  if (!match) {
    return `{ label: "${escapeJsonString(value)}" }`;
  }

  const [, before, label, href, after] = match;
  return `{
      label: (
        <div>
          ${escapeJsonString(before)}<Link href="${escapeJsonString(href)}">${escapeJsonString(label)}</Link>${escapeJsonString(after)}
        </div>
      ),
    }`;
};

const parseTodoItem = (value: string) => {
  const checked = /checked\s*:\s*true/.test(value);
  const quotedLabel = value.match(/label\s*:\s*(["'])([\s\S]*?)\1/);

  if (quotedLabel) {
    return { checked, label: quotedLabel[2].trim() };
  }

  const jsxLabel = value.match(/label\s*:\s*\(([\s\S]*?)\)\s*,?\s*(?:checked|$)/);
  return { checked, label: jsxToMarkdown(jsxLabel?.[1] ?? '') };
};

const todoListToMarkdown = (_source: string, itemsSource: string) => {
  const items = splitTopLevelObjects(itemsSource)
    .map(parseTodoItem)
    .filter(item => item.label);

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
    // The editor escapes markdown in text; a label is a plain string, so it keeps the characters.
    const label = unescapeMarkdown(match?.[2]?.trim() ?? '');
    const item = markdownLinkToMdx(label);

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

const replaceOutsideInlineCode = (
  text: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
) => {
  let result = '';
  let last = 0;
  for (const match of text.matchAll(inlineCodePattern)) {
    result += text.slice(last, match.index).replace(pattern, replacer) + match[0];
    last = match.index + match[0].length;
  }
  return result + text.slice(last).replace(pattern, replacer);
};

/** Stored MDX as the editor loads it: todo lists and links become markdown. */
export const mdxToEditorMarkdown = (value: string) =>
  transformOutsideMdxBlocks(value, segment =>
    replaceOutsideInlineCode(todoListsToMarkdown(segment), inlineLinkPattern, inlineLinkToMarkdown),
  );

// Links go AFTER the checklist conversion: task-list links are already rewritten to
// <Link> by checklistToMdx, so only standalone markdown links remain to convert.
/** The editor's markdown as it is saved: the inverse of {@link mdxToEditorMarkdown}. */
export const markdownTodoListsToMdx = (value: string) =>
  transformOutsideMdxBlocks(value, segment =>
    replaceOutsideInlineCode(
      segment.replace(markdownChecklistPattern, match => {
        const prefix = match.startsWith('\n') ? '\n' : '';
        return `${prefix}${checklistToMdx(match.trim())}\n`;
      }),
      markdownLinkPattern,
      (_, label, href) => `<Link href="${href}">${label}</Link>`,
    ),
  );

/**
 * Parses MDX as the site's compiler reads it, minus evaluating expressions (no acorn, which
 * would add about 40KB gzip to the editor): `{…}` is matched by braces. Throws on invalid MDX,
 * with the failing line on the error.
 */
export const parseMdx = (source: string) =>
  fromMarkdown(source, {
    extensions: [mdxJsx(), mdxExpression()],
    mdastExtensions: [mdxJsxFromMarkdown(), mdxExpressionFromMarkdown()],
  });

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
const parseLeading = (source: string) => {
  let end = source.length;
  for (;;) {
    try {
      return parseMdx(source.slice(0, end));
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
export const readMdxBlock = (source: string): MdxBlock | null => {
  const start = source.match(/^ {0,3}/)?.[0].length ?? 0;
  const opensWithMdx = /^(?:<[A-Za-z]|\{)/.test(source.slice(start));
  let tree: ReturnType<typeof parseMdx> | null;
  if (opensWithMdx) {
    tree = parseLeading(source);
  } else {
    // Text holding JSX or an expression: a paragraph or heading never spans a blank line.
    const blankLine = source.search(/\n[ \t]*\n/);
    const text = blankLine < 0 ? source : source.slice(0, blankLine);
    if (!/<[A-Za-z]|\{/.test(text)) return null;
    try {
      tree = parseMdx(text);
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
export const isReadableMdxBlock = (source: string) => {
  try {
    const { children } = parseMdx(source);
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

// Components the transforms above turn into markdown on load and back on save.
const CONVERTED_COMPONENTS = new Set(['TodoList', 'CheckboxRoot', 'Image', 'ImageGallery', 'Link']);

/**
 * Offsets of the component blocks, expressions and code in `tree`, at any depth. A component
 * the transforms convert is left to them whole, children included, except a TodoList inside a
 * list: as markdown only its first item would keep the item's indent, so it stays as written.
 */
const keptRanges = (
  node: { type: string; children?: unknown[] },
  ranges: [number, number][],
  inList = false,
) => {
  for (const child of (node.children ?? []) as MdxNode[]) {
    const { start, end } = child.position ?? {};
    const name = nameOf(child);
    const converted = CONVERTED_COMPONENTS.has(name) && !(inList && name === 'TodoList');
    if (child.type === 'mdxJsxFlowElement' && converted) continue;
    const kept =
      child.type === 'code' ||
      child.type === 'mdxFlowExpression' ||
      child.type === 'mdxJsxFlowElement';
    if (kept && start?.offset !== undefined && end?.offset !== undefined) {
      ranges.push([start.offset, end.offset]);
    } else if ('children' in child) {
      keptRanges(child, ranges, inList || child.type === 'listItem');
    }
  }
  return ranges;
};

/**
 * Applies `transform` outside component blocks, expressions and code, wherever they sit
 * (lists and quotes included): the editor keeps those as written, so page-level rewrites
 * (links, todo lists, images) must not reach into them. A document that isn't valid MDX is
 * transformed whole; saving it is refused anyway.
 */
export const transformOutsideMdxBlocks = (
  value: string,
  transform: (segment: string) => string,
) => {
  let ranges: [number, number][];
  try {
    ranges = keptRanges(parseMdx(value), []);
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
