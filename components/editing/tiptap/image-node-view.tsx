'use client';

import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper, useEditorState } from '@tiptap/react';
import { useEffect, useState } from 'react';

import { getImagePreviewSrc } from './image-preview-store';

/**
 * Renders an image with its caption (the `alt`) shown below it — mirroring the
 * read-view <Image> so editing is WYSIWYG. While the editor is editable the
 * caption is an inline input that writes back to `alt`; markdown serialisation
 * stays `![alt](src)`, so the caption round-trips. Read-only shows static text.
 */
export function ImageNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
  const displaySrc = getImagePreviewSrc(src) ?? src;
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e?.isEditable ?? false });

  // Decouple the input from the node attr so per-keystroke updates don't reset
  // the caret; resync when the attr changes externally (undo, mode switch).
  const [caption, setCaption] = useState(alt);
  useEffect(() => {
    setCaption(alt);
  }, [alt]);

  return (
    <NodeViewWrapper as="figure" className="fz-editor-figure">
      {/* biome-ignore lint/performance/noImgElement: editor node view; src may be a local blob: URL */}
      <img src={displaySrc} alt={alt} draggable={false} />
      {editable ? (
        <input
          className="fz-editor-figcaption"
          value={caption}
          placeholder="Add a caption…"
          aria-label="Image caption"
          onMouseDown={event => event.stopPropagation()}
          onChange={event => {
            setCaption(event.target.value);
            updateAttributes({ alt: event.target.value });
          }}
        />
      ) : alt ? (
        <figcaption className="fz-editor-figcaption">{alt}</figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}
