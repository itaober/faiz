'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useGitHubToken } from '@/hooks/use-github-token';

interface IMemosContext {
  isEdit: boolean;
  toggleEdit: () => void;
  token: string | null;
  saveToken: (token: string) => void;
}

const MemosContext = createContext<IMemosContext>({
  isEdit: false,
  toggleEdit: () => {},
  token: null,
  saveToken: () => {},
});

export const useMemosContext = () => useContext(MemosContext);

interface IMemosProviderProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'FAIZ_MEMOS_IS_EDIT';

export function MemosProvider({ children }: IMemosProviderProps) {
  const { token, saveToken } = useGitHubToken();
  const [isEdit, setIsEdit] = useState(false);

  // Read from localStorage after mount (avoid hydration mismatch)
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
