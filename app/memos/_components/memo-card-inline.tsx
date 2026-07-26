'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useCallback } from 'react';

import EditHandle from '@/components/editing/edit-handle';
import { useMounted } from '@/hooks/use-mounted';
import type { Memo } from '@/lib/data/memos';

import { useMemosContext } from '../_context/use-memos-context';
import { loadMemoEditorSurface, memoEditorPreloader } from './memo-editor-loader';

const MemoEditorSurface = dynamic(loadMemoEditorSurface, { ssr: false });

interface IMemoCardInlineProps {
  memo: Memo;
  children: ReactNode;
}

export default function MemoCardInline({ memo, children }: IMemoCardInlineProps) {
  const { isEdit, editingId, setEditingId } = useMemosContext();
  const mounted = useMounted();
  const isEditing = editingId === memo.id;

  const preloadEditor = useCallback(() => {
    memoEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    memoEditorPreloader.openAfterPreload(() => setEditingId(memo.id)).catch(() => undefined);
  }, [memo.id, setEditingId]);

  return (
    <div className="fz-edit-row">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="border-border size-3 rounded-full border" />
          <span className="flex items-center gap-2">
            <time
              dateTime={memo.createdTime}
              className="text-muted-foreground/70 font-sans text-sm font-medium"
            >
              {memo.createdTime}
            </time>
            {/* Edit affordance sits right after the timestamp (not in the gutter). */}
            {mounted && isEdit && !isEditing && (
              <EditHandle
                className="fz-handle-inline"
                onClick={openEditor}
                onPointerEnter={preloadEditor}
                onFocus={preloadEditor}
                label="Edit memo"
              />
            )}
          </span>
        </div>
      </header>
      <div className="flex w-full gap-2 md:gap-4">
        <div className="flex h-auto w-3 shrink-0 justify-center">
          <div className="border-border h-full border-l" />
        </div>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <MemoEditorSurface memo={memo} onCancel={() => setEditingId(null)} />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
