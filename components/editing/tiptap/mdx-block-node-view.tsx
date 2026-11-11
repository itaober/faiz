'use client';

import { type NodeViewProps, NodeViewWrapper, useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { mdxBlockLabel } from '@/lib/mdx-block';
import { isReadableMdxBlock, readMdxBlock, scanMdxBlock } from '@/lib/mdx-editing';

const OPEN_MDX_BLOCK_EVENT = 'mdx-block-open';

/** Opens the chip at `pos` into its source. */
export const openMdxBlock = (editorDom: HTMLElement, pos: number | undefined) =>
  editorDom.dispatchEvent(new CustomEvent(OPEN_MDX_BLOCK_EVENT, { detail: pos }));

/**
 * A component chip that opens into its source while editing. ⌘Enter applies the source if it
 * is still exactly one component, else shows an inline error; clicking elsewhere in the page
 * applies it or keeps the original; Escape restores the chip.
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
  // The block to keep: the original when unchanged, else the draft if it is still one block
  // (read the lenient way when the original was kept as written), else null.
  const parseDraft = () => {
    const next = (draft ?? '').trim();
    if (next === source.trim()) return { name, source };
    const block = (isReadableMdxBlock(source) ? scanMdxBlock : readMdxBlock)(next);
    return block?.source === next ? block : null;
  };
  const commit = (block: { name: string; source: string }) => {
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
            // Switching windows or tabs also blurs; keep the draft for when focus comes back.
            if (closedRef.current || !document.hasFocus()) return;
            const block = parseDraft();
            if (block) commit(block);
            else toast.error('Not a valid component — kept the original');
            close(false);
          }}
          onKeyDown={event => {
            // An IME uses these keys to confirm or cancel its own composition.
            if (event.nativeEvent.isComposing) return;
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
