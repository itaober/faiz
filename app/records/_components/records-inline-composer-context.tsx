'use client';

import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { RecordsInlineComposerContext } from './records-inline-composer-state';

export function RecordsInlineComposerProvider({ children }: { children: ReactNode }) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [editingRecordKey, setEditingRecordKeyState] = useState<string | null>(null);

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
    }),
    [editingRecordKey, isComposerOpen, setComposerOpenExclusive, setEditingRecordKey],
  );

  return (
    <RecordsInlineComposerContext.Provider value={value}>
      {children}
    </RecordsInlineComposerContext.Provider>
  );
}
