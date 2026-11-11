import { mergeAttributes, Node } from '@tiptap/core';

import { scanMdxBlock } from '@/lib/mdx-editing';

// LinkCard has its own node. Marked tries the last-registered tokenizer first, so it is
// skipped by name rather than by extension order. Image, TodoList, CheckboxRoot and Link
// become markdown before parsing; any still here couldn't, so they stay verbatim too.
const scan = (source: string) => {
  const block = scanMdxBlock(source);
  return block && block.name !== 'LinkCard' ? block : null;
};

/**
 * An MDX component the editor can't render (ParticleImage, Tweet…), kept as its source:
 * a placeholder in the editor, written back unchanged, edited in Markdown mode.
 */
export const MdxBlock = Node.create({
  name: 'mdxBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: element => element.getAttribute('data-source') ?? '',
        renderHTML: attrs => ({ 'data-source': attrs.source }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-mdx-block]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const source = String(node.attrs.source);
    const name = source.match(/^<([\w.]+)/)?.[1] ?? 'MDX';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-mdx-block': '',
        class: 'fz-mdx-block',
        title: 'Edit in Markdown',
      }),
      source.endsWith('/>') ? `<${name} />` : `<${name}>…</${name}>`,
    ];
  },
  markdownTokenizer: {
    name: 'mdxBlock',
    level: 'block',
    // Where a paragraph should stop: a line that opens a component. Marked passes the
    // paragraph minus its first character, so only positions after a newline count.
    start: source => {
      for (const match of source.matchAll(/\n(?=<[A-Z])/g)) {
        if (scan(source.slice(match.index + 1))) return match.index + 1;
      }
      return -1;
    },
    tokenize(source) {
      const block = scan(source);
      return block ? { type: 'mdxBlock', raw: block.raw, source: block.source } : undefined;
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode('mdxBlock', { source: token.source });
  },
  renderMarkdown(node) {
    return String(node.attrs?.source ?? '');
  },
});
