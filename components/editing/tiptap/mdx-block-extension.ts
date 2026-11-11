import { NodeSelection } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { MdxBlockBase } from '@/lib/mdx-block';

import { MdxBlockNodeView, openMdxBlock } from './mdx-block-node-view';

/**
 * The component block as a chip or a preview: click it, or Enter on a selected one, to edit its
 * source.
 */
export const MdxBlock = MdxBlockBase.extend({
  addNodeView() {
    return ReactNodeViewRenderer(MdxBlockNodeView);
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type !== this.type)
          return false;
        openMdxBlock(editor.view.dom, selection.from);
        return true;
      },
    };
  },
});
