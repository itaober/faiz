import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import type { MdxImageGalleryItem } from '@/lib/utils/editor-image';

import { ImageGalleryNodeView } from './image-gallery-node-view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageGallery: {
      /** Insert a gallery of two or more images at the current selection. */
      setImageGallery: (images: MdxImageGalleryItem[]) => ReturnType;
    };
  }
}

export const parseGalleryImages = (value: unknown): MdxImageGalleryItem[] => {
  if (typeof value === 'string') {
    try {
      return parseGalleryImages(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): MdxImageGalleryItem | null => {
      const src = item && typeof item.src === 'string' ? item.src : '';
      if (!src) {
        return null;
      }
      const alt = item && typeof item.alt === 'string' ? item.alt : '';
      return { src, alt };
    })
    .filter((item): item is MdxImageGalleryItem => item !== null);
};

/**
 * A multi-image gallery as a single atom block. The serialised markdown stays a
 * run of consecutive `![alt](src)` images, so it round-trips through the same
 * pipeline that groups them back into `<ImageGallery>` on save and re-merges
 * them into this node on load (see `groupAdjacentImages`).
 */
export const ImageGallery = Node.create({
  name: 'imageGallery',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [] as MdxImageGalleryItem[],
        parseHTML: element => parseGalleryImages(element.getAttribute('data-images')),
        renderHTML: attributes => ({
          'data-images': JSON.stringify(parseGalleryImages(attributes.images)),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-image-gallery]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-image-gallery': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNodeView, {
      // Let interactive controls (caption input, thumbnail buttons) own their
      // pointer/keyboard events so ProseMirror doesn't select the atom or steal
      // focus.
      stopEvent: ({ event }) =>
        event.target instanceof HTMLElement &&
        event.target.closest('[data-gallery-interactive]') != null,
    });
  },

  addCommands() {
    return {
      setImageGallery:
        images =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { images: parseGalleryImages(images) },
          }),
    };
  },

  renderMarkdown(node) {
    return parseGalleryImages(node.attrs?.images)
      .map(image => `![${(image.alt ?? '').trim()}](${image.src})`)
      .join('\n\n');
  },
});
