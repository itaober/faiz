import { mergeAttributes, Node } from '@tiptap/core';

import { matchLinkCardMarkup } from './link-card.ts';
import { readMdxBlock } from './mdx-editing.ts';

/**
 * A block's markdown, given a blank line before it when it follows other content inside a
 * list item: tiptap joins those with a single newline, and its list parser then reads the
 * block back as part of the item's paragraph.
 */
export const separateInListItem = (
  markdown: string,
  context?: { parentType?: string | null; index?: number },
) => (context?.parentType === 'listItem' && (context.index ?? 0) > 0 ? `\n${markdown}` : markdown);

/** What a component chip shows: the component's name, in the shape of its tag. */
export const mdxBlockLabel = (name: string, source: string) =>
  source.endsWith('/>') ? `<${name} />` : `<${name}>…</${name}>`;

// Marks the chips this page put on the clipboard. The source is published as live JSX, so
// pasted markup from anywhere else, which can't know this value, must never set it.
const CLIPBOARD_NONCE = crypto.randomUUID();

// A card LinkCard's own node can read is left to it; marked tries the last-registered
// tokenizer first, so this is checked rather than left to extension order. Image, TodoList,
// CheckboxRoot and Link become markdown before parsing; any still here couldn't, so they
// stay verbatim too.
const readBlock = (source: string) => {
  const block = readMdxBlock(source);
  return block && !(block.name === 'LinkCard' && matchLinkCardMarkup(source)) ? block : null;
};

/**
 * An MDX component the editor can't render (ParticleImage, Tweet…), kept as its source and
 * written back unchanged. The editor extends this with the chip that edits it.
 */
export const MdxBlockBase = Node.create({
  name: 'mdxBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      name: { default: '', rendered: false },
      source: { default: '', rendered: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-mdx-block]',
        getAttrs: element => {
          const source = element.getAttribute('data-source') ?? '';
          const block =
            element.getAttribute('data-mdx-block') === CLIPBOARD_NONCE
              ? readMdxBlock(source)
              : null;
          return block?.source === source ? { name: block.name, source } : false;
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const name = String(node.attrs.name);
    const source = String(node.attrs.source);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'fz-mdx-block',
        'data-mdx-block': CLIPBOARD_NONCE,
        'data-source': source,
      }),
      mdxBlockLabel(name, source),
    ];
  },
  markdownTokenizer: {
    name: 'mdxBlock',
    level: 'block',
    // Where a paragraph may stop: the first line opening a capitalized tag; tokenize decides
    // what it is. Marked passes the paragraph minus its first character, so only positions
    // after a newline count.
    // ponytail: a multi-line code span with a line starting `<Tag` is cut there.
    start: source => {
      const match = /\n {0,3}<[A-Z]/.exec(source);
      return match ? match.index + 1 : -1;
    },
    tokenize(source) {
      const block = readBlock(source);
      return block
        ? { type: 'mdxBlock', raw: block.raw, name: block.name, source: block.source }
        : undefined;
    },
  },
  parseMarkdown(token, helpers) {
    return helpers.createNode('mdxBlock', { name: token.name, source: token.source });
  },
  renderMarkdown(node, _helpers, context) {
    return separateInListItem(String(node.attrs?.source ?? ''), context);
  },
});
