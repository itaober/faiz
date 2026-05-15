'use client';

import { createContext, useContext } from 'react';

export interface IEditModeContextValue {
  isEditMode: boolean;
  isEditModeLoaded: boolean;
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;
  token: string | null;
  isTokenLoaded: boolean;
  saveToken: (token: string) => Promise<void>;
  clearToken: () => Promise<void>;
}

export const EditModeContext = createContext<IEditModeContextValue | null>(null);

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within EditModeProvider');
  }
  return context;
}
