'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useCallback, useState } from 'react';

import type { Memo } from '@/lib/data/memos';

import MemoCardActions from './memo-card-actions';
import { loadMemoEditorSurface, memoEditorPreloader } from './memo-editor-loader';

const MemoEditorSurface = dynamic(loadMemoEditorSurface, { ssr: false });

interface IMemoCardInlineProps {
  memo: Memo;
  children: ReactNode;
}

export default function MemoCardInline({ memo, children }: IMemoCardInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editorActionsPortal, setEditorActionsPortal] = useState<HTMLElement | null>(null);
  const preloadEditor = useCallback(() => {
    memoEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    memoEditorPreloader.openAfterPreload(() => setIsEditing(true)).catch(() => undefined);
  }, []);

  return (
    <div>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="border-border size-3 rounded-full border" />
          <time
            dateTime={memo.createdTime}
            className="text-muted-foreground/70 font-sans text-sm font-medium"
          >
            {memo.createdTime}
          </time>
        </div>
        {isEditing ? (
          <div
            ref={setEditorActionsPortal}
            className="not-prose hidden shrink-0 items-center gap-1 md:flex"
          />
        ) : (
          <MemoCardActions memo={memo} onEdit={openEditor} onEditIntent={preloadEditor} />
        )}
      </header>
      <div className="flex w-full gap-2 md:gap-4">
        <div className="flex h-auto w-3 shrink-0 justify-center">
          <div className="bg-border h-full w-px" />
        </div>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <MemoEditorSurface
              actionsPortal={editorActionsPortal}
              memo={memo}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
