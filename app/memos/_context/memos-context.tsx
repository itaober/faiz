'use client';

import { useEffect, useMemo, useState } from 'react';

import { useEditMode } from '@/components/edit-mode-context';

import { MemosContext } from './memos-context-value';

interface IMemosProviderProps {
  children: React.ReactNode;
}

export function MemosProvider({ children }: IMemosProviderProps) {
  const { isEditMode, toggleEditMode, token, saveToken } = useEditMode();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Leaving edit mode closes any open memo editor.
  useEffect(() => {
    if (!isEditMode) {
      setEditingId(null);
    }
  }, [isEditMode]);

  const value = useMemo(
    () => ({
      isEdit: isEditMode,
      toggleEdit: toggleEditMode,
      token,
      saveToken,
      editingId,
      setEditingId,
    }),
    [editingId, isEditMode, saveToken, toggleEditMode, token],
  );

  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}
