'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useEditMode } from '@/components/edit-mode-context';
import type { EditViewMode } from '@/components/editing/action-bar';

import { RecordsInlineComposerContext } from './records-inline-composer-state';

export function RecordsInlineComposerProvider({ children }: { children: ReactNode }) {
  const { isEditMode } = useEditMode();
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [editingRecordKey, setEditingRecordKeyState] = useState<string | null>(null);
  // Browse by default — covers open the lightbox until you switch to edit.
  const [mode, setMode] = useState<EditViewMode>('preview');

  // Leaving edit mode closes the side panel and resets to browse.
  useEffect(() => {
    if (!isEditMode) {
      setComposerOpen(false);
      setEditingRecordKeyState(null);
      setMode('preview');
    }
  }, [isEditMode]);

  const setComposerOpenExclusive = useCallback((open: boolean) => {
    setComposerOpen(open);
    if (open) {
      setEditingRecordKeyState(null);
    }
  }, []);

  const setEditingRecordKey = useCallback((key: string | null) => {
    setEditingRecordKeyState(key);
    if (key) {
      setComposerOpen(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      editingRecordKey,
      isComposerOpen,
      setComposerOpen: setComposerOpenExclusive,
      setEditingRecordKey,
      mode,
      setMode,
    }),
    [editingRecordKey, isComposerOpen, mode, setComposerOpenExclusive, setEditingRecordKey],
  );

  return (
    <RecordsInlineComposerContext.Provider value={value}>
      {children}
    </RecordsInlineComposerContext.Provider>
  );
}
