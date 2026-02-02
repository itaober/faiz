'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import type { Memo } from '@/lib/data/memos';

import { useMemosContext } from '../_context/memos-context';
import MemoActionsDrawer from './memo-actions-drawer';
import MemoEditorDrawer from './memo-editor-drawer';

interface MemoCardActionsProps {
  memo: Memo;
}

export default function MemoCardActions({ memo }: MemoCardActionsProps) {
  const { isEdit } = useMemosContext();
  const [showActions, setShowActions] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  if (!isEdit) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowActions(true)}
        className="hover:bg-muted size-6 rounded transition-colors"
        aria-label="More actions"
      >
        <MoreHorizontal className="size-5 opacity-70 hover:opacity-100" />
      </button>

      <MemoActionsDrawer
        open={showActions}
        onOpenChange={setShowActions}
        memoId={memo.id}
        memoCreatedTime={memo.createdTime}
        onEdit={() => setShowEditor(true)}
      />

      <MemoEditorDrawer open={showEditor} onOpenChange={setShowEditor} memo={memo} />
    </>
  );
}
