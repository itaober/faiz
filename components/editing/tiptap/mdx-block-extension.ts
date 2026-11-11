import { mergeAttributes, Node } from '@tiptap/core';

import { matchLinkCardMarkup } from '@/lib/link-card';
import { scanMdxBlock } from '@/lib/mdx-editing';

// A card LinkCard's own node can read is left to it; marked tries the last-registered
// tokenizer first, so this is checked rather than left to extension order. Image, TodoList,
// CheckboxRoot and Link become markdown before parsing; any still here couldn't, so they
// stay verbatim too.
const scan = (source: string) => {
  const block = scanMdxBlock(source);
  return block && !(block.name === 'LinkCard' && matchLinkCardMarkup(source)) ? block : null;
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
  // No parseHTML: the source is published as live JSX, so only the markdown tokenizer may
  // set it, never pasted HTML. Dragging within the editor moves the node itself.
  addAttributes() {
    return {
      name: { default: '', rendered: false },
      source: { default: '', rendered: false },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const { name, source } = node.attrs;
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'fz-mdx-block', title: 'Edit in Markdown' }),
      String(source).endsWith('/>') ? `<${name} />` : `<${name}>…</${name}>`,
    ];
  },
  markdownTokenizer: {
    name: 'mdxBlock',
    level: 'block',
    // Where a paragraph may stop: the first line opening a capitalized tag; tokenize decides
    // whether it is a block. Marked passes the paragraph minus its first character, so only
    // positions after a newline count.
    // ponytail: a multi-line code span with a line starting `<Tag` is cut there.
    start: source => {
      const match = /\n<[A-Z]/.exec(source);
      return match ? match.index + 1 : -1;
    },
    tokenize(source) {
      const block = scan(source);
      return block
        ? { type: 'mdxBlock', raw: block.raw, name: block.name, source: block.source }
        : undefined;
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode('mdxBlock', { name: token.name, source: token.source });
  },
  renderMarkdown(node) {
    return String(node.attrs?.source ?? '');
  },
});
