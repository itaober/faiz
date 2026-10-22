'use client';

import { type Editor, getMarkRange } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  CodeIcon,
  ExternalLinkIcon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LayoutPanelTopIcon,
  LinkIcon,
  ListIcon,
  ListTodoIcon,
  type LucideIcon,
  QuoteIcon,
  Settings2Icon,
  StrikethroughIcon,
  TypeIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import useLinkCard from '@/hooks/use-link-card';
import useMeasure from '@/hooks/use-measure';
import { ANIMATION } from '@/lib/constants/animation';
import { getLinkCardTarget } from '@/lib/link-card';

import { IconButton } from '../action-bar';
import { isLinkCardSelection } from './link-card-extension';

// ── Formatting tools, shared by the desktop bubble and the mobile pill ───────
interface FormatTool {
  icon: LucideIcon;
  label: string;
  /** Defaults to `editor.isActive(id)`. */
  active?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}
type FormatToolId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'heading'
  | 'bulletList'
  | 'taskList'
  | 'blockquote';

const FORMAT_TOOLS: Record<FormatToolId, FormatTool> = {
  bold: { icon: BoldIcon, label: 'Bold', run: editor => editor.chain().focus().toggleBold().run() },
  italic: {
    icon: ItalicIcon,
    label: 'Italic',
    run: editor => editor.chain().focus().toggleItalic().run(),
  },
  strike: {
    icon: StrikethroughIcon,
    label: 'Strikethrough',
    run: editor => editor.chain().focus().toggleStrike().run(),
  },
  code: {
    icon: CodeIcon,
    label: 'Inline code',
    run: editor => editor.chain().focus().toggleCode().run(),
  },
  heading: {
    icon: Heading2Icon,
    label: 'Heading',
    active: editor => editor.isActive('heading', { level: 2 }),
    run: editor => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  bulletList: {
    icon: ListIcon,
    label: 'List',
    run: editor => editor.chain().focus().toggleBulletList().run(),
  },
  taskList: {
    icon: ListTodoIcon,
    label: 'Todo',
    run: editor => editor.chain().focus().toggleTaskList().run(),
  },
  blockquote: {
    icon: QuoteIcon,
    label: 'Quote',
    run: editor => editor.chain().focus().toggleBlockquote().run(),
  },
};
const DESKTOP_TOOLS: FormatToolId[] = ['bold', 'italic', 'strike', 'code'];
const MOBILE_TOOLS: FormatToolId[] = [
  'bold',
  'italic',
  'heading',
  'bulletList',
  'taskList',
  'blockquote',
];

// ── Toolbar state ────────────────────────────────────────────────────────────
// useEditor does not re-render on transactions, and selection-only changes
// (clicking a card) never reach onUpdate — so both toolbars read through here.
type Presentation = 'card' | 'url' | 'text';

export const selectToolbarState = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }
  const { selection, doc, schema } = editor.state;
  const href = String(editor.getAttributes('link').href ?? '');
  const card = isLinkCardSelection(selection) ? String(selection.node.attrs.href ?? '') : null;
  // Only a link to a supported provider has a card to switch to.
  const link = !card && getLinkCardTarget(href) ? href : null;
  const range = link ? getMarkRange(selection.$from, schema.marks.link) : null;
  const presentation: Presentation = card
    ? 'card'
    : range && doc.textBetween(range.from, range.to) === link
      ? 'url'
      : 'text';
  return {
    card,
    link,
    presentation,
    empty: selection.empty,
    linked: editor.isActive('link'),
    active: Object.fromEntries(
      (Object.keys(FORMAT_TOOLS) as FormatToolId[]).map(id => [
        id,
        FORMAT_TOOLS[id].active?.(editor) ?? editor.isActive(id),
      ]),
    ) as Record<FormatToolId, boolean>,
  };
};
export type ToolbarState = NonNullable<ReturnType<typeof selectToolbarState>>;

type Level = 'format' | 'link' | 'presentation';

// A second-level toolbar belongs to the selection it was opened on: once that
// selection no longer qualifies, drop back to the formatting tools. A card is
// always on the presentation level, and stays there after it turns into a link
// so the other options remain one click away.
function useToolbarLevel(state: ToolbarState) {
  const [level, setLevel] = useState<Level>('format');
  useEffect(() => {
    if (state.card) {
      setLevel('presentation');
    } else if ((level === 'presentation' && !state.link) || (level === 'link' && state.empty)) {
      setLevel('format');
    }
  }, [level, state.card, state.link, state.empty]);
  return [state.card ? 'presentation' : level, setLevel] as const;
}

