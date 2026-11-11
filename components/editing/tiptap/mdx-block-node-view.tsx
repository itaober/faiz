'use client';

import { type NodeViewProps, NodeViewWrapper, useEditorState } from '@tiptap/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ANIMATION } from '@/lib/constants/animation';

import { mdxBlockLabel } from '@/lib/mdx-block';
import { isReadableMdxBlock, readMdxBlock } from '@/lib/mdx-editing';
import { cn } from '@/lib/utils';

const OPEN_MDX_BLOCK_EVENT = 'mdx-block-open';

// Long enough to read as the chip opening into the box, short enough not to wait on.
const RESIZE = { duration: 0.2, ease: ANIMATION.ease.out };
const FADE = { duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out };

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
  const reducedMotion = useReducedMotion();
  // The frame morphs with a layout animation, which leaves its layout box at the new size at
  // once; animating the block's real height lets the text below follow instead of jumping.
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();

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
    const block = readMdxBlock(next);
    // A component the parser read has to stay readable; one kept as written may stay so.
    const valid =
      block?.source === next && (!isReadableMdxBlock(source) || isReadableMdxBlock(next));
    return valid ? block : null;
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

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => setContentHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const open = draft !== null && editable;

  return (
    <NodeViewWrapper className="fz-mdx-slot">
      <motion.div
        initial={false}
        animate={{ height: contentHeight ?? 'auto' }}
        transition={reducedMotion ? { duration: 0 } : RESIZE}
      >
        <div ref={contentRef}>
          <motion.div
            layout
            transition={RESIZE}
            className={cn('fz-mdx-frame', open && 'fz-mdx-frame-open')}
            title={editable && !open ? 'Click to edit' : undefined}
            onClick={() => {
              if (editable && !open) openMdxBlock(editor.view.dom, getPos());
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {open ? (
                <motion.textarea
                  key="source"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={FADE}
                  // Opened by a click or Enter on the chip, so focus follows it.
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
                    const isApply = event.key === 'Enter' && (event.metaKey || event.ctrlKey);
                    if (event.key !== 'Escape' && !isApply) return;
                    // Keep these from the page's shortcuts (⌘Enter saves, Escape exits editing),
                    // and leave them to an IME that is using them to confirm or cancel its text.
                    event.stopPropagation();
                    if (event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    if (!isApply) {
                      close(true);
                      return;
                    }
                    const block = parseDraft();
                    if (!block) {
                      setInvalid(true);
                      return;
                    }
                    commit(block);
                    close(true);
                  }}
                />
              ) : (
                <motion.span
                  key="label"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={FADE}
                  className="fz-mdx-label"
                >
                  {mdxBlockLabel(name, source)}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
          {open && invalid ? (
            <p className="fz-mdx-error" role="alert">
              Not a valid component
            </p>
          ) : null}
        </div>
      </motion.div>
    </NodeViewWrapper>
  );
}
