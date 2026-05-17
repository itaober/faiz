'use client';

import { PlusIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import { useConsecutiveClicks } from '@/hooks/use-consecutive-clicks';
import dayjs from '@/lib/dayjs';

import { useMemosContext } from '../_context/use-memos-context';
import { loadMemoEditorSurface, memoEditorPreloader } from './memo-editor-loader';

const MemoEditorSurface = dynamic(loadMemoEditorSurface, { ssr: false });

export default function MemosTitle() {
  const { isEdit, toggleEdit } = useMemosContext();
  const [mounted, setMounted] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftCreatedTime, setDraftCreatedTime] = useState('');
  const [editorActionsPortal, setEditorActionsPortal] = useState<HTMLElement | null>(null);
  const preloadEditor = useCallback(() => {
    memoEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    memoEditorPreloader.openAfterPreload(() => setIsEditorOpen(true)).catch(() => undefined);
  }, []);

  const handleClick = useConsecutiveClicks({
    threshold: 5,
    onTrigger: toggleEdit,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const canEdit = mounted && isEdit;

  useEffect(() => {
    if (canEdit) {
      preloadEditor();
    }
  }, [canEdit, preloadEditor]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="cursor-default text-4xl font-bold select-none" onClick={handleClick}>
          Memos
        </h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onFocus={preloadEditor}
              onClick={event => {
                event.currentTarget.blur();
                setDraftCreatedTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
                openEditor();
              }}
              onPointerEnter={preloadEditor}
              className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md transition-colors md:size-8"
              aria-label="Add Memo"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {canEdit && isEditorOpen && (
        <div className="mb-6">
          <header className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="border-border size-3 rounded-full border" />
              <time
                dateTime={draftCreatedTime}
                className="text-muted-foreground/70 font-sans text-sm font-medium"
              >
                {draftCreatedTime}
              </time>
            </div>
            <div
              ref={setEditorActionsPortal}
              className="not-prose hidden shrink-0 items-center gap-1 md:flex"
            />
          </header>
          <div className="flex w-full gap-2 md:gap-4">
            <div className="flex h-auto w-3 shrink-0 justify-center">
              <div className="bg-border h-full w-px" />
            </div>
            <div className="min-w-0 flex-1">
              <MemoEditorSurface
                actionsPortal={editorActionsPortal}
                onCancel={() => setIsEditorOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