function FormatButtons({
  ids,
  editor,
  state,
}: {
  ids: FormatToolId[];
  editor: Editor;
  state: ToolbarState;
}) {
  return ids.map(id => {
    const tool = FORMAT_TOOLS[id];
    return (
      <IconButton
        key={id}
        icon={tool.icon}
        label={tool.label}
        active={state.active[id]}
        onClick={() => tool.run(editor)}
      />
    );
  });
}

// Leaves a selected card for the text after it, which closes the bubble.
const leaveCard = (editor: Editor) =>
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(TextSelection.near(tr.doc.resolve(tr.selection.to), 1));
      return true;
    })
    .run();

// ── Presentation level: how a supported link shows (card / URL / title) ──────
// Every state renders the same buttons in the same places, so the one under
// the pointer is still there after it is clicked.
function PresentationTools({
  editor,
  state,
  onBack,
}: {
  editor: Editor;
  state: ToolbarState;
  onBack: () => void;
}) {
  const href = state.card ?? state.link ?? '';
  const { data, loading } = useLinkCard(href);
  const title = data && !data.unavailable ? data.title : null;
  // A card unwraps into a link; a link is just relabelled. Either way the
  // result stays selected so the toolbar keeps offering the other options.
  const showAs = (label: string) =>
    state.card
      ? editor.chain().focus().unwrapLinkCard(label).run()
      : editor.chain().focus().relabelLink(href, label).run();
  const options: {
    id: Presentation;
    label: string;
    icon: LucideIcon;
    disabled?: boolean;
    run: () => void;
  }[] = [
    {
      id: 'card',
      label: 'Card',
      icon: LayoutPanelTopIcon,
      run: () =>
        editor
          .chain()
          .focus()
          .extendMarkRange('link')
          .deleteSelection()
          .insertLinkCard(href, { select: true })
          .run(),
    },
    { id: 'url', label: 'URL', icon: LinkIcon, run: () => showAs(href) },
    {
      id: 'text',
      label: 'Title',
      icon: TypeIcon,
      disabled: loading || !title,
      run: () => title && showAs(title),
    },
  ];
  return (
    <>
      <IconButton icon={ChevronLeftIcon} label="Back" onClick={onBack} />
      <span className="fz-actionbar-sep" />
      {options.map(({ id, label, icon, disabled, run }) => {
        const current = state.presentation === id;
        return (
          <IconButton
            key={id}
            icon={icon}
            label={label}
            active={current}
            disabled={disabled}
            onClick={current ? () => undefined : run}
          />
        );
      })}
      <span className="fz-actionbar-sep" />
      <IconButton
        icon={ExternalLinkIcon}
        label="Open link"
        onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
      />
    </>
  );
}

