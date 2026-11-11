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
    const label = match?.[2]?.trim() ?? '';
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

// Run AFTER the checklist conversion: task-list links are already rewritten to
// <Link> by checklistToMdx, so only standalone markdown links remain to convert.
export const mdxTodoListsToMarkdown = (value: string) =>
  value
    .replace(todoListPattern, todoListToMarkdown)
    .replace(checkboxRootPattern, checkboxRootToMarkdown)
    .replace(inlineLinkPattern, inlineLinkToMarkdown);

export const markdownTodoListsToMdx = (value: string) =>
  value
    .replace(markdownChecklistPattern, match => {
      const prefix = match.startsWith('\n') ? '\n' : '';
      return `${prefix}${checklistToMdx(match.trim())}\n`;
    })
    .replace(markdownLinkPattern, (_, label, href) => `<Link href="${href}">${label}</Link>`);

/**
 * Index just past the `>` that ends the tag whose attributes start at `from`. A `>` inside a
 * quoted attribute or a `{…}` expression doesn't count.
 */
const findTagEnd = (source: string, from: number) => {
  let depth = 0;
  let quote = '';
  let quoteStart = 0;
  for (let index = from; index <= source.length; index += 1) {
    const char = source[index] ?? '\n';
    if (quote) {
      if (char === quote) quote = '';
      // Backslash escapes only exist in JS strings; a JSX attribute string has none.
      else if (char === '\\' && depth > 0) index += 1;
      // A JS '…' or "…" string can't span lines, so this quote was JSX text such as `Don't`:
      // rescan from just after it.
      else if (char === '\n' && depth > 0 && quote !== '`') {
        quote = '';
        index = quoteStart;
      }
    } else if (char === '"' || char === "'" || (char === '`' && depth > 0)) {
      quote = char;
      quoteStart = index;
    } else if (char === '{') depth += 1;
    else if (char === '}') depth -= 1;
    else if (char === '>' && depth === 0) return index + 1;
  }
  return -1;
};

/** Index just past the `</name>` that closes the element whose opening tag ends at `from`. */
const findClosingTag = (source: string, name: string, from: number) => {
  // ponytail: same-name tags inside a code span in the children still count toward depth.
  const tag = /<(\/?)([A-Z][\w.]*)/g;
  const closeEnd = /\s*>/y;
  let depth = 1;
  tag.lastIndex = from;
  for (let match = tag.exec(source); match; match = tag.exec(source)) {
    if (match[2] !== name) continue;
    const after = match.index + match[0].length;
    if (match[1]) {
      closeEnd.lastIndex = after;
      if (!closeEnd.test(source)) continue;
      depth -= 1;
      if (depth === 0) return closeEnd.lastIndex;
    } else if (/[\s/>]/.test(source[after] ?? '')) {
      const end = findTagEnd(source, after);
      if (end < 0) return -1;
      if (source[end - 2] !== '/') depth += 1;
      tag.lastIndex = end;
    }
  }
  return -1;
};

/**
 * A block-level JSX element at the very start of `source`: a capitalized tag, self-closing
 * or paired, with nothing after it on its last line. `source` is the element itself; `raw`
 * also covers the rest of that line, for the markdown tokenizer to consume.
 */
export const scanMdxBlock = (source: string) => {
  const name = source.match(/^<([A-Z][\w.]*)(?=[\s/>])/)?.[1];
  if (!name) return null;
  let end = findTagEnd(source, name.length + 1);
  if (end > 0 && source[end - 2] !== '/') end = findClosingTag(source, name, end);
  if (end < 0) return null;
  const lineEnd = /[ \t]*(?:\r?\n|$)/y;
  lineEnd.lastIndex = end;
  if (!lineEnd.test(source)) return null;
  return { name, source: source.slice(0, end), raw: source.slice(0, lineEnd.lastIndex) };
};
