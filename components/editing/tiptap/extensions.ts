import { type Editor, Extension, mergeAttributes, type Range } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import {
  CodeIcon,
  Heading2Icon,
  ImageIcon,
  ImagesIcon,
  ListIcon,
  ListTodoIcon,
  MinusIcon,
  QuoteIcon,
} from 'lucide-react';

import { markEditingOverlayClosed, markEditingOverlayOpen } from '../editing-overlays';
import { ImageNodeView } from './image-node-view';
import { getImagePreviewSrc } from './image-preview-store';
import { type SlashItem, SlashList, type SlashListRef } from './slash-list';

export { registerGalleryStaging } from './gallery-staging-store';
export { groupAdjacentImages } from './group-images';
export { ImageGallery } from './image-gallery-extension';
export { registerImagePreview } from './image-preview-store';

export const StagedImage = Image.extend({
  // A React node view shows the image with its (editable) caption below — the
  // serialised markdown stays `![alt](src)`, so the caption rides on `alt`.
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView, {
      // Let the caption <input> own its pointer/keyboard events so ProseMirror
      // doesn't grab the click (node-select) or swallow the keystrokes.
      stopEvent: ({ event }) =>
        event.target instanceof HTMLElement &&
        event.target.closest('.fz-editor-figcaption') != null,
    });
  },
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : '';
    const preview = src ? getImagePreviewSrc(src) : undefined;
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, preview ? { src: preview } : {}),
    ];
  },
});

const buildSlashItems = (onImage: () => void, onImageGallery?: () => void): SlashItem[] => [
  {
    id: 'heading',
    title: 'Heading',
    icon: Heading2Icon,
    syntax: '##',
    run: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'bulletList',
    title: 'Bullet list',
    icon: ListIcon,
    syntax: '-',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: 'taskList',
    title: 'To-do list',
    icon: ListTodoIcon,
    syntax: '[]',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: 'quote',
    title: 'Quote',
    icon: QuoteIcon,
    syntax: '>',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    id: 'codeBlock',
    title: 'Code block',
    icon: CodeIcon,
    syntax: '```',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: 'image',
    title: 'Image',
    icon: ImageIcon,
    run: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      onImage();
    },
  },
  ...(onImageGallery
    ? [
        {
          id: 'imageGallery',
          title: 'Image gallery',
          icon: ImagesIcon,
          run: ({ editor, range }: { editor: Editor; range: Range }) => {
            editor.chain().focus().deleteRange(range).run();
            onImageGallery();
          },
        },
      ]
    : []),
  {
    id: 'divider',
    title: 'Divider',
    icon: MinusIcon,
    syntax: '---',
    run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

const filterSlashItems = (items: SlashItem[], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }
  return items.filter(
    item =>
      item.title.toLowerCase().includes(normalized) ||
      item.id.toLowerCase().includes(normalized) ||
      (item.syntax ?? '').toLowerCase().includes(normalized),
  );
};

interface SlashCommandOptions {
  onImage: () => void;
  /** When provided, adds a separate "Image gallery" command (omitted for memos). */
  onImageGallery?: () => void;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { onImage: () => undefined, onImageGallery: undefined };
  },

  addProseMirrorPlugins() {
    const getOnImage = () => this.options.onImage;
    const getOnImageGallery = () => this.options.onImageGallery;

    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => {
          const onImageGallery = getOnImageGallery();
          return filterSlashItems(
            buildSlashItems(
              () => getOnImage()(),
              onImageGallery ? () => onImageGallery() : undefined,
            ),
            query,
          );
        },
        command: ({ editor, range, props }) => props.run({ editor, range }),
        render: () => {
          let component: ReactRenderer<SlashListRef> | null = null;
          let element: HTMLDivElement | null = null;

          const place = (clientRect?: (() => DOMRect | null) | null) => {
            if (!element || !clientRect) {
              return;
            }
            const rect = clientRect();
            if (!rect) {
              return;
            }
            const menuHeight = element.offsetHeight;
            const below = rect.bottom + 6;
            const above = rect.top - menuHeight - 6;
            const top = below + menuHeight > window.innerHeight && above > 8 ? above : below;
            const left = Math.min(Math.round(rect.left), window.innerWidth - 212);
            element.style.left = `${Math.max(8, left)}px`;
            element.style.top = `${Math.round(top)}px`;
          };

          return {
            onStart: props => {
              markEditingOverlayOpen();
              component = new ReactRenderer(SlashList, {
                props,
                editor: props.editor,
              });
              element = document.createElement('div');
              element.style.position = 'fixed';
              element.style.zIndex = '60';
              element.appendChild(component.element);
              document.body.appendChild(element);
              place(props.clientRect);
            },
            onUpdate: props => {
              component?.updateProps(props);
              place(props.clientRect);
            },
            onKeyDown: props => component?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              markEditingOverlayClosed();
              element?.remove();
              element = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
