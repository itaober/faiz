'use client';

import { useCallback, useEffect, useState } from 'react';

import { useGitHubToken } from '@/hooks/use-github-token';

import { MemosContext } from './memos-context-value';

interface IMemosProviderProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'FAIZ_MEMOS_IS_EDIT';

export function MemosProvider({ children }: IMemosProviderProps) {
  const { token, saveToken } = useGitHubToken();
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setIsEdit(true);
    }
  }, []);

  const toggleEdit = useCallback(() => {
    setIsEdit(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <MemosContext.Provider value={{ isEdit, toggleEdit, token, saveToken }}>
      {children}
    </MemosContext.Provider>
  );
}
