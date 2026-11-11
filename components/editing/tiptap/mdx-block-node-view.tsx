'use client';

import { type NodeViewProps, NodeViewWrapper, useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { mdxBlockLabel } from '@/lib/mdx-block';
import { scanMdxBlock } from '@/lib/mdx-editing';

const OPEN_MDX_BLOCK_EVENT = 'mdx-block-open';

/** Opens the chip at `pos` into its source. */
export const openMdxBlock = (editorDom: HTMLElement, pos: number | undefined) =>
  editorDom.dispatchEvent(new CustomEvent(OPEN_MDX_BLOCK_EVENT, { detail: pos }));

/**
 * A component chip that opens into its source while editing. ⌘Enter applies the source if it
 * is still exactly one component, else shows an inline error; clicking away applies it or
 * keeps the original; Escape restores the chip.
 */
export function MdxBlockNodeView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const name = String(node.attrs.name);
  const source = String(node.attrs.source);
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e?.isEditable ?? false });
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  // Closing moves focus away, which fires blur; this keeps that blur from deciding again.
  const closedRef = useRef(false);

  const close = (refocus: boolean) => {
    closedRef.current = true;
    setDraft(null);
    setInvalid(false);
    const pos = getPos();
    if (refocus && typeof pos === 'number') editor.chain().focus().setNodeSelection(pos).run();
  };
  // The draft as one component, or null when it isn't exactly one.
  const parseDraft = () => {
    const next = (draft ?? '').trim();
    const block = scanMdxBlock(next);
    return block && block.source === next ? block : null;
  };
  const commit = (block: NonNullable<ReturnType<typeof scanMdxBlock>>) => {
    if (block.source !== source) updateAttributes({ name: block.name, source: block.source });
  };

  // Click and Enter (the extension's shortcut) both open the chip through this one event.
  useEffect(() => {
    const dom = editor.view.dom;
    const handleOpen = (event: Event) => {
      if ((event as CustomEvent<number>).detail !== getPos()) return;
      closedRef.current = false;
      setInvalid(false);
      setDraft(source);
    };
    dom.addEventListener(OPEN_MDX_BLOCK_EVENT, handleOpen);
    return () => dom.removeEventListener(OPEN_MDX_BLOCK_EVENT, handleOpen);
  }, [editor, getPos, source]);

  if (draft !== null && editable) {
    return (
      <NodeViewWrapper className="fz-mdx-editor">
        <textarea
          // biome-ignore lint/a11y/noAutofocus: opened by a click or Enter on the chip, so focus follows it
          autoFocus
          value={draft}
          rows={draft.split('\n').length}
          spellCheck={false}
          aria-label={`${name} source`}
          aria-invalid={invalid}
          onChange={event => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={() => {
            if (closedRef.current) return;
            const block = parseDraft();
            if (block) commit(block);
            else toast.error('Not a valid component — kept the original');
            close(false);
          }}
          onKeyDown={event => {
            // Keep ⌘Enter (save) and Escape (exit editing) from reaching the page's shortcuts.
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              event.stopPropagation();
              const block = parseDraft();
              if (!block) {
                setInvalid(true);
                return;
              }
              commit(block);
              close(true);
            }
          }}
        />
        {invalid ? (
          <p className="fz-mdx-error" role="alert">
            Not a valid component
          </p>
        ) : null}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="fz-mdx-block"
      title={editable ? 'Click to edit' : undefined}
      onClick={() => {
        if (editable) openMdxBlock(editor.view.dom, getPos());
      }}
    >
      {mdxBlockLabel(name, source)}
    </NodeViewWrapper>
  );
}
