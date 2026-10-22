import { getMarkRange, mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, type Selection, TextSelection } from '@tiptap/pm/state';
import { type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useState } from 'react';

import LinkCard from '@/components/link-card';
import useLinkCard from '@/hooks/use-link-card';
import { formatLinkCard, getLinkCardTarget, parseLinkCardMarkup } from '@/lib/link-card';
import { cn } from '@/lib/utils';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    linkCard: {
      /**
       * Insert a card for a supported URL: in place of an empty block, else after
       * the current one. The caret lands after the card unless `select` is set.
       */
      insertLinkCard: (href: string, options?: { select?: boolean }) => ReturnType;
      /** Replace the selected card with its link as text, labelled `label`, and select that text. */
      unwrapLinkCard: (label: string) => ReturnType;
      /** Relabel the link at the cursor and keep it selected. */
      relabelLink: (href: string, label: string) => ReturnType;
    };
  }
}

export const isLinkCardSelection = (selection: Selection): selection is NodeSelection =>
  selection instanceof NodeSelection && selection.node.type.name === 'linkCard';

function LinkCardNodeView({ node, editor, selected }: NodeViewProps) {
  const [isEditable, setIsEditable] = useState(editor.isEditable);
  useEffect(() => {
    const sync = () => setIsEditable(editor.isEditable);
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);
  const href = String(node.attrs.href || '');
  const { data, loading, valid } = useLinkCard(href, node.attrs.cardType || undefined);
  return (
    <NodeViewWrapper
      contentEditable={false}
      data-editor-link-card=""
      // The renderer wrapper spans the column, so the selection ring lives here on the card's box.
      className={cn(
        'relative max-w-80 rounded-xl',
        isEditable && selected && 'ring-accent ring-offset-background ring-2 ring-offset-2',
      )}
    >
      {data && valid ? (
        <LinkCard data={data} loading={loading} preview={isEditable} />
      ) : (
        <div className="border-border text-muted-foreground my-3 rounded-lg border p-3 text-sm">
          {href || 'Link card'}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const EditorLinkCard = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      href: {
        default: '',
        parseHTML: element => element.getAttribute('data-href'),
        renderHTML: attrs => ({ 'data-href': attrs.href }),
      },
      cardType: {
        default: null,
        parseHTML: element => element.getAttribute('data-card-type'),
        renderHTML: attrs => ({ 'data-card-type': attrs.cardType }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-link-card-node]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-link-card-node': '' })];
  },
  addCommands() {
    return {
      insertLinkCard:
        (href, options) =>
        ({ state, tr, dispatch }) => {
          const target = getLinkCardTarget(href);
          if (!target) return false;
          if (dispatch) {
            const card = this.type.create({ href: target.url, cardType: target.type });
            const { $from } = state.selection;
            const emptyBlock =
              $from.depth > 0 && $from.parent.isTextblock && !$from.parent.content.size;
            const from = emptyBlock ? $from.before() : $from.depth > 0 ? $from.after() : $from.pos;
            tr.replaceWith(from, emptyBlock ? $from.after() : from, card);
            const after = from + card.nodeSize;
            // A trailing card still needs a paragraph after it for the caret.
            if (after >= tr.doc.content.size) {
              tr.insert(after, state.schema.nodes.paragraph.create());
            }
            tr.setSelection(
              options?.select
                ? NodeSelection.create(tr.doc, from)
                : TextSelection.near(tr.doc.resolve(after), 1),
            );
          }
          return true;
        },
      unwrapLinkCard:
        label =>
        ({ state, tr, dispatch }) => {
          const { selection, schema } = state;
          if (!isLinkCardSelection(selection)) return false;
          if (dispatch) {
            const text = schema.text(label, [
              schema.marks.link.create({ href: selection.node.attrs.href }),
            ]);
            tr.replaceWith(selection.from, selection.to, schema.nodes.paragraph.create(null, text));
            const start = selection.from + 1;
            tr.setSelection(TextSelection.create(tr.doc, start, start + text.nodeSize));
          }
          return true;
        },
      relabelLink:
        (href, label) =>
        ({ state, tr, dispatch }) => {
          const { selection, schema } = state;
          const range = getMarkRange(selection.$from, schema.marks.link);
          if (!range) return false;
          if (dispatch) {
            const text = schema.text(label, [schema.marks.link.create({ href })]);
            tr.replaceWith(range.from, range.to, text);
            tr.setSelection(TextSelection.create(tr.doc, range.from, range.from + text.nodeSize));
          }
          return true;
        },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkCardNodeView);
  },
  markdownTokenizer: {
    name: 'linkCard',
    level: 'block',
    start: source => source.indexOf('<LinkCard'),
    tokenize(source) {
      const match = source.match(/^<LinkCard\b[^>]*\/>/);
      const attrs = match ? parseLinkCardMarkup(match[0]) : null;
      return match && attrs ? { type: 'linkCard', raw: match[0], attrs } : undefined;
    },
  },
  parseMarkdown(token, helpers) {
    const attrs = token.attrs as { href: string; type?: string };
    return helpers.createNode('linkCard', {
      href: attrs.href,
      cardType: attrs.type || getLinkCardTarget(attrs.href)?.type || null,
    });
  },
  renderMarkdown(node) {
    return formatLinkCard({
      href: node.attrs?.href || '',
      type: node.attrs?.cardType || undefined,
    });
  },
});
