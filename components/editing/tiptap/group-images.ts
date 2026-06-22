import type { Editor } from '@tiptap/core';

import type { MdxImageGalleryItem } from '@/lib/utils/editor-image';

interface ImageRun {
  from: number;
  to: number;
  images: MdxImageGalleryItem[];
}

/**
 * Collapse runs of two or more consecutive top-level image nodes into a single
 * `imageGallery` node. Mirrors the read/save rule ("consecutive images = one
 * gallery") so a stored `<ImageGallery>` — expanded to markdown images when the
 * editor loads — comes back as a gallery node. Runs once on load and after the
 * markdown textarea is reapplied, not on every keystroke.
 */
export const groupAdjacentImages = (editor: Editor) => {
  const { state } = editor;
  const imageType = state.schema.nodes.image;
  const galleryType = state.schema.nodes.imageGallery;
  if (!imageType || !galleryType) {
    return;
  }

  const runs: ImageRun[] = [];
  let current: ImageRun | null = null;

  const flush = () => {
    if (current && current.images.length >= 2) {
      runs.push(current);
    }
    current = null;
  };

  state.doc.forEach((child, offset) => {
    const src = typeof child.attrs.src === 'string' ? child.attrs.src : '';
    if (child.type === imageType && src) {
      const image = { src, alt: typeof child.attrs.alt === 'string' ? child.attrs.alt : '' };
      if (current) {
        current.images.push(image);
        current.to = offset + child.nodeSize;
      } else {
        current = { from: offset, to: offset + child.nodeSize, images: [image] };
      }
      return;
    }
    flush();
  });
  flush();

  if (!runs.length) {
    return;
  }

  const { tr } = state;
  // Replace from last to first so earlier offsets stay valid.
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    const run = runs[index];
    tr.replaceWith(run.from, run.to, galleryType.create({ images: run.images }));
  }
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
};
