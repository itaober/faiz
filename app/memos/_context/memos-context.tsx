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

export function MemosProvider({ children }: IMemosProviderProps) {
  const { token, saveToken } = useGitHubToken();
  const [isEdit, setIsEdit] = useState(false);

  // Read URL param after mount (avoid hydration mismatch)
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    if (params.get('edit') === 'y') {
      setIsEdit(true);
    }
  }, []);

  const toggleEdit = useCallback(() => {
    const next = !isEdit;
    setIsEdit(next);

    // Shallow URL update without page reload
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set('edit', 'y');
    } else {
      url.searchParams.delete('edit');
    }
    window.history.replaceState({}, '', url.toString());
  }, [isEdit]);

  return (
    <MemosContext.Provider value={{ isEdit, toggleEdit, token, saveToken }}>
      {children}
    </MemosContext.Provider>
  );
}
