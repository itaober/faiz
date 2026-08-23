'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { MdxImageGalleryItem } from '@/lib/utils/editor-image';
import { SUPPORTED_IMAGE_TYPES } from '@/lib/utils/image';

import { getGalleryStaging } from './gallery-staging-store';
import { parseGalleryImages } from './image-gallery-extension';
import { getImagePreviewSrc } from './image-preview-store';

const displaySrc = (src: string) => getImagePreviewSrc(src) ?? src;

/**
 * Editor view for the `imageGallery` node — the same card-less "large image +
 * filmstrip" layout as the published gallery, plus editing affordances (switch
 * main, caption, add, remove, reorder). Read-only (preview mode) hides controls
 * so it mirrors the read view exactly. Mirrors the single-image figure's box
 * model (centered, `max-w-xl` image) so it sizes correctly inside the node view.
 */
export function ImageGalleryNodeView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const images = parseGalleryImages(node.attrs.images);
  const count = images.length;

  // Track editability so preview mode (read-only) hides the editing affordances
  // and matches the read view. `setEditable` emits "update", which `useEditorState`
  // doesn't reliably re-run on, so subscribe to the editor event directly.
  const [editable, setEditable] = useState(() => editor.isEditable);
  useEffect(() => {
    const sync = () => setEditable(editor.isEditable);
    sync();
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const fileInputId = useId();
  const dragIndexRef = useRef<number | null>(null);

  const safeIndex = Math.min(selectedIndex, Math.max(0, count - 1));
  useEffect(() => {
    if (selectedIndex !== safeIndex) {
      setSelectedIndex(safeIndex);
    }
  }, [safeIndex, selectedIndex]);

  if (count === 0) {
    return null;
  }

  const selected = images[safeIndex];
  const caption = selected.alt ?? '';

  const setImages = (next: MdxImageGalleryItem[]) => updateAttributes({ images: next });

  const updateCaption = (value: string) =>
    setImages(
      images.map((image, index) => (index === safeIndex ? { ...image, alt: value } : image)),
    );

  const collapseToImage = (image: MdxImageGalleryItem) => {
    const pos = getPos();
    if (typeof pos !== 'number') {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: pos, to: pos + node.nodeSize },
        { type: 'image', attrs: { src: image.src, alt: image.alt ?? '' } },
      )
      .run();
  };

  const removeImage = (index: number) => {
    const next = images.filter((_, current) => current !== index);
    if (next.length === 0) {
      deleteNode();
      return;
    }
    // A single image is no longer a gallery — fall back to a plain image node.
    if (next.length === 1) {
      collapseToImage(next[0]);
      return;
    }
    setImages(next);
    setSelectedIndex(current => Math.min(current, next.length - 1));
  };

  const reorder = (from: number, to: number) => {
    if (from === to) {
      return;
    }
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setImages(next);
    setSelectedIndex(to);
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) {
      return;
    }
    const stageFiles = getGalleryStaging(editor);
    const staged = stageFiles ? await stageFiles(files) : [];
    if (!staged.length) {
      return;
    }
    setImages([...images, ...staged]);
    setSelectedIndex(count);
  };

  return (
    <NodeViewWrapper className="fz-gallery not-prose my-4 flex flex-col items-center">
      <div className="relative aspect-square w-full max-w-xl overflow-hidden rounded-md bg-[var(--fz-image-frame)] md:rounded-lg">
        {/* biome-ignore lint/performance/noImgElement: editor node view; src may be a local blob: URL */}
        <img
          src={displaySrc(selected.src)}
          alt={caption}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>

      <div className="relative mt-2 min-h-5 w-full max-w-xl">
        {editable ? (
          <input
            data-gallery-interactive
            className="text-muted-foreground focus:text-foreground placeholder:text-muted-foreground/55 w-full truncate border-none bg-transparent px-10 text-center text-sm outline-none"
            value={caption}
            placeholder="Add a caption…"
            aria-label="Image caption"
            onMouseDown={event => event.stopPropagation()}
            onChange={event => updateCaption(event.target.value)}
          />
        ) : (
          <p className="text-muted-foreground w-full truncate px-10 text-center text-sm">
            {caption}
          </p>
        )}
        <span className="text-muted-foreground/70 pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 font-mono text-xs">
          {safeIndex + 1}/{count}
        </span>
      </div>

      <div className="mt-1 flex w-full max-w-xl gap-2 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {images.map((image, index) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: drag-to-reorder is inherently pointer-only; the button inside handles selection
          <div
            key={image.src}
            data-gallery-interactive
            draggable={editable}
            onDragStart={event => {
              dragIndexRef.current = index;
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={event => {
              if (dragIndexRef.current !== null) {
                event.preventDefault();
              }
            }}
            onDrop={event => {
              event.preventDefault();
              const from = dragIndexRef.current;
              dragIndexRef.current = null;
              if (from !== null) {
                reorder(from, index);
              }
            }}
            className="relative shrink-0"
          >
            <button
              type="button"
              onMouseDown={event => event.stopPropagation()}
              onClick={() => setSelectedIndex(index)}
              className={cn(
                'focus-ring relative block size-12 overflow-hidden rounded-md bg-[var(--fz-image-frame)] transition md:size-14',
                index === safeIndex ? 'opacity-100' : 'opacity-50 hover:opacity-90',
              )}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === safeIndex ? 'true' : undefined}
            >
              {/* biome-ignore lint/performance/noImgElement: editor thumbnail; src may be a local blob: URL */}
              <img
                src={displaySrc(image.src)}
                alt=""
                draggable={false}
                className="h-full w-full object-contain"
              />
            </button>
            {editable ? (
              <button
                type="button"
                onMouseDown={event => event.stopPropagation()}
                onClick={() => removeImage(index)}
                className="bg-overlay-control text-overlay-control-foreground hover:bg-overlay-control-hover focus-ring absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full backdrop-blur transition"
                aria-label={`Remove image ${index + 1}`}
              >
                <XIcon className="size-3" />
              </button>
            ) : null}
          </div>
        ))}

        {editable ? (
          <>
            <button
              type="button"
              data-gallery-interactive
              onMouseDown={event => event.stopPropagation()}
              onClick={() => document.getElementById(fileInputId)?.click()}
              className="border-border text-muted-foreground/70 hover:text-foreground hover:border-foreground/40 focus-ring flex size-12 shrink-0 items-center justify-center rounded-md border border-dashed transition md:size-14"
              aria-label="Add images to gallery"
            >
              <PlusIcon className="size-4.5" />
            </button>
            <input
              id={fileInputId}
              type="file"
              accept={SUPPORTED_IMAGE_TYPES.join(',')}
              multiple
              className="hidden"
              aria-label="Add images to gallery"
              onChange={event => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                addFiles(files).catch(() => undefined);
              }}
            />
          </>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
