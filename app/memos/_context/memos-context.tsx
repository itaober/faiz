'use client';

import { useMemo } from 'react';

import { useEditMode } from '@/components/edit-mode-context';

import { MemosContext } from './memos-context-value';

interface IMemosProviderProps {
  children: React.ReactNode;
}

export function MemosProvider({ children }: IMemosProviderProps) {
  const { isEditMode, toggleEditMode, token, saveToken } = useEditMode();
  const value = useMemo(
    () => ({ isEdit: isEditMode, toggleEdit: toggleEditMode, token, saveToken }),
    [isEditMode, saveToken, toggleEditMode, token],
  );

  return <MemosContext.Provider value={value}>{children}</MemosContext.Provider>;
}
