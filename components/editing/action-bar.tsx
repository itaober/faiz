'use client';

import {
  CheckIcon,
  CodeIcon,
  EyeIcon,
  KeyRoundIcon,
  Loader2Icon,
  type LucideIcon,
  SquarePenIcon,
  TypeIcon,
  XIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

import Tooltip from '@/components/tooltip';
import { useSaveShortcut } from '@/hooks/use-save-shortcut';
import { cn } from '@/lib/utils';

import { hasOpenEditingOverlay } from './editing-overlays';

export type ActionBarStatus = 'idle' | 'dirty' | 'saving';
export type EditViewMode = 'preview' | 'wysiwyg' | 'markdown';

export interface ActionBarTool {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** Fill the icon when active (e.g. a pinned pin reads as solid). */
  activeFill?: boolean;
}

export interface ActionBarSession {
  context: string;
  status?: ActionBarStatus;
  hasToken: boolean;
  onConnect: () => void;
  mode?: EditViewMode;
  onModeChange?: (mode: EditViewMode) => void;
  tools?: ActionBarTool[];
  onExit: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  /** Allow saving even in preview mode — e.g. a meta toggle like pin changed. */
  dirty?: boolean;
}

const STATUS_TITLE: Record<ActionBarStatus, string> = {
  idle: 'No changes',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
};

const GROUP_MOTION = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6 },
  transition: { type: 'spring', stiffness: 560, damping: 38, mass: 0.6 },
} as const;

const BAR_MOTION = {
  initial: { opacity: 0, y: 10, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 10, scale: 0.96 },
} as const;

function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
  danger,
  activeFill,
}: ActionBarTool) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        className={cn('fz-iconbtn', danger && 'fz-iconbtn-danger')}
        data-active={active || undefined}
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
      >
        <Icon className={cn('size-4', active && activeFill && 'fill-current')} />
      </button>
    </Tooltip>
  );
}

/**
 * The single docked control for an editing session, rendered once by the dock so
 * it never remounts — its content morphs (with motion) as the active editor
 * changes. All edit affordances live here, never on the page content. Without a
 * GitHub token it collapses to a single, context-free "Connect" action.
 */
export default function ActionBar({
  context,
  status = 'dirty',
  hasToken,
  onConnect,
  mode,
  onModeChange,
  tools = [],
  onExit,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
  dirty,
}: ActionBarSession) {
  const canSave = !!onSave && (mode !== 'preview' || !!dirty);

  useSaveShortcut(hasToken && canSave && !saveDisabled, () => onSave?.());

  // Escape exits — unless an editing overlay / slash menu / bubble / sheet has
  // focus and should consume it first.
  useEffect(() => {
    if (!hasToken) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (hasOpenEditingOverlay() || document.querySelector('.fz-slash')) {
        return;
      }
      const active = document.activeElement;
      if (active?.closest('.fz-bubble') || active?.closest('.fz-sheet')) {
        return;
      }
      onExit();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [hasToken, onExit]);

  // ── No token: a single, context-free Connect action ─────────────────────
  if (!hasToken) {
    return (
      <motion.div
        layout
        {...BAR_MOTION}
        className="fz-actionbar"
        role="toolbar"
        aria-label="Editing actions"
      >
        <button type="button" className="fz-btn fz-btn-primary" onClick={onConnect}>
          <KeyRoundIcon className="size-[15px]" /> Connect to save
        </button>
        <span className="fz-actionbar-sep" />
        <IconButton icon={XIcon} label="Exit" onClick={onExit} />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      {...BAR_MOTION}
      className="fz-actionbar"
      role="toolbar"
      aria-label="Editing actions"
      transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.6 }}
    >
      {/* Just a status dot — the page context is kept in the title for hover/AT,
          not shown as text, so the bar stays minimal across every page. */}
      <motion.span
        layout
        className="fz-actionbar-ctx"
        title={`${context} · ${STATUS_TITLE[status]}`}
      >
        <span className="fz-status-dot" data-state={status} />
      </motion.span>

      <AnimatePresence mode="popLayout" initial={false}>
        {mode && onModeChange && (
          <motion.span key="mode" {...GROUP_MOTION} className="fz-actionbar-group">
            <span className="fz-actionbar-sep" />
            {/* Markdown toggle sits to the LEFT of the preview/edit toggle: when you
                tap Edit, the inserted Markdown button pushes the toggle rightward,
                offsetting the centered bar's growth so the (now Preview) toggle stays
                under your finger. */}
            {mode !== 'preview' && (
              <IconButton
                key="md-toggle"
                icon={mode === 'markdown' ? TypeIcon : CodeIcon}
                label={mode === 'markdown' ? 'WYSIWYG' : 'Markdown'}
                onClick={() => onModeChange(mode === 'markdown' ? 'wysiwyg' : 'markdown')}
              />
            )}
            <IconButton
              key="view-toggle"
              icon={mode === 'preview' ? SquarePenIcon : EyeIcon}
              label={mode === 'preview' ? 'Edit' : 'Preview'}
              onClick={() => onModeChange(mode === 'preview' ? 'wysiwyg' : 'preview')}
            />
          </motion.span>
        )}

        {tools.length > 0 && (
          <motion.span key="tools" {...GROUP_MOTION} className="fz-actionbar-group">
            <span className="fz-actionbar-sep" />
            {tools.map(tool => (
              <IconButton key={tool.label} {...tool} />
            ))}
          </motion.span>
        )}
      </AnimatePresence>

      <motion.span layout className="fz-actionbar-group">
        <span className="fz-actionbar-sep" />
        <IconButton icon={XIcon} label="Exit · Esc" onClick={onExit} />
      </motion.span>

      {/* No popLayout here: the Save button is the rightmost item, so an in-flow
          exit lets it shrink in place instead of detaching and flying past the
          bar's edge when a session without save takes over (e.g. closing an
          inline memo editor back to the list bar). */}
      <AnimatePresence initial={false}>
        {canSave && (
          <motion.div key="save" {...GROUP_MOTION}>
            <Tooltip label={`${saveLabel} · ⌘↵`}>
              <button
                type="button"
                className="fz-iconbtn fz-iconbtn-accent"
                onClick={onSave}
                disabled={saveDisabled}
                aria-label={saveLabel}
              >
                {status === 'saving' ? (
                  <Loader2Icon className="size-[16px] animate-spin" />
                ) : (
                  <CheckIcon className="size-[16px]" />
                )}
              </button>
            </Tooltip>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
