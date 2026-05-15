const todoListPattern = /<TodoList\b[\s\S]*?items=\{\[([\s\S]*?)\]\}\s*\/>/g;
const markdownChecklistPattern = /(?:^|\n)(?:- \[[ xX]\] .+(?:\n|$))+/g;

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

    if (item.endsWith(' }')) {
      return `    ${item.replace(/ }$/, ', checked: true }')}`;
    }

    return `    ${item.replace(/\n {4}}$/, ',\n      checked: true,\n    }')}`;
  });

  return `<TodoList
  readonly={true}
  items={[
${items.join(',\n')}
  ]}
/>`;
};

export const mdxTodoListsToMarkdown = (value: string) =>
  value.replace(todoListPattern, todoListToMarkdown);

export const markdownTodoListsToMdx = (value: string) =>
  value.replace(markdownChecklistPattern, match => {
    const prefix = match.startsWith('\n') ? '\n' : '';
    return `${prefix}${checklistToMdx(match.trim())}\n`;
  });
