'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

import PageEditBar from '@/components/editing/page-edit-bar';
import { useConsecutiveClicks } from '@/hooks/use-consecutive-clicks';
import { useMounted } from '@/hooks/use-mounted';
import dayjs from '@/lib/dayjs';

import { useMemosContext } from '../_context/use-memos-context';
import { loadMemoEditorSurface, memoEditorPreloader } from './memo-editor-loader';

const MemoEditorSurface = dynamic(loadMemoEditorSurface, { ssr: false });

const COMPOSE_ID = 'compose';

export default function MemosTitle() {
  const { isEdit, toggleEdit, editingId, setEditingId } = useMemosContext();
  const mounted = useMounted();
  const [draftCreatedTime, setDraftCreatedTime] = useState('');
  const preloadEditor = useCallback(() => {
    memoEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openComposer = useCallback(() => {
    setDraftCreatedTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    memoEditorPreloader.openAfterPreload(() => setEditingId(COMPOSE_ID)).catch(() => undefined);
  }, [setEditingId]);

  const handleClick = useConsecutiveClicks({ threshold: 5, onTrigger: toggleEdit });

  const canEdit = mounted && isEdit;
  const isComposing = canEdit && editingId === COMPOSE_ID;

  useEffect(() => {
    if (canEdit) {
      preloadEditor();
    }
  }, [canEdit, preloadEditor]);

  return (
    <>
      <div className="mb-4">
        <h1 className="cursor-default text-4xl font-bold select-none" onClick={handleClick}>
          Memos
        </h1>
      </div>

      {isComposing && (
        <div className="mb-8">
          <header className="flex items-center gap-2 md:gap-4">
            <div className="border-accent size-3 rounded-full border" />
            <time
              dateTime={draftCreatedTime}
              className="text-muted-foreground/70 font-sans text-sm font-medium"
            >
              {draftCreatedTime} · now
            </time>
          </header>
          <div className="flex w-full gap-2 md:gap-4">
            <div className="flex h-auto w-3 shrink-0 justify-center">
              <div className="border-border h-full border-l" />
            </div>
            <div className="min-w-0 flex-1">
              <MemoEditorSurface onCancel={() => setEditingId(null)} />
            </div>
          </div>
        </div>
      )}

      {canEdit && editingId === null && (
        <PageEditBar context="Memos" addLabel="New memo" onAdd={openComposer} />
      )}
    </>
  );
}