// ── Desktop: selection bubble ────────────────────────────────────────────────
// Anchored to the selection's start so switching a card ↔ its link, which
// share a left edge, keeps the bubble in place; its box morphs to the level's
// content instead of jumping.
export function SelectionBubble({
  editor,
  state,
  enabled,
}: {
  editor: Editor;
  state: ToolbarState;
  enabled: boolean;
}) {
  const [level, setLevel] = useToolbarLevel(state);
  const [linkValue, setLinkValue] = useState('');
  const reducedMotion = useReducedMotion();
  const [contentRef, bounds] = useMeasure<HTMLDivElement>(level);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Focus without scrolling: the bubble clips overflow while its width is still
  // animating, and a plain focus would scroll the input into view inside it.
  useEffect(() => {
    if (level === 'link') {
      linkInputRef.current?.focus({ preventScroll: true });
    }
  }, [level]);

  const openLink = () => {
    setLinkValue(editor.getAttributes('link').href ?? '');
    setLevel('link');
  };
  const applyLink = () => {
    const href = linkValue.trim();
    if (href) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLevel('format');
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="fzSelectionBubble"
      options={{ placement: 'top-start', offset: 8 }}
      // A card anchors like a line of text: the block's left edge, and the top
      // of its visible content (the artwork, not the frame around it) — so the
      // bubble does not hop when the card turns into its link.
      getReferencedVirtualElement={() => {
        const { selection } = editor.state;
        if (!isLinkCardSelection(selection)) return null;
        const node = editor.view.nodeDOM(selection.from);
        const artwork =
          node instanceof HTMLElement ? node.querySelector('[data-link-card] > span') : null;
        if (!(node instanceof HTMLElement) || !artwork) return null;
        return {
          contextElement: node,
          getBoundingClientRect: () => {
            const block = node.getBoundingClientRect();
            const art = artwork.getBoundingClientRect();
            return new DOMRect(block.left, art.top, block.width, art.height);
          },
        };
      }}
      shouldShow={({ editor: e, state: s, from, to }) =>
        enabled &&
        e.isEditable &&
        !e.isActive('codeBlock') &&
        // Text selections only — a selected image or gallery has no marks to toggle.
        (isLinkCardSelection(s.selection) ||
          (from !== to && !(s.selection instanceof NodeSelection)))
      }
    >
      <motion.div
        className="fz-actionbar fz-bubble"
        initial={false}
        animate={{ width: bounds.width || 'auto', height: bounds.height || 'auto' }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: ANIMATION.duration.slow, ease: ANIMATION.ease.morph }
        }
        // Swallows mousedown so the editor keeps its selection; the controls inside are buttons.
        onMouseDown={event => event.preventDefault()}
      >
        <motion.div
          key={level}
          ref={contentRef}
          className="fz-bubble-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: ANIMATION.duration.fast }}
        >
          {level === 'presentation' ? (
            <PresentationTools
              editor={editor}
              state={state}
              onBack={state.card ? () => leaveCard(editor) : () => setLevel('format')}
            />
          ) : level === 'link' ? (
            <>
              <IconButton icon={ChevronLeftIcon} label="Back" onClick={() => setLevel('format')} />
              <span className="fz-actionbar-sep" />
              <input
                ref={linkInputRef}
                className="fz-input"
                value={linkValue}
                onChange={event => setLinkValue(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    applyLink();
                  }
                  if (event.key === 'Escape') {
                    setLevel('format');
                  }
                }}
                placeholder="Paste link…"
              />
              <IconButton icon={CheckIcon} label="Apply link" onClick={applyLink} />
            </>
          ) : (
            <>
              <FormatButtons ids={DESKTOP_TOOLS} editor={editor} state={state} />
              <span className="fz-actionbar-sep" />
              <IconButton icon={LinkIcon} label="Link" active={state.linked} onClick={openLink} />
              {state.link ? (
                <IconButton
                  icon={Settings2Icon}
                  label="Display"
                  onClick={() => setLevel('presentation')}
                />
              ) : null}
            </>
          )}
        </motion.div>
      </motion.div>
    </BubbleMenu>
  );
}

// ── Mobile: formatting pill ──────────────────────────────────────────────────
// Mirrors the docked ActionBar's pill (same shape + bottom-center anchor, raised
// above the keyboard) so it cross-fades in place with the action pill — one bar
// that morphs between "document actions" and "formatting" as you focus the text.
const FORMAT_PILL_MOTION = {
  initial: { opacity: 0, x: '-50%', y: 8, scale: 0.96 },
  animate: { opacity: 1, x: '-50%', y: 0, scale: 1 },
  exit: { opacity: 0, x: '-50%', y: 8, scale: 0.96 },
} as const;

export function MobileFormatToolbar({
  editor,
  state,
  onImage,
  bottom,
}: {
  editor: Editor;
  state: ToolbarState;
  onImage: () => void;
  bottom: number;
}) {
  const [level, setLevel] = useToolbarLevel(state);
  return (
    <motion.div
      {...FORMAT_PILL_MOTION}
      transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.6 }}
      className="fz-actionbar fz-format-pill"
      style={{ bottom: `calc(${bottom}px + max(1.25rem, env(safe-area-inset-bottom)))` }}
      onMouseDown={event => event.preventDefault()}
    >
      {level === 'presentation' ? (
        <PresentationTools
          editor={editor}
          state={state}
          onBack={state.card ? () => leaveCard(editor) : () => setLevel('format')}
        />
      ) : (
        <>
          <FormatButtons ids={MOBILE_TOOLS} editor={editor} state={state} />
          {state.link ? (
            <IconButton
              icon={Settings2Icon}
              label="Display"
              onClick={() => setLevel('presentation')}
            />
          ) : null}
          <IconButton icon={ImageIcon} label="Image" onClick={onImage} />
          <span className="fz-actionbar-sep" />
          <IconButton
            icon={ChevronDownIcon}
            label="Dismiss keyboard"
            onClick={() => editor.commands.blur()}
          />
        </>
      )}
    </motion.div>
  );
}
