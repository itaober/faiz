'use client';

import { MoreHorizontal } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import type { Memo } from '@/lib/data/memos';

import { useMemosContext } from '../_context/use-memos-context';
import MemoActionsDrawer from './memo-actions-drawer';
const MemoEditorDrawer = dynamic(() => import('./memo-editor-drawer'), { ssr: false });

interface MemoCardActionsProps {
  memo: Memo;
}

export default function MemoCardActions({ memo }: MemoCardActionsProps) {
  const { isEdit } = useMemosContext();
  const [mounted, setMounted] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isEdit) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowActions(true)}
        className="focus-visible:ring-foreground/40 flex size-5 items-center justify-center rounded transition-opacity focus-visible:ring-2 focus-visible:outline-none"
        aria-label="More actions"
      >
        <MoreHorizontal className="size-5 opacity-70 transition-opacity hover:opacity-100" />
      </button>

      <MemoActionsDrawer
        open={showActions}
        onOpenChange={setShowActions}
        memoId={memo.id}
        memoCreatedTime={memo.createdTime}
        onEdit={() => setShowEditor(true)}
      />

      {showEditor && (
        <MemoEditorDrawer open={showEditor} onOpenChange={setShowEditor} memo={memo} />
      )}
    </>
  );
}
