'use client';

import { type NodeViewProps, NodeViewWrapper, useEditorState } from '@tiptap/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { ANIMATION } from '@/lib/constants/animation';

import { mdxBlockLabel } from '@/lib/mdx-block';
import { type Acorn, loadAcorn, type MdxBlock, readEditedBlock } from '@/lib/mdx-editing';
import { cn } from '@/lib/utils';

import { setInvalidDraft } from '../editing-overlays';

const OPEN_MDX_BLOCK_EVENT = 'mdx-block-open';

// Long enough to read as the chip opening into the box, short enough not to wait on.
const RESIZE = { duration: 0.2, ease: ANIMATION.ease.out };
const FADE = { duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out };

/** Opens the chip at `pos` into its source. */
export const openMdxBlock = (editorDom: HTMLElement, pos: number | undefined) =>
  editorDom.dispatchEvent(new CustomEvent(OPEN_MDX_BLOCK_EVENT, { detail: pos }));

/**
 * A component chip that opens into its source while editing. ⌘Enter, or clicking elsewhere in
 * the page, applies the source if it is still exactly one component; else the box stays open on
 * the draft with an inline error, and the page won't save until it is fixed or cancelled.
 * Escape restores the chip.
 */
export function MdxBlockNodeView({ node, editor, getPos, updateAttributes }: NodeViewProps) {
  const name = String(node.attrs.name);
  const source = String(node.attrs.source);
  const editable = useEditorState({ editor, selector: ({ editor: e }) => e?.isEditable ?? false });
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  // Closing moves focus away, which fires blur; this keeps that blur from deciding again.
  const closedRef = useRef(false);
  const reducedMotion = useReducedMotion();
  // The frame morphs with a layout animation, which leaves its layout box at the new size at
  // once; animating the block's real height lets the text below follow instead of jumping.
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();

  const markInvalid = (value: boolean) => {
    setInvalid(value);
    setInvalidDraft(id, value);
  };
  const close = (refocus: boolean) => {
    closedRef.current = true;
    setDraft(null);
    markInvalid(false);
    const pos = getPos();
    if (refocus && typeof pos === 'number') editor.chain().focus().setNodeSelection(pos).run();
  };
  // The block to keep: the original when unchanged, else the draft if it is still one block.
  const readDraft = (next: string, acorn?: Acorn) =>
    next === source.trim() ? { name, source } : readEditedBlock(next, source, acorn);
  const commit = (block: Pick<MdxBlock, 'name' | 'source'>) => {
    if (block.source !== source) updateAttributes({ name: block.name, source: block.source });
  };
  // Applies the draft if it is one block, else shows the error. One the brace reader rejects is
  // read again with acorn, loaded only then; saves wait meanwhile, and a draft edited since is
  // left to its next blur or ⌘Enter.
  const settle = (
    field: HTMLTextAreaElement,
    apply: (block: Pick<MdxBlock, 'name' | 'source'>) => void,
  ) => {
    const next = field.value.trim();
    const block = readDraft(next);
    if (block) return apply(block);
    setInvalidDraft(id, true);
    loadAcorn()
      .then(acorn => readDraft(next, acorn))
      .catch(() => null)
      .then(full => {
        if (closedRef.current || field.value.trim() !== next) return;
        if (full) apply(full);
        else markInvalid(true);
      });
  };

  // Click and Enter (the extension's shortcut) both open the chip through this one event.
  useEffect(() => {
    const dom = editor.view.dom;
    const handleOpen = (event: Event) => {
      if ((event as CustomEvent<number>).detail !== getPos()) return;
      closedRef.current = false;
      // Already open (Enter on the chip while its box waits on an error): keep the draft.
      setDraft(current => current ?? source);
    };
    dom.addEventListener(OPEN_MDX_BLOCK_EVENT, handleOpen);
    return () => dom.removeEventListener(OPEN_MDX_BLOCK_EVENT, handleOpen);
  }, [editor, getPos, source]);

  useEffect(() => () => setInvalidDraft(id, false), [id]);

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
                    markInvalid(false);
                  }}
                  onBlur={event => {
                    // Switching windows or tabs also blurs; keep the draft for when focus comes back.
                    if (closedRef.current || !document.hasFocus()) return;
                    settle(event.currentTarget, block => {
                      commit(block);
                      close(false);
                    });
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
                    settle(event.currentTarget, block => {
                      commit(block);
                      close(true);
                    });
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
