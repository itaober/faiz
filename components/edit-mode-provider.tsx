'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useGitHubToken } from '@/hooks/use-github-token';

import { EditModeContext } from './edit-mode-context';

const EDIT_MODE_STORAGE_KEY = 'FAIZ_EDIT_MODE';

export function EditModeProvider({ children }: { children: ReactNode }) {
  const { token, isLoaded: isTokenLoaded, saveToken, clearToken } = useGitHubToken();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditModeLoaded, setIsEditModeLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(EDIT_MODE_STORAGE_KEY);
    setIsEditMode(stored === 'true');
    setIsEditModeLoaded(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === EDIT_MODE_STORAGE_KEY) {
        setIsEditMode(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setEditMode = useCallback((value: boolean) => {
    localStorage.setItem(EDIT_MODE_STORAGE_KEY, String(value));
    setIsEditMode(value);
  }, []);

  const toggleEditMode = useCallback(() => {
    setIsEditMode(prev => {
      const next = !prev;
      localStorage.setItem(EDIT_MODE_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isEditMode,
      isEditModeLoaded,
      toggleEditMode,
      setEditMode,
      token,
      isTokenLoaded,
      saveToken,
      clearToken,
    }),
    [
      clearToken,
      isEditMode,
      isEditModeLoaded,
      isTokenLoaded,
      saveToken,
      setEditMode,
      toggleEditMode,
      token,
    ],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}
